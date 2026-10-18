/**
 * Money, as integer minor units. PRD section 11.2.
 *
 * "All money stored as integer minor units. Floating point currency produces
 * rounding errors."
 *
 * `parseMinor` never produces a float. It works on the decimal string: split on
 * the separator, pad the fraction, concatenate, parse once as an integer.
 *
 * ## Being honest about why
 *
 * The usual justification is that `Math.round(parseFloat(x) * 100)` misprices
 * 1.005, which has no exact binary representation and rounds down. That is
 * true, and it is not the reason this is a string parser, because a value with
 * three decimal places is refused here before any conversion happens. At two
 * decimal places the rounding absorbs the representation error and the float
 * route agrees.
 *
 * The reason that survives is that `parseFloat` accepts things that are not
 * prices and returns a number anyway: `"1e5"` becomes 100000, `"9.99abc"`
 * becomes 9.99, `"Infinity"` becomes Infinity, `"0x10"` becomes 0. Each of
 * those is a silently wrong price on a charge the creator makes every month.
 * This parser refuses all of them, and is exact by construction rather than by
 * rounding luck. `test/money.test.ts` pins each case and asserts that
 * `parseFloat` really does accept it, so the comparison is not a straw man.
 *
 * ## The exponent is a parameter
 *
 * Two decimal places is correct for most currencies and wrong for JPY, which
 * has none, and KWD, which has three. The exponent is therefore an argument,
 * and every call site passes `currencyExponent(code)` from
 * `utils/currencies.ts`. The default of 2 survives for callers with no
 * currency in hand. Conflict C12 in
 * `docs/development-docs/02-member-tier-cockpit.md`, now resolved.
 */

/** Decimal places assumed when a caller has no currency in hand. Most currencies use two. */
export const DEFAULT_MINOR_EXPONENT = 2;

export type ParsedMoney =
  | { ok: true; minor: number }
  | {
      ok: false;
      reason: "empty" | "not_a_number" | "negative" | "too_large" | "too_precise";
    };

/**
 * Largest amount accepted, in minor units.
 *
 * `Number.MAX_SAFE_INTEGER` is the real ceiling, and a price field that accepts
 * 90 trillion is a field that accepts a typo. Ten million major units is high
 * enough for a lifetime enterprise licence and low enough to catch a creator
 * who pasted a phone number.
 */
export const MAX_MINOR_AMOUNT = 1_000_000_000;

/**
 * Turn what a creator typed into integer minor units.
 *
 * Accepts an optional leading plus, digits, and one decimal separator, which may
 * be a period or a comma: a creator on a German keyboard types "9,99" and
 * meaning that as nine euros ninety-nine is not a guess. Thousands separators
 * are rejected rather than stripped, because "1,999" is ambiguous between one
 * thousand nine hundred ninety nine and one point nine nine nine, and guessing
 * wrong silently misprices a tier by a factor of a thousand.
 */
export function parseMinor(
  input: string,
  exponent: number = DEFAULT_MINOR_EXPONENT
): ParsedMoney {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };

  if (trimmed.startsWith("-")) return { ok: false, reason: "negative" };

  const unsigned = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;

  // One separator at most, digits either side, at least one digit overall.
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(unsigned)) {
    return { ok: false, reason: "not_a_number" };
  }

  const separator = unsigned.search(/[.,]/);
  const whole = separator === -1 ? unsigned : unsigned.slice(0, separator);
  const rawFraction = separator === -1 ? "" : unsigned.slice(separator + 1);

  /*
    A fraction longer than the currency allows is refused, not reshaped.

    This started as a truncation, and a test caught what that costs. "1,999" on
    a US keyboard means one thousand nine hundred ninety nine; on a German one
    it means one point nine nine nine. Truncating silently priced it at 1.99,
    which is a 1000x mispricing with nothing on screen to show it happened, on
    a tier the creator charges every month.

    Rounding is no better: "0.999" becoming 1.00 charges a cent they did not
    type. Both forms are genuinely ambiguous without knowing the creator's
    locale, so the honest answer is to refuse and let them retype. This also
    matches `components/manage/tierValidation.ts`, whose own regex already
    allowed at most two decimal places, so the form layer and the conversion
    layer now agree.
  */
  if (rawFraction.length > exponent) {
    return { ok: false, reason: "too_precise" };
  }

  const fraction = rawFraction.padEnd(exponent, "0");
  const digits = `${whole === "" ? "0" : whole}${fraction}`;

  const minor = Number.parseInt(digits, 10);

  if (!Number.isFinite(minor)) return { ok: false, reason: "not_a_number" };
  if (minor > MAX_MINOR_AMOUNT) return { ok: false, reason: "too_large" };

  return { ok: true, minor };
}

/**
 * Minor units back to a plain decimal string, for a form field.
 *
 * Integer arithmetic only, same reason as above. No currency symbol and no
 * grouping: this is the value that goes back into the input the creator edits,
 * and a field holding "$1,999.00" cannot be parsed back by `parseMinor`.
 */
export function formatMinorPlain(
  minor: number,
  exponent: number = DEFAULT_MINOR_EXPONENT
): string {
  const safe = Math.trunc(Math.abs(minor));
  const digits = String(safe).padStart(exponent + 1, "0");

  if (exponent === 0) return digits;

  const whole = digits.slice(0, digits.length - exponent);
  const fraction = digits.slice(digits.length - exponent);

  return `${minor < 0 ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Minor units as something to show a creator, with the currency.
 *
 * `Intl.NumberFormat` does the grouping and the symbol placement, which differ
 * per currency and per locale and are not worth hand rolling. The amount handed
 * to it is divided by the minor factor, which is the one place a float appears
 * in this file: it is a display path, nothing is stored from it, and the value
 * is bounded by `MAX_MINOR_AMOUNT` well inside exact integer range.
 */
export function formatMinorWithCurrency(
  minor: number,
  currency: string,
  exponent: number = DEFAULT_MINOR_EXPONENT
): string {
  const major = minor / 10 ** exponent;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(major);
  } catch {
    // An unknown currency code throws. Showing the number is better than
    // showing nothing, and better than crashing a member row.
    return `${formatMinorPlain(minor, exponent)} ${currency}`;
  }
}

/**
 * Error copy for a rejected amount, in the creator's language rather than the
 * parser's. PRD section 7.6 rule 4 and rule 6: no jargon, and a full sentence.
 */
export function moneyErrorMessage(
  reason: Exclude<ParsedMoney, { ok: true }>["reason"],
  exponent: number = DEFAULT_MINOR_EXPONENT
): string {
  switch (reason) {
    case "empty":
      return "Enter a price.";
    case "not_a_number":
      return "Use digits and one decimal point.";
    case "negative":
      return "A price cannot be negative.";
    case "too_large":
      return "That price is too high.";
    case "too_precise":
      if (exponent === 0) return "Use a whole number, with no decimal point.";
      return `Use at most ${exponent === 3 ? "three" : "two"} decimal places, and no thousands separator.`;
  }
}
