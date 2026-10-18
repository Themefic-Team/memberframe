/**
 * Money as integer minor units. PRD task 2.3, PRD section 11.2.
 *
 * "All money stored as integer minor units. Floating point currency produces
 * rounding errors." The first block below is the whole reason `parseMinor`
 * exists in the shape it does: every one of those values is mispriced by the
 * obvious `Math.round(parseFloat(x) * 100)` implementation.
 *
 * A mispriced tier is a creator charging the wrong amount, every month, with
 * nothing on screen saying so, which puts these assertions among the most
 * valuable in the repo.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_MINOR_AMOUNT,
  formatMinorPlain,
  formatMinorWithCurrency,
  moneyErrorMessage,
  parseMinor,
} from "../src/utils/money";

function minor(input: string): number | null {
  const parsed = parseMinor(input);
  return parsed.ok ? parsed.minor : null;
}

describe("why this is parsed as a string and not through parseFloat", () => {
  /**
   * The usual argument for avoiding floats here is that
   * `Math.round(parseFloat(x) * 100)` misprices values like 1.005. That is
   * true, and it is also not the reason this module is shaped the way it is,
   * because those values are now refused outright as over-precise. At two
   * decimal places the rounding absorbs the representation error and the float
   * route happens to agree.
   *
   * The reason that survives is that `parseFloat` accepts things that are not
   * prices and returns a number anyway. Every input below would become a
   * silently wrong price through that route, and each is refused here.
   */
  const parseFloatAccepts: ReadonlyArray<[string, number]> = [
    ["1e5", 100000],
    ["9.99abc", 9.99],
    ["0x10", 0],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["12 34", 12],
    ["9.99.99", 9.99],
  ];

  for (const [input, floatValue] of parseFloatAccepts) {
    it(`refuses ${input}, which parseFloat reads as ${floatValue}`, () => {
      // The second assertion is the point: it proves the input really is one
      // parseFloat would have accepted, so this is not a straw man.
      expect(parseMinor(input).ok).toBe(false);
      expect(Number.parseFloat(input)).toBe(floatValue);
    });
  }

  it("is exact by construction rather than by rounding luck", () => {
    // No float appears on the parse path at all, so correctness does not rest
    // on "the error is small enough that Math.round fixes it".
    for (const [input, expected] of [
      ["0.01", 1],
      ["0.07", 7],
      ["1.13", 113],
      ["16.08", 1608],
      ["99.95", 9995],
    ] as const) {
      expect(minor(input)).toBe(expected);
    }
  });
});

describe("parseMinor: ordinary values", () => {
  it("handles whole numbers, one decimal, and two", () => {
    expect(minor("9")).toBe(900);
    expect(minor("9.9")).toBe(990);
    expect(minor("9.99")).toBe(999);
    expect(minor("0")).toBe(0);
    expect(minor("0.00")).toBe(0);
  });

  it("accepts a leading decimal separator", () => {
    expect(minor(".99")).toBe(99);
    expect(minor(",99")).toBe(99);
  });

  it("accepts a comma separator, for a creator on a European keyboard", () => {
    expect(minor("9,99")).toBe(999);
    expect(minor("12,50")).toBe(1250);
  });

  it("accepts a leading plus and surrounding whitespace", () => {
    expect(minor("+9.99")).toBe(999);
    expect(minor("  9.99  ")).toBe(999);
  });

  it("pads a short fraction", () => {
    expect(minor("9.")).toBe(900);
    expect(minor("9.5")).toBe(950);
  });

  it("handles a large but legitimate price", () => {
    expect(minor("9999.99")).toBe(999999);
  });
});

describe("parseMinor: refusals", () => {
  it("refuses an empty value with its own reason", () => {
    expect(parseMinor("")).toEqual({ ok: false, reason: "empty" });
    expect(parseMinor("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses a negative price", () => {
    expect(parseMinor("-1")).toEqual({ ok: false, reason: "negative" });
    expect(parseMinor("-0.01")).toEqual({ ok: false, reason: "negative" });
  });

  it("refuses anything that is not a number", () => {
    for (const input of ["abc", "9.9.9", "1e5", "9 99", "$9.99", "9..9", ".", "9,99,99"]) {
      expect(parseMinor(input).ok).toBe(false);
    }
  });

  it("refuses a thousands separator rather than guessing", () => {
    // "1,999" is ambiguous between one thousand nine hundred ninety nine and
    // one point nine nine nine. Guessing wrong misprices a tier by 1000x on a
    // charge the creator makes every month, so it is refused and they retype.
    expect(parseMinor("1,999")).toEqual({ ok: false, reason: "too_precise" });
    expect(parseMinor("1.999")).toEqual({ ok: false, reason: "too_precise" });
    expect(parseMinor("1.999.00").ok).toBe(false);
  });

  it("refuses an over-precise fraction rather than truncating or rounding it", () => {
    // Truncating "0.999" to 0.99 and rounding it to 1.00 are both silent
    // changes to what the creator typed. Refusing is the only option that
    // tells them something happened.
    expect(parseMinor("0.999")).toEqual({ ok: false, reason: "too_precise" });
    expect(parseMinor("9.996")).toEqual({ ok: false, reason: "too_precise" });
    expect(parseMinor("9.9999")).toEqual({ ok: false, reason: "too_precise" });
  });

  it("refuses an amount above the ceiling", () => {
    expect(parseMinor(String(MAX_MINOR_AMOUNT + 1))).toEqual({ ok: false, reason: "too_large" });
  });

  it("gives every refusal plain-language copy, with no jargon", () => {
    // PRD section 7.6 rule 4 and rule 6.
    for (const reason of ["empty", "not_a_number", "negative", "too_large", "too_precise"] as const) {
      const message = moneyErrorMessage(reason);

      expect(message.endsWith(".")).toBe(true);
      expect(message).not.toContain("_");
      expect(message[0]).toBe(message[0].toUpperCase());
    }
  });
});

describe("the exponent is a parameter, not an assumption", () => {
  it("handles a zero-decimal currency", () => {
    // JPY. Callers pass `currencyExponent("JPY")`, which is 0.
    const parsed = parseMinor("1500", 0);

    expect(parsed.ok && parsed.minor).toBe(1500);
    expect(formatMinorPlain(1500, 0)).toBe("1500");
  });

  it("handles a three-decimal currency", () => {
    // KWD.
    const parsed = parseMinor("1.234", 3);

    expect(parsed.ok && parsed.minor).toBe(1234);
    expect(formatMinorPlain(1234, 3)).toBe("1.234");
  });
});

describe("formatMinorPlain", () => {
  it("round trips through parseMinor", () => {
    // The property that matters: the value shown in an editable field must be
    // parseable back to the same minor amount, or editing a tier changes its
    // price by saving it unchanged.
    for (const amount of [0, 1, 7, 99, 100, 999, 1250, 999999]) {
      expect(minor(formatMinorPlain(amount))).toBe(amount);
    }
  });

  it("pads so a value under one major unit still reads as a price", () => {
    expect(formatMinorPlain(0)).toBe("0.00");
    expect(formatMinorPlain(5)).toBe("0.05");
    expect(formatMinorPlain(50)).toBe("0.50");
  });

  it("adds no symbol and no grouping, because the output goes into an input", () => {
    const formatted = formatMinorPlain(123456);

    expect(formatted).toBe("1234.56");
    expect(formatted).not.toContain(",");
    expect(formatted).not.toContain("$");
  });
});

describe("formatMinorWithCurrency", () => {
  it("renders an amount a creator can read", () => {
    const formatted = formatMinorWithCurrency(999, "USD");

    expect(formatted).toContain("9.99");
  });

  it("falls back to the number rather than throwing on an unknown code", () => {
    // An unknown currency code makes Intl throw. A member row has to render
    // either way, and showing the number beats crashing the table.
    const formatted = formatMinorWithCurrency(999, "NOTACODE");

    expect(formatted).toContain("9.99");
    expect(formatted).toContain("NOTACODE");
  });

  it("renders zero rather than an empty string", () => {
    expect(formatMinorWithCurrency(0, "USD")).toMatch(/0/);
  });
});
