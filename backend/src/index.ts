import { Hono } from "hono";
import { cors } from "hono/cors";
import transactions from "./data/transactions.json";
import { calculatePortfolio } from "./lib/calculatePortfolio";
import { getPriceSnapshot, getHistorySnapshot } from "./lib/kv";
import { refreshPrices, refreshHistory, scheduled, refreshHistoryBatch } from "./scheduled";

type Bindings = { PORTFOLIO_CACHE: KVNamespace };

const app = new Hono<{ Bindings: Bindings }>();
app.use("/api/*", cors());

app.get("/api/portfolio", async (c) => {
    const kv = c.env.PORTFOLIO_CACHE;

    const { holdingsMap, availableCash, totalRealizedGain, totalCsvDividends, totalCumulativeBuyCost } =
        calculatePortfolio(transactions as any);

    const prices = await getPriceSnapshot(kv);
    const history = await getHistorySnapshot(kv);

    let totalInvested = 0;
    let totalMtm = 0;
    const portfolioData: any[] = [];

    for (const item of holdingsMap.values()) {
        const priceInfo = prices[item.symbol];
        const histInfo = history[item.symbol];
        const ltp = item.qty > 0 ? priceInfo?.ltp ?? item.avgPrice : 0;

        const unrealizedGain = item.qty > 0 ? (ltp - item.avgPrice) * item.qty : 0;
        const value = ltp * item.qty;
        totalInvested += item.invested;
        totalMtm += value;

        const totalGain = unrealizedGain + item.realizedGain + item.csvDividends;

        portfolioData.push({
            symbol: item.symbol,
            quantity: item.qty,
            avgPrice: item.avgPrice,
            ltp: item.qty > 0 ? ltp : item.avgPrice,
            invested: item.invested,
            value,
            unrealizedGain,
            unrealizedGainPct: item.invested > 0 ? (unrealizedGain / item.invested) * 100 : 0,
            totalDividend: item.csvDividends,
            totalGain,
            totalGainPct: item.cumulativeBuyCost > 0 ? (totalGain / item.cumulativeBuyCost) * 100 : 0,
            sector: histInfo?.sector ?? "--",
            corpActions: histInfo?.corpActions ?? [],
            error: item.qty > 0 && !priceInfo ? "Data unavailable" : undefined, allocation: 0, // filled below
        });
    }
    portfolioData.forEach((p) => (p.allocation = totalMtm > 0 ? (p.value / totalMtm) * 100 : 0));

    // Benchmark series: walk Nifty's date list, sum portfolio value per date
    const niftyQuotes = history["^NSEI"]?.quotes ?? {};
    const dates = Object.keys(niftyQuotes).sort();
    let benchmark: any[] = [];
    if (dates.length > 0) {
        const niftyBase = niftyQuotes[dates[0]];
        let portfolioBase: number | null = null;
        const lastKnownPrice: Record<string, number> = {};

        for (const date of dates) {
            let dailyPortValue = 0;
            for (const item of holdingsMap.values()) {
                const price = history[item.symbol]?.quotes?.[date];
                if (price != null) lastKnownPrice[item.symbol] = price;
                dailyPortValue += (lastKnownPrice[item.symbol] ?? item.avgPrice) * item.qty;
            }
            if (portfolioBase === null && dailyPortValue > 0) portfolioBase = dailyPortValue;
            const pBase = portfolioBase || 1;
            benchmark.push({
                date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                niftyReturn: ((niftyQuotes[date] - niftyBase) / niftyBase) * 100,
                portfolioReturn: ((dailyPortValue - pBase) / pBase) * 100,
            });
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
            totalGainPct: totalCumulativeBuyCost > 0 ? (totalGain / totalCumulativeBuyCost) * 100 : 0,
        },
        portfolioData,
        benchmark,
    });
});

// Manual trigger for local testing — lets you populate KV without waiting
// for a real cron tick. Safe to keep in production too as a manual refresh.
app.post("/api/refresh/prices", async (c) => {
  await refreshPrices(c.env);
  return c.json({ ok: true });
});

app.post("/api/refresh/history", async (c) => {
  const batchIndex = Number(c.req.query("batch")) || 0;
  const result = await refreshHistoryBatch(c.env, batchIndex);
  return c.json({ ok: true, ...result });
});

export default { fetch: app.fetch, scheduled };