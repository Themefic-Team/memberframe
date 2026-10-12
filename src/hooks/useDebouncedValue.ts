/**
 * Debounce a changing value. PRD task 2.2, feature F02.
 *
 * F02's first acceptance criterion: member search is "debounced at 300ms". The
 * reason is not keystroke smoothness, it is that `GET /api/site/members` is a
 * server-side paginated query and a request per keystroke on a nine-character
 * email is nine queries and a rate limit.
 *
 * `useDebouncedValue` is a hook, so it cannot be unit tested while `jsdom` is
 * absent (blocker B5). The decision inside it can be: `debounceDeadline` and
 * `shouldSettle` are pure and carry the timing rule, and the hook is the four
 * lines of wiring around them. `test/debounce.test.ts` pins the boundary at
 * 299ms and 300ms.
 */

import { useEffect, useState } from "react";

/** F02 names this number. It is not a tuning knob. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Has enough time passed since the last change to act on the value?
 *
 * Inclusive at the delay, so a value changed at t and read at t+300 settles.
 * Written out rather than inlined because an off-by-one on a boundary is the
 * classic debounce bug and this way a test can state which side it falls on.
 */
export function shouldSettle(
  changedAtMs: number,
  nowMs: number,
  delayMs: number = SEARCH_DEBOUNCE_MS
): boolean {
  return nowMs - changedAtMs >= delayMs;
}

/** When the pending value becomes actionable. */
export function debounceDeadline(
  changedAtMs: number,
  delayMs: number = SEARCH_DEBOUNCE_MS
): number {
  return changedAtMs + delayMs;
}

/**
 * The settled value, trailing the live one by `delayMs`.
 *
 * Trailing edge, not leading: a search should fire once the creator stops
 * typing, not on the first character, which would query for "m" every time.
 *
 * The timer is cleared on every change and on unmount. Without the unmount
 * clear, switching segment mid-typing sets state on a gone component.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
