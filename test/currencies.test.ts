/**
 * The currency catalog. Every circulating currency, each with the decimal
 * places the gateways count it in, because an amount stored in the wrong minor
 * unit charges a buyer a hundred times too much or too little.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENCIES, CURRENCY_OPTIONS, currencyExponent, isCurrencyCode } from "../src/utils/currencies";
import { EMPTY_TIER_FORM_DRAFT, validateTierDraft, type TierFormDraft } from "../src/components/manage/tierValidation";

function draft(overrides: Partial<TierFormDraft> = {}): TierFormDraft {
  return { ...EMPTY_TIER_FORM_DRAFT, name: "Gold", key: "tier_2", rank: "2", monthlyPrice: "19.99", ...overrides };
}

describe("the catalog", () => {
  it("holds every currency once, as a three-letter code, sorted for type-ahead", () => {
    const codes = CURRENCIES.map((currency) => currency.code);

    expect(codes.length).toBeGreaterThan(150);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{3}$/);
    expect([...codes].sort()).toEqual(codes);
  });

  it("keeps the four currencies stored before the list grew", () => {
    for (const code of ["USD", "EUR", "GBP", "INR"]) expect(isCurrencyCode(code)).toBe(true);
  });

  it("leaves out withdrawn codes and funds", () => {
    for (const code of ["HRK", "BGN", "ANG", "ZWL", "CLF", "XAU", "XXX"]) expect(isCurrencyCode(code)).toBe(false);
  });

  it("gives each currency the decimal places a gateway charges it in", () => {
    expect(currencyExponent("USD")).toBe(2);
    expect(currencyExponent("JPY")).toBe(0);
    expect(currencyExponent("KRW")).toBe(0);
    expect(currencyExponent("ISK")).toBe(0);
    expect(currencyExponent("KWD")).toBe(3);
    expect(currencyExponent("TND")).toBe(3);
    // A code from before the list, or a typo in old data, keeps the old default.
    expect(currencyExponent("ZZZ")).toBe(2);
  });

  it("agrees with Intl on every currency it can check", () => {
    // Intl follows CLDR, which shows these with no decimals because their
    // smallest coins are out of use. ISO 4217 and Stripe still count them in
    // cents (fils for IQD), so amounts are stored that way. Anything else
    // disagreeing with Intl is a mistake in the catalog.
    const known = new Set(["AFN", "ALL", "COP", "HUF", "IDR", "IQD", "IRR", "KPW", "LAK", "LBP", "MMK", "PKR", "SOS", "SYP", "YER"]);
    for (const { code, exponent } of CURRENCIES) {
      if (known.has(code)) continue;
      const digits = new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits;
      expect(`${code} ${exponent}`).toBe(`${code} ${digits}`);
    }
  });

  it("labels each option code first", () => {
    expect(CURRENCY_OPTIONS.find((option) => option.value === "JPY")?.label).toBe("JPY, Japanese yen");
  });
});

describe("tier prices follow the tier's currency", () => {
  it("refuses decimals in a zero-decimal currency and says so plainly", () => {
    const result = validateTierDraft(draft({ currency: "JPY", monthlyPrice: "9.99" }), []);

    expect(result.errors.monthlyPrice).toBe("Use a whole number, with no decimal point.");
    expect(validateTierDraft(draft({ currency: "JPY", monthlyPrice: "1500" }), []).valid).toBe(true);
  });

  it("accepts a third decimal in a three-decimal currency only", () => {
    expect(validateTierDraft(draft({ currency: "KWD", monthlyPrice: "4.995" }), []).valid).toBe(true);
    expect(validateTierDraft(draft({ currency: "USD", monthlyPrice: "4.995" }), []).valid).toBe(false);
  });

});

describe("the canvas components carry the same exponents", () => {
  // They run on the creator's published site and may import nothing from the
  // plugin, so each holds its own copy of the two sets. This keeps them equal.
  const zero = CURRENCIES.filter((currency) => currency.exponent === 0).map((currency) => currency.code).sort();
  const three = CURRENCIES.filter((currency) => currency.exponent === 3).map((currency) => currency.code).sort();

  for (const file of ["MemberPricing.tsx", "MemberDashboard.tsx"]) {
    it(file, () => {
      const source = readFileSync(path.join(process.cwd(), "src", "canvas-components", file), "utf-8");
      const set = (name: string) =>
        [...(source.match(new RegExp(String.raw`const ${name} = new Set\(\[([^\]]*)\]`))?.[1] ?? "").matchAll(/"([A-Z]{3})"/g)]
          .map((match) => match[1])
          .sort();

      expect(set("ZERO_DECIMAL_CURRENCIES")).toEqual(zero);
      expect(set("THREE_DECIMAL_CURRENCIES")).toEqual(three);
    });
  }
});
