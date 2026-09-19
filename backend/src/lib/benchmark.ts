import type { Transaction } from "./calculatePortfolio";
import type { HistorySnapshot } from "./yahoo";

export type BenchmarkPoint = { date: string; portfolioReturn: number; niftyReturn: number };

/**
 * Replays transactions in chronological order and tracks portfolio value
 * using a NAV/unit system (like a mutual fund):
 *  - Deposits/withdrawals buy or redeem "units" at that day's NAV, so adding
 *    or removing cash never looks like a market gain or loss.
 *  - Buys/sells just rearrange cash <-> stock, no unit change.
 *  - Dividends stay in the pot and lift NAV directly, since they're a real return.
 * The resulting % return is genuinely comparable to Nifty's % return.
 */
export function buildBenchmarkSeries(
  transactions: Transaction[],
  history: HistorySnapshot
): BenchmarkPoint[] {
  const niftyQuotes = history["^NSEI"]?.quotes ?? {};
  const tradingDates = Object.keys(niftyQuotes).sort();
  if (tradingDates.length === 0) return [];
  const niftyBase = niftyQuotes[tradingDates[0]];

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a["Closing Time"]).getTime() - new Date(b["Closing Time"]).getTime()
  );

  const qty: Record<string, number> = {};
  const lastPrice: Record<string, number> = {};
  let cash = 0;
  let units = 0;
  let navBase: number | null = null;
  let txPointer = 0;

  const marketValueOn = (date: string) => {
    let v = cash;
    for (const sym of Object.keys(qty)) {
      if (!qty[sym]) continue;
      const px = history[sym]?.quotes?.[date];
      if (px != null) lastPrice[sym] = px;
      v += (lastPrice[sym] ?? 0) * qty[sym];
    }
    return v;
  };

  const series: BenchmarkPoint[] = [];

  for (const date of tradingDates) {
    const cutoff = new Date(date + "T23:59:59").getTime();

    while (
      txPointer < sortedTx.length &&
      new Date(sortedTx[txPointer]["Closing Time"]).getTime() <= cutoff
    ) {
      const tx = sortedTx[txPointer++];
      const sym = tx.Symbol?.trim();
      const side = tx.Side?.trim().toLowerCase();
      const txQty = Number(tx.Qty) || 0;
      const price = Number(tx["Fill Price"]) || 0;
      if (!sym) continue;

      if (sym === "$CASH") {
        if (side === "deposit") {
          const navNow = units > 0 ? marketValueOn(date) / units : 1;
          if (navBase === null) navBase = 1;
          cash += txQty;
          units += txQty / navNow;
        } else if (side === "withdraw") {
          const navNow = units > 0 ? marketValueOn(date) / units : 1;
          cash -= txQty;
          if (navNow > 0) units -= txQty / navNow;
        }
        continue;
      }

      if (side === "buy") {
        qty[sym] = (qty[sym] || 0) + txQty;
        cash -= txQty * price;
      } else if (side === "sell") {
        qty[sym] = (qty[sym] || 0) - txQty;
        cash += txQty * price;
      } else if (side === "dividend") {
        cash += txQty; // no new units — this is a real return, boosts NAV directly
      }
    }

    if (navBase !== null && units > 0) {
      const nav = marketValueOn(date) / units;
      series.push({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        portfolioReturn: (nav / navBase - 1) * 100,
        niftyReturn: ((niftyQuotes[date] - niftyBase) / niftyBase) * 100,
      });
    }
  }

  return series;
}