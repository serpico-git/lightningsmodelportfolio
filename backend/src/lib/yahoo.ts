import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

export const formatSymbol = (sym: string) => {
  if (sym.startsWith("NSE:")) return sym.replace("NSE:", "") + ".NS";
  if (sym.startsWith("BSE:")) return sym.replace("BSE:", "") + ".BO";
  return sym;
};

export type PriceEntry = { ltp: number; updatedAt: number };
export type PriceSnapshot = Record<string, PriceEntry>;

/** Fetches current LTP for every symbol in parallel (not sequentially). */
// export async function fetchLatestPrices(symbols: string[]): Promise<PriceSnapshot> {
//   const results = await Promise.allSettled(
//     symbols.map(async (sym) => {
//       const yfSymbol = formatSymbol(sym);
//       const quote = await yahooFinance.quote(yfSymbol);
//       return { sym, ltp: quote?.regularMarketPrice ?? null };
//     })
//   );

//   const snapshot: PriceSnapshot = {};
//   results.forEach((r, i) => {
//     const sym = symbols[i];
//     if (r.status === "fulfilled" && r.value.ltp != null) {
//       snapshot[sym] = { ltp: r.value.ltp, updatedAt: Date.now() };
//     }
//     // On failure we simply omit it here; the caller merges this with the
//     // previous snapshot so a transient failure doesn't blank out a price.
//   });
//   return snapshot;
// }

export async function fetchLatestPrices(symbols: string[]): Promise<PriceSnapshot> {
  const yfSymbols = symbols.map(formatSymbol);
  const snapshot: PriceSnapshot = {};
  try {
    const quotes = await yahooFinance.quote(yfSymbols); // one call for all symbols
    const list = Array.isArray(quotes) ? quotes : [quotes];
    list.forEach((q: any) => {
      const idx = yfSymbols.indexOf(q.symbol);
      if (idx !== -1 && q.regularMarketPrice != null) {
        snapshot[symbols[idx]] = { ltp: q.regularMarketPrice, updatedAt: Date.now() };
      }
    });
  } catch (err) {
    console.error("fetchLatestPrices batch call failed", err);
  }
  return snapshot;
}

export type CorpAction = { type: string; date: number; amount?: number | string };
export type HistoryEntry = {
  sector: string;
  corpActions: CorpAction[]; // upcoming + past, pre-sorted newest first
  quotes: Record<string, number>;
};
export type HistorySnapshot = Record<string, HistoryEntry>;

export async function fetchFullHistory(
  symbols: string[],
  startDate: string
): Promise<HistorySnapshot> {
  const results = await Promise.allSettled(
    symbols.map(async (sym) => {
      const yfSymbol = formatSymbol(sym);
      const chartData = await yahooFinance.chart(yfSymbol, { period1: startDate, interval: "1d" });

      let sector = "Unknown";
      const corpActions: CorpAction[] = [];
      try {
        const quoteData = await yahooFinance.quoteSummary(yfSymbol, {
          modules: ["assetProfile", "calendarEvents"],
        });
        sector = quoteData.assetProfile?.sector || "Unknown";
        const exDate = quoteData.calendarEvents?.exDividendDate;
        if (exDate && new Date(exDate) > new Date()) {
          corpActions.push({ type: "Upcoming Dividend", date: new Date(exDate).getTime() });
        }
      } catch {
        // best-effort
      }

      if (chartData.events?.dividends) {
        Object.values(chartData.events.dividends).forEach((div: any) => {
          const ts = div.date instanceof Date ? div.date.getTime() : new Date(div.date).getTime();
          corpActions.push({ type: "Past Dividend", date: ts, amount: div.amount });
        });
      }
      if (chartData.events?.splits) {
        Object.values(chartData.events.splits).forEach((split: any) => {
          const ts = split.date instanceof Date ? split.date.getTime() : new Date(split.date).getTime();
          corpActions.push({ type: "Split", date: ts, amount: split.splitRatio });
        });
      }
      corpActions.sort((a, b) => b.date - a.date);

      const quotes: Record<string, number> = {};
      (chartData.quotes || []).forEach((q: any) => {
        if (q.close !== null) quotes[new Date(q.date).toISOString().split("T")[0]] = q.close;
      });

      return { sym, entry: { sector, corpActions, quotes } as HistoryEntry };
    })
  );

  const snapshot: HistorySnapshot = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") snapshot[r.value.sym] = r.value.entry;
  });
  return snapshot;
}