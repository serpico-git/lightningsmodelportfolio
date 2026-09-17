import type { PriceSnapshot, HistorySnapshot } from "./yahoo";

export const KEYS = {
  PRICES: "PRICE_SNAPSHOT",
  HISTORY: "HISTORY_SNAPSHOT",
} as const;

export async function getPriceSnapshot(kv: KVNamespace): Promise<PriceSnapshot> {
  return ((await kv.get(KEYS.PRICES, "json")) as PriceSnapshot) || {};
}

export async function getHistorySnapshot(kv: KVNamespace): Promise<HistorySnapshot> {
  return ((await kv.get(KEYS.HISTORY, "json")) as HistorySnapshot) || {};
}

/** Merges newly-fetched data over the existing snapshot so a partial refresh (or a symbol Yahoo failed on) doesn't wipe out previously-good data. */
export async function mergeAndSavePrices(kv: KVNamespace, fresh: PriceSnapshot) {
  const existing = await getPriceSnapshot(kv);
  const merged = { ...existing, ...fresh };
  await kv.put(KEYS.PRICES, JSON.stringify(merged));
  return merged;
}

export async function mergeAndSaveHistory(kv: KVNamespace, fresh: HistorySnapshot) {
  const existing = await getHistorySnapshot(kv);
  const merged = { ...existing, ...fresh };
  await kv.put(KEYS.HISTORY, JSON.stringify(merged));
  return merged;
}