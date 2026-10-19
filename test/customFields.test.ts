/**
 * Custom profile fields. Feature plan FP-09 section 5, PRD feature F16.
 *
 * The four things FP-09 section 5 asks this file to prove, in order:
 *
 *   1. Format rules: web addresses, phone numbers, numbers.
 *   2. A required field blocks submission with an error naming that field.
 *   3. Conditional fields appear and disappear as their parent changes.
 *   4. The metadata patch serializes cleanly and keeps UTF-8 intact.
 *
 * Plus the editor's rules, because a definition the server would refuse
 * should be caught before the round trip.
 *
 * Everything here runs against `src/utils/customFields.ts`. The two canvas
 * components carry copies, and `customFieldsParity.test.ts` proves the copies
 * are the same code, so these results hold for them too.
 */

import { describe, expect, it } from "vitest";
import {
  checkFieldValue,
  conditionParents,
  conditionProblem,
  definitionProblems,
  displayValue,
  hasDefinitionProblems,
  isFieldVisible,
  isPhoneLike,
  isSafeUrl,
  isValidFieldKey,
  keyFromLabel,
  moveDefinition,
  normalizeDefinitions,
  readDefinitions,
  removeDefinition,
  toSubmittedValue,
  validateProfile,
  type CustomFieldDefinition,
} from "../src/utils/customFields";

function field(over: Partial<CustomFieldDefinition>): CustomFieldDefinition {
  return {
    key: "company",
    label: "Company",
    type: "text",
    required: false,
    options: [],
    placeholder: "",
    order: 0,
    showWhen: null,
    ...over,
  };
}

/** The FP-09 section 3 example: an Agency gets asked its team size. */
const ROLE = field({
  key: "role",
  label: "Role",
  type: "select",
  required: true,
  options: ["Freelancer", "Agency"],
});
const TEAM = field({
  key: "team_size",
  label: "Team size",
  type: "number",
  required: true,
  showWhen: { key: "role", value: "Agency" },
});

// ============================================================================
// 1. FORMAT RULES
// ============================================================================

describe("format rules", () => {
  it("accepts http and https web addresses only", () => {
    expect(isSafeUrl("https://jordan.design")).toBe(true);
    expect(isSafeUrl("http://localhost:3000/work")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeUrl("jordan.design")).toBe(false);
  });

  it("refuses an over-long web address", () => {
    expect(isSafeUrl(`https://example.com/${"a".repeat(2100)}`)).toBe(false);
  });

  it("accepts the phone numbers people actually type, and refuses text", () => {
    for (const value of ["+14155550123", "+44 20 7946 0958", "415 (555) 0123", "415-555-0123"]) {
      expect(isPhoneLike(value)).toBe(true);
    }
    for (const value of ["call me", "123", "+"]) {
      expect(isPhoneLike(value)).toBe(false);
    }
  });

  it("refuses a number that opens with a parenthesis, which is the server's rule", () => {
    // Pinned rather than endorsed. FP-09 section 2 says E.164, the server's
    // pattern wants a digit after the optional plus, and the common US form
    // "(415) 555-0123" is therefore refused. Loosening it is a server change
    // first; the parity tests carry it to every copy.
    expect(isPhoneLike("(415) 555-0123")).toBe(false);
  });

  it("turns a number field's text into a number, and leaves non-numbers to be refused", () => {
    const years = field({ key: "years", label: "Years", type: "number" });
    expect(toSubmittedValue(years, "12")).toBe(12);
    expect(toSubmittedValue(years, " 3.5 ")).toBe(3.5);
    expect(toSubmittedValue(years, "")).toBe(null);
    expect(toSubmittedValue(years, "twelve")).toBe("twelve");
    expect(checkFieldValue(years, "twelve")).toEqual({ problem: "Years must be a number." });
  });

  it("bounds short text at 255 and long text at 2000", () => {
    const short = field({ type: "text" });
    const long = field({ key: "bio", label: "Bio", type: "textarea" });
    expect(checkFieldValue(short, "a".repeat(255))).toEqual({ value: "a".repeat(255) });
    expect(checkFieldValue(short, "a".repeat(256))).toEqual({ problem: "Company is too long." });
    expect(checkFieldValue(long, "a".repeat(2000))).toEqual({ value: "a".repeat(2000) });
    expect(checkFieldValue(long, "a".repeat(2001))).toEqual({ problem: "Bio is too long." });
  });

  it("refuses a dropdown value that is not one of its options", () => {
    expect(checkFieldValue(ROLE, "Hacker")).toEqual({ problem: "Role must be one of the options." });
    expect(checkFieldValue(ROLE, "Agency")).toEqual({ value: "Agency" });
  });

  it("trims text and treats an empty answer as no answer", () => {
    expect(checkFieldValue(field({}), "  Acme  ")).toEqual({ value: "Acme" });
    expect(checkFieldValue(field({}), "   ")).toEqual({ value: null });
  });
});

// ============================================================================
// 2. REQUIRED FIELDS BLOCK SUBMISSION
// ============================================================================

describe("required fields", () => {
  const company = field({ required: true });
  const portfolio = field({ key: "portfolio_url", label: "Portfolio URL", type: "url" });

  it("block submission with an error that names the field", () => {
    const result = validateProfile([company, portfolio], { company: "", portfolio_url: "" });

    expect(result.problems).toEqual({ company: "Company is required." });
  });

  it("report every problem at once, not only the first", () => {
    const result = validateProfile([company, portfolio], { portfolio_url: "not a url" });

    expect(Object.keys(result.problems).sort()).toEqual(["company", "portfolio_url"]);
  });

  it("let a valid form through with the values the server expects", () => {
    const result = validateProfile([company, portfolio], {
      company: " Acme Design Co ",
      portfolio_url: "https://jordan.design",
    });

    expect(result.problems).toEqual({});
    expect(result.metadata).toEqual({
      company: "Acme Design Co",
      portfolio_url: "https://jordan.design",
    });
  });

  it("treat a required checkbox as one that must be ticked", () => {
    const terms = field({ key: "terms", label: "Accept terms", type: "boolean", required: true });

    expect(validateProfile([terms], { terms: false }).problems).toEqual({
      terms: "Accept terms is required.",
    });
    expect(validateProfile([terms], { terms: true }).metadata).toEqual({ terms: true });
  });

  it("check only the keys it is given when asked to", () => {
    const result = validateProfile([company, portfolio], { portfolio_url: "bad" }, ["company"]);

    expect(Object.keys(result.problems)).toEqual(["company"]);
  });
});

// ============================================================================
// 3. CONDITIONAL FIELDS MOUNT AND UNMOUNT
// ============================================================================

describe("conditional fields", () => {
  it("are hidden until the parent holds the expected answer", () => {
    expect(isFieldVisible(TEAM, {})).toBe(false);
    expect(isFieldVisible(TEAM, { role: "Freelancer" })).toBe(false);
    expect(isFieldVisible(TEAM, { role: "Agency" })).toBe(true);
  });

  it("disappear again when the parent changes back", () => {
    const values: Record<string, string> = { role: "Agency" };
    expect(isFieldVisible(TEAM, values)).toBe(true);

    values["role"] = "Freelancer";
    expect(isFieldVisible(TEAM, values)).toBe(false);
  });

  it("match a checkbox parent by its on or off state", () => {
    const newsletter = field({ key: "newsletter", label: "Newsletter", type: "boolean" });
    const frequency = field({
      key: "frequency",
      label: "Frequency",
      type: "select",
      options: ["Weekly", "Monthly"],
      showWhen: { key: "newsletter", value: "true" },
    });

    expect(isFieldVisible(frequency, { newsletter: false })).toBe(false);
    expect(isFieldVisible(frequency, { newsletter: true })).toBe(true);
    expect(isFieldVisible(newsletter, {})).toBe(true);
  });

  it("do not block submission while hidden, even when required", () => {
    const result = validateProfile([ROLE, TEAM], { role: "Freelancer" });

    expect(result.problems).toEqual({});
    expect(result.metadata).toEqual({ role: "Freelancer" });
  });

  it("are required once shown, and send their value", () => {
    expect(validateProfile([ROLE, TEAM], { role: "Agency" }).problems).toEqual({
      team_size: "Team size is required.",
    });
    expect(validateProfile([ROLE, TEAM], { role: "Agency", team_size: "8" }).metadata).toEqual({
      role: "Agency",
      team_size: 8,
    });
  });

  it("do not send a stale answer the member can no longer see", () => {
    const result = validateProfile([ROLE, TEAM], { role: "Freelancer", team_size: "8" });

    expect(result.metadata).not.toHaveProperty("team_size");
  });
});

// ============================================================================
// 4. SERIALIZATION
// ============================================================================

describe("the metadata patch", () => {
  it("round trips UTF-8 through JSON intact", () => {
    const name = field({ key: "studio", label: "Studio" });
    const values = { studio: "Ateliê Ñandú, 東京デザイン, مرحبا, \u{1F3A8}" };

    const { metadata } = validateProfile([name], values);
    const wire = JSON.stringify({ metadata });
    const back = JSON.parse(wire) as { metadata: Record<string, string> };

    expect(back.metadata["studio"]).toBe(values.studio);
  });

  it("holds only JSON primitives, so nothing is lost on the way through", () => {
    const fields = [
      field({ key: "company" }),
      field({ key: "years", label: "Years", type: "number" }),
      field({ key: "vip", label: "VIP", type: "boolean" }),
    ];
    const { metadata } = validateProfile(fields, { company: "Acme", years: "4", vip: true });

    for (const value of Object.values(metadata)) {
      expect(["string", "number", "boolean"].includes(typeof value) || value === null).toBe(true);
    }
    expect(JSON.parse(JSON.stringify(metadata))).toEqual(metadata);
  });

  it("sends an explicit null for a cleared optional answer, which is how the server clears it", () => {
    expect(validateProfile([field({})], { company: "" }).metadata).toEqual({ company: null });
  });
});

// ============================================================================
// THE FIELD EDITOR
// ============================================================================

describe("field keys", () => {
  it("follow the server's pattern and refuse prototype keys", () => {
    expect(isValidFieldKey("portfolio_url")).toBe(true);
    expect(isValidFieldKey("Portfolio")).toBe(false);
    expect(isValidFieldKey("2fa")).toBe(false);
    expect(isValidFieldKey("a.b")).toBe(false);
    expect(isValidFieldKey("__proto__")).toBe(false);
    expect(isValidFieldKey("constructor")).toBe(false);
  });

  it("are derived from a label, unique, and always valid", () => {
    expect(keyFromLabel("Portfolio URL", [])).toBe("portfolio_url");
    expect(keyFromLabel("Company Name", ["company_name"])).toBe("company_name_2");
    expect(keyFromLabel("Café Région", [])).toBe("cafe_region");
    expect(keyFromLabel("  2nd   Address!  ", [])).toBe("nd_address");
    expect(keyFromLabel("東京", [])).toBe("field");
    expect(isValidFieldKey(keyFromLabel("constructor", []))).toBe(true);
  });
});

describe("definitionProblems", () => {
  it("is empty for a sound list", () => {
    expect(hasDefinitionProblems(definitionProblems([ROLE, TEAM]))).toBe(false);
  });

  it("names an empty label, a bad key, and a duplicate key", () => {
    const problems = definitionProblems([
      field({ label: " " }),
      field({ key: "Bad Key" }),
      field({ key: "company" }),
    ]);

    expect(problems[0]?.label).toBeDefined();
    expect(problems[1]?.key).toBeDefined();
    expect(problems[2]?.key).toBe("Field 1 already uses this key.");
  });

  it("requires a dropdown to have distinct, non-empty options", () => {
    const base = field({ type: "select" });

    expect(definitionProblems([{ ...base, options: [] }])[0]?.options).toBeDefined();
    expect(definitionProblems([{ ...base, options: ["A", ""] }])[0]?.options).toBeDefined();
    expect(definitionProblems([{ ...base, options: ["A", "A"] }])[0]?.options).toBeDefined();
    expect(definitionProblems([{ ...base, options: ["A", "B"] }])[0]).toEqual({});
  });
});

describe("conditionProblem", () => {
  it("refuses a parent below the child", () => {
    expect(conditionProblem([TEAM, ROLE], 0)).toBe("A field can only depend on a field above it.");
  });

  it("refuses a parent that no longer exists", () => {
    expect(conditionProblem([TEAM], 0)).toBe("The field this depends on no longer exists.");
  });

  it("refuses a chain of conditions", () => {
    const chained = field({ key: "seats", label: "Seats", showWhen: { key: "team_size", value: "8" } });
    expect(conditionProblem([ROLE, TEAM, chained], 2)).toBe(
      "A field cannot depend on a field that is itself conditional."
    );
  });

  it("refuses a text parent and an option the parent does not have", () => {
    const text = field({ key: "company" });
    const child = field({ key: "x", label: "X", showWhen: { key: "company", value: "Acme" } });
    expect(conditionProblem([text, child], 1)).toBe("A field can only depend on a dropdown or a checkbox.");

    const wrong = { ...TEAM, showWhen: { key: "role", value: "Enterprise" } };
    expect(conditionProblem([ROLE, wrong], 1)).toBe(
      "Choose one of the options of the dropdown this depends on."
    );
  });

  it("offers as parents exactly the fields it would accept", () => {
    const text = field({ key: "company" });
    const parents = conditionParents([text, ROLE, TEAM, field({ key: "later" })], 3);
    expect(parents.map((entry) => entry.key)).toEqual(["role"]);
  });
});

describe("editing the list", () => {
  it("makes dependants always shown when their parent is removed", () => {
    const next = removeDefinition([ROLE, TEAM], 0);

    expect(next).toHaveLength(1);
    expect(next[0]?.showWhen).toBeNull();
    expect(hasDefinitionProblems(definitionProblems(next))).toBe(false);
  });

  it("refuses to move a dependant above its parent", () => {
    const next = moveDefinition([ROLE, TEAM], 1, -1);
    expect(next.map((entry) => entry.key)).toEqual(["role", "team_size"]);
  });

  it("moves freely when no condition is involved", () => {
    const next = moveDefinition([field({ key: "a" }), field({ key: "b" })], 0, 1);
    expect(next.map((entry) => entry.key)).toEqual(["b", "a"]);
  });

  it("numbers order from position and clears options on non-dropdowns when saving", () => {
    const saved = normalizeDefinitions([
      field({ key: "a", order: 9, options: ["left over"], label: " A " }),
      { ...ROLE, order: 3 },
    ]);

    expect(saved.map((entry) => entry.order)).toEqual([0, 1]);
    expect(saved[0]?.options).toEqual([]);
    expect(saved[0]?.label).toBe("A");
    expect(saved[1]?.options).toEqual(["Freelancer", "Agency"]);
  });

  it("reads a malformed document as no fields rather than throwing", () => {
    expect(readDefinitions(undefined)).toEqual([]);
    expect(readDefinitions("nope")).toEqual([]);
    expect(readDefinitions([{ key: 1 }, { key: "a", label: "A", type: "weird" }])).toEqual([]);
    expect(readDefinitions([{ key: "a", label: "A", type: "text" }])).toHaveLength(1);
  });
});

// ============================================================================
// ONBOARDING
// ============================================================================

describe("displayValue", () => {
  it("never shows a raw boolean or a null to the creator", () => {
    const vip = field({ key: "vip", type: "boolean" });
    expect(displayValue(vip, true)).toBe("Yes");
    expect(displayValue(vip, false)).toBe("No");
    expect(displayValue(field({}), null)).toBe("Not answered");
    expect(displayValue(field({}), undefined)).toBe("Not answered");
    expect(displayValue(field({ type: "number" }), 8)).toBe("8");
  });
});
