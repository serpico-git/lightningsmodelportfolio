export type Transaction = {
  Symbol: string;
  Side: string;
  Qty: number | null;
  "Fill Price": number | null;
  Commission: number | null;
  "Closing Time": string;
};

export type Holding = {
  symbol: string;
  qty: number;
  invested: number;
  avgPrice: number;
  csvDividends: number;
  realizedGain: number;
  cumulativeBuyCost: number;
};

export type PortfolioTotals = {
  holdingsMap: Map<string, Holding>;
  availableCash: number;
  totalRealizedGain: number;
  totalCsvDividends: number;
  totalCumulativeBuyCost: number;
};

/**
 * Walks the transaction log in chronological order and builds per-symbol
 * holdings plus portfolio-wide totals. Corporate actions (splits, bonuses,
 * mergers, demergers) are assumed to already be baked into the Qty / Fill
 * Price of the relevant Buy/Sell rows upstream — this function only knows
 * about Buy, Sell, Dividend, Deposit, Withdraw.
 */
export function calculatePortfolio(transactions: Transaction[]): PortfolioTotals {
  // Sort ascending by Closing Time first. Realized-gain math depends on
  // knowing the average cost *at the time of each sell*, so processing
  // order matters even though the source sheet isn't sorted.
  const sorted = [...transactions].sort(
    (a, b) => new Date(a["Closing Time"]).getTime() - new Date(b["Closing Time"]).getTime()
  );

  const holdingsMap = new Map<string, Holding>();
  let availableCash = 0;
  let totalRealizedGain = 0;
  let totalCsvDividends = 0;
  let totalCumulativeBuyCost = 0;

  for (const tx of sorted) {
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
        realizedGain: 0,
        cumulativeBuyCost: 0,
      });
    }
    const pos = holdingsMap.get(sym)!;

    if (side === "dividend") {
      pos.csvDividends += qty;
      totalCsvDividends += qty;
      availableCash += qty;
    } else if (side === "buy") {
      pos.qty += qty;
      pos.invested += qty * price;
      pos.cumulativeBuyCost += qty * price;
      totalCumulativeBuyCost += qty * price;
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
    // Any other Side value (unrecognised) is silently skipped, same as before.

    if (Math.abs(pos.qty) < 0.00001) {
      pos.qty = 0;
      pos.invested = 0;
    }
    pos.avgPrice = pos.qty > 0 ? pos.invested / pos.qty : 0;
  }

  return { holdingsMap, availableCash, totalRealizedGain, totalCsvDividends, totalCumulativeBuyCost };
}