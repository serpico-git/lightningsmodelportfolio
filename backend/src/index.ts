import { Hono } from "hono";
import { cors } from "hono/cors";
import YahooFinance from "yahoo-finance2";

type Bindings = {
  PORTFOLIO_CACHE: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

app.use("/api/*", cors());

const formatSymbol = (sym: string) => {
  if (sym.startsWith("NSE:")) return sym.replace("NSE:", "") + ".NS";
  if (sym.startsWith("BSE:")) return sym.replace("BSE:", "") + ".BO";
  return sym;
};

app.post("/api/portfolio", async (c) => {
  try {
    const { transactions } = await c.req.json();
    const kv = c.env.PORTFOLIO_CACHE;
    const CACHE_TTL = 900; 

    const holdingsMap = new Map();
    let totalRealizedGain = 0;
    let availableCash = 0;
    let totalCsvDividends = 0;
    let totalCumulativeBuyCost = 0;   // ADD THIS

    // Process transactions sequentially
    for (const tx of transactions) {
      const sym = tx["Symbol"]?.trim();
      const side = tx["Side"]?.trim().toLowerCase();
      const qty = Number(tx["Qty"]) || 0;
      const price = Number(tx["Fill Price"]) || 0;

      if (!sym) continue;

      if (sym === "$CASH") {
        if (side === "deposit") availableCash += qty;
        if (side === "withdraw") availableCash -= qty;
        continue;
      }

      if (!holdingsMap.has(sym)) {
        holdingsMap.set(sym, {
          symbol: sym,
          qty: 0,
          invested: 0,
          avgPrice: 0,
          csvDividends: 0,
          realizedGain: 0,      // Track tracking-level realized gain for this stock
          cumulativeBuyCost: 0  // Baseline denominator for closed % gains
        });
      }

      const pos = holdingsMap.get(sym);

      if (side === "dividend") {
        pos.csvDividends += qty;
        totalCsvDividends += qty;
        availableCash += qty;
      } else if (side === "buy") {
        pos.qty += qty;
        pos.invested += qty * price;
        pos.cumulativeBuyCost += qty * price;
        totalCumulativeBuyCost += qty * price;   // ADD THIS LINE
        availableCash -= qty * price;
      } else if (side === "sell") {
        const currentAvg = pos.qty > 0 ? pos.invested / pos.qty : 0;
        const gainFromSell = (price - currentAvg) * qty;
        
        totalRealizedGain += gainFromSell;
        pos.realizedGain += gainFromSell; 
        
        pos.qty -= qty;
        pos.invested -= currentAvg * qty;
        availableCash += qty * price;
      }

      // Safeguard against floating point remainder values
      if (Math.abs(pos.qty) < 0.00001) {
        pos.qty = 0;
        pos.invested = 0;
      }

      pos.avgPrice = pos.qty > 0 ? pos.invested / pos.qty : 0;
    }

    const allHistoricalSymbols = Array.from(holdingsMap.values());
    const portfolioData = [];
    let totalInvested = 0;
    let totalMtm = 0;
    const startDate = "2026-03-09"; 
    const marketDataMap = new Map();

    // Fetch and prepare data for all positions (Open and Closed)
    for (const item of allHistoricalSymbols) {
      const yfSymbol = formatSymbol(item.symbol);
      const cacheKey = `YF_DATA_${yfSymbol}`;
      let marketData = (await kv.get(cacheKey, "json")) as any;

      if (!marketData) {
        try {
          const chartData = await yahooFinance.chart(yfSymbol, {
            period1: startDate,
            interval: "1d",
          });

          let sector = "Unknown";
          let upcomingEvents = [];

          try {
            const quoteData = await yahooFinance.quoteSummary(yfSymbol, {
              modules: ["assetProfile", "calendarEvents"],
            });
            sector = quoteData.assetProfile?.sector || "Unknown";
            if (quoteData.calendarEvents?.exDividendDate) {
              const exDate = new Date(quoteData.calendarEvents.exDividendDate);
              if (exDate > new Date()) {
                upcomingEvents.push({
                  type: "Upcoming Dividend",
                  date: exDate.getTime(),
                });
              }
            }
          } catch (e) {}

          const quotesMap: Record<string, number> = {};
          if (chartData.quotes) {
            chartData.quotes.forEach((q: any) => {
              if (q.close !== null) {
                quotesMap[new Date(q.date).toISOString().split("T")[0]] = q.close;
              }
            });
          }

          marketData = {
            ltp: chartData.meta?.regularMarketPrice || item.avgPrice,
            sector,
            events: chartData.events || {},
            upcomingEvents,
            quotes: quotesMap,
            timestamp: Date.now(),
          };
          await kv.put(cacheKey, JSON.stringify(marketData), { expirationTtl: CACHE_TTL });
        } catch (err) {
          marketData = {
            ltp: item.avgPrice,
            sector: "Unknown",
            events: {},
            upcomingEvents: [],
            quotes: {},
            error: "Data unavailable",
          };
        }
      }

      marketDataMap.set(item.symbol, marketData);

      // Calculations based on position status
      const ltp = item.qty > 0 ? marketData.ltp : 0; 
      const unrealizedGain = item.qty > 0 ? (ltp - item.avgPrice) * item.qty : 0;
      const value = ltp * item.qty;

      // Aggregates for global summary (Only open deployment costs count here)
      totalInvested += item.invested;
      totalMtm += value;

      const corpActions = [...marketData.upcomingEvents];
      if (marketData.events?.dividends) {
        marketData.events.dividends.forEach((div: any) => {
          const timestamp = div.date instanceof Date ? div.date.getTime() : new Date(div.date).getTime();
          corpActions.push({ date: timestamp, type: "Past Dividend", amount: div.amount });
        });
      }
      if (marketData.events?.splits) {
        marketData.events.splits.forEach((split: any) => {
          const timestamp = split.date instanceof Date ? split.date.getTime() : new Date(split.date).getTime();
          corpActions.push({ date: timestamp, type: "Split", amount: split.splitRatio });
        });
      }
      corpActions.sort((a: any, b: any) => b.date - a.date);

      // Combine realized trade values with active paper gains for final tally
      const totalGain = unrealizedGain + item.realizedGain + item.csvDividends;
      
      // Determine correct baseline to avoid division-by-zero on fully liquidated items
      // const percentageDenominator = item.qty > 0 ? item.invested : item.cumulativeBuyCost;

      portfolioData.push({
        symbol: item.symbol,
        allocation: 0,
        quantity: item.qty,
        avgPrice: item.avgPrice,
        ltp: item.qty > 0 ? ltp : item.avgPrice, // Show last price if active, fallback to entry for flat rows
        invested: item.invested,
        value,
        unrealizedGain,
        // unrealizedGainPct: percentageDenominator > 0 ? (unrealizedGain / percentageDenominator) * 100 : 0,
        unrealizedGainPct: item.invested > 0 ? (unrealizedGain / item.invested) * 100 : 0,
        totalDividend: item.csvDividends,
        totalGain,
        // totalGainPct: percentageDenominator > 0 ? (totalGain / percentageDenominator) * 100 : 0,
        totalGainPct: item.cumulativeBuyCost > 0 ? (totalGain / item.cumulativeBuyCost) * 100 : 0,
        sector: marketData.sector,
        corpActions,
        error: marketData.error,
      });
    }

    // Allocate percentages to active capital fields
    portfolioData.forEach((p) => (p.allocation = totalMtm > 0 ? (p.value / totalMtm) * 100 : 0));

    // Handle Historical Performance Series
    const portfolioHash = allHistoricalSymbols.map((h) => `${h.symbol}-${h.qty}`).sort().join("_");
    const benchmarkCacheKey = `BENCHMARK_${startDate}_${portfolioHash}`;
    let benchmarkSeries = (await kv.get(benchmarkCacheKey, "json")) as any[];

    if (!benchmarkSeries) {
      let niftyQuotes: any[] = [];
      try {
        const niftyChart = await yahooFinance.chart("^NSEI", { period1: startDate, interval: "1d" });
        niftyQuotes = niftyChart.quotes.filter((q) => q.close !== null);
      } catch (e) {
        console.error("Failed to fetch Nifty benchmark");
      }

      if (niftyQuotes.length > 0) {
        benchmarkSeries = [];
        const niftyBase = niftyQuotes[0].close;
        let portfolioBase: number | null = null;
        const currentPrices = new Map();

        for (const nq of niftyQuotes) {
          const dateStr = new Date(nq.date).toISOString().split("T")[0];
          let dailyPortValue = 0;

          for (const item of allHistoricalSymbols) {
            const mData = marketDataMap.get(item.symbol);
            if (mData?.quotes?.[dateStr]) {
              currentPrices.set(item.symbol, mData.quotes[dateStr]);
            }
            const priceToUse = currentPrices.get(item.symbol) || item.avgPrice || 0;
            dailyPortValue += priceToUse * item.qty; 
          }

          if (portfolioBase === null && dailyPortValue > 0) {
            portfolioBase = dailyPortValue;
          }

          const pBase = portfolioBase || 1;
          const nBase = niftyBase || 1;

          benchmarkSeries.push({
            date: new Date(nq.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            niftyReturn: ((nq.close - nBase) / nBase) * 100,
            portfolioReturn: ((dailyPortValue - pBase) / pBase) * 100,
          });
        }
        await kv.put(benchmarkCacheKey, JSON.stringify(benchmarkSeries), { expirationTtl: 86400 });
      } else {
        benchmarkSeries = [];
      }
    }

    const unrealizedGain = totalMtm - totalInvested;
    const totalGain = totalRealizedGain + unrealizedGain + totalCsvDividends;

    return c.json({
      summary: {
        invested: totalInvested,
        currentValue: totalMtm,
        cash: availableCash,
        unrealizedGain,
        unrealizedGainPct: totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0,
        realizedGains: totalRealizedGain,
        totalDividends: totalCsvDividends,
        totalGain,
        // totalGainPct: totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0,
        totalGainPct: totalCumulativeBuyCost > 0 ? (totalGain / totalCumulativeBuyCost) * 100 : 0,  // CHANGE
      },
      portfolioData,
      benchmark: benchmarkSeries,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to parse request data" }, 400);
  }
});

export default app;