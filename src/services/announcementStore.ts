/**
 * Where the Home promo campaign card keeps its offer window (37-promo-campaign-card.md): this
 * browser's localStorage, one key per account, Framer project, and campaign
 * (`offerStorageKey`). No database rows, no tokens, no email: the account and
 * the project id are SHA-256 hashes in the key, and the value is times and
 * two flags.
 *
 * localStorage can be missing or refuse writes (a private window, storage
 * blocked by the browser). Every call is wrapped, and a refused write is kept
 * in memory for this panel session instead: the card still works, it just
 * starts over next time. Clearing site data, another browser, or another
 * device starts over too.
 */

import { parseOfferRecord, type OfferRecord } from "../utils/announcementRules";

const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readOffer(key: string): OfferRecord | null {
  if (memory.has(key)) return parseOfferRecord(memory.get(key) ?? null);
  try {
    return parseOfferRecord(storage()?.getItem(key) ?? null);
  } catch {
    return null;
  }
}

export function writeOffer(key: string, record: OfferRecord): void {
  const value = JSON.stringify(record);
  try {
    const store = storage();
    if (!store) throw new Error("localStorage unavailable");
    store.setItem(key, value);
    memory.delete(key);
  } catch {
    memory.set(key, value);
  }
}

/** Test only: forget the in-memory fallback. */
export function resetOfferMemory(): void {
  memory.clear();
}

/** A short, stable SHA-256 of one identity part, so neither the email nor the project id is stored. Null without Web Crypto. */
export async function scopeHash(kind: "account" | "project", value: string): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`memberframe:announcement:${kind}:${value}`));
    return Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
