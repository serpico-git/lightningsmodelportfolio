import type { ScheduledEvent, ExecutionContext } from "@cloudflare/workers-types";
import transactions from "./data/transactions.json";
import { fetchLatestPrices, fetchFullHistory } from "./lib/yahoo";
import { mergeAndSavePrices, mergeAndSaveHistory } from "./lib/kv";

type Bindings = { PORTFOLIO_CACHE: KVNamespace };

const START_DATE = "2026-03-09"; // date your portfolio began

function getAllSymbols(): string[] {
  const set = new Set<string>();
  for (const tx of transactions as any[]) {
    if (tx.Symbol && tx.Symbol !== "$CASH") set.add(tx.Symbol);
  }
  return Array.from(set);
}

export async function refreshPrices(env: Bindings) {
  const symbols = getAllSymbols();
  try {
    const fresh = await fetchLatestPrices(symbols);
    await mergeAndSavePrices(env.PORTFOLIO_CACHE, fresh);
    console.log(`refreshPrices: updated ${Object.keys(fresh).length}/${symbols.length} symbols`);
  } catch (err) {
    console.error("refreshPrices failed entirely", err);
  }
}

export async function refreshHistory(env: Bindings) {
  const symbols = [...getAllSymbols(), "^NSEI"]; // include Nifty for the benchmark chart
  try {
    const fresh = await fetchFullHistory(symbols, START_DATE);
    await mergeAndSaveHistory(env.PORTFOLIO_CACHE, fresh);
    console.log(`refreshHistory: updated ${Object.keys(fresh).length}/${symbols.length} symbols`);
  } catch (err) {
    console.error("refreshHistory failed entirely", err);
  }
}

export async function scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
  if (event.cron === "*/30 * * * *") {
    ctx.waitUntil(refreshPrices(env));
  } else if (event.cron === "0 3 */2 * *") {
    ctx.waitUntil(refreshHistory(env));
  }
}