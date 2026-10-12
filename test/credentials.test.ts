/**
 * Email and password rules, feature plan FP-02.
 *
 * These run against the real exported functions, which is why
 * `src/utils/credentials.ts` exists at all: the copy that actually serves
 * visitors lives inside `MemberAuth.tsx` and cannot be imported here.
 * `test/credentialsParity.test.ts` is what ties the two together.
 *
 * What these tests establish is that the rules say what FP-02 says they say.
 * They establish nothing about security. A policy enforced in a component that
 * ships to a browser is advice; the hash, the lockout, the rate limit, and a
 * breach-corpus check are the real defences and all four are server side.
 */

import { describe, expect, it } from "vitest";
import {
  COMMON_PASSWORDS,
  EMAIL_FRAGMENT_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isAcceptablePassword,
  looksLikeEmail,
  passwordProblemMessage,
  passwordProblems,
  passwordScore,
  passwordScoreLabel,
  type PasswordProblem,
  type PasswordScore,
} from "../src/utils/credentials";

/** The three arguments in the order the component passes them. */
const problems = (password: string, email = "member@example.com", strong = true) =>
  passwordProblems(password, email, strong);

describe("looksLikeEmail", () => {
  it("accepts an ordinary address", () => {
    expect(looksLikeEmail("member@example.com")).toBe(true);
  });

  it("accepts the shapes a strict pattern usually breaks", () => {
    // Every one of these is a deliverable address. A client-side validator that
    // rejects them costs a real signup, and the only cost of accepting a bad
    // one is a wasted request.
    expect(looksLikeEmail("first.last+tag@sub.example.co.uk")).toBe(true);
    expect(looksLikeEmail("a_b-c@example.io")).toBe(true);
    expect(looksLikeEmail("'quoted'@example.com")).toBe(true);
  });

  it("trims before judging, because a pasted address carries whitespace", () => {
    expect(looksLikeEmail("  member@example.com  ")).toBe(true);
  });

  it("rejects what is obviously not an address", () => {
    expect(looksLikeEmail("")).toBe(false);
    expect(looksLikeEmail("member")).toBe(false);
    expect(looksLikeEmail("member@")).toBe(false);
    expect(looksLikeEmail("@example.com")).toBe(false);
    expect(looksLikeEmail("member@example")).toBe(false);
    expect(looksLikeEmail("member example@test.com")).toBe(false);
    expect(looksLikeEmail("two@at@example.com")).toBe(false);
  });

  it("rejects an address longer than the RFC limit", () => {
    expect(looksLikeEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("the length rule", () => {
  it("refuses anything under the minimum", () => {
    expect(problems("Short1")).toContain("too_short");
    expect(problems("Seven12")).toContain("too_short");
  });

  it("accepts exactly the minimum, so the boundary is inclusive", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(problems("Eight123")).toEqual([]);
  });

  it("refuses anything over the maximum", () => {
    // An upper bound is about CPU, not strength: Argon2id will hash a megabyte
    // if asked, and that is a cheap way to burn a server.
    expect(problems(`${"a".repeat(PASSWORD_MAX_LENGTH + 1)}1`)).toContain("too_long");
  });

  it("accepts exactly the maximum", () => {
    const atLimit = `${"a".repeat(PASSWORD_MAX_LENGTH - 1)}1`;
    expect(atLimit.length).toBe(PASSWORD_MAX_LENGTH);
    expect(problems(atLimit)).toEqual([]);
  });

  it("counts the password as given, with no trimming", () => {
    // Trimming would mean registering one string and signing in with another.
    // A trailing space is part of the secret.
    expect(problems("  Pass12  ")).toEqual([]);
    expect("  Pass12  ".length).toBe(10);
  });
});

describe("the strength rule, which is optional", () => {
  it("requires a letter and a digit when it is on", () => {
    expect(problems("12345678")).toContain("needs_letter");
    expect(problems("abcdefgh")).toContain("needs_number");
  });

  it("asks for nothing beyond length when it is off", () => {
    // Not "12345678": that is on the common list, which applies either way.
    expect(problems("19283746", "member@example.com", false)).toEqual([]);
    expect(problems("abcdefgh", "member@example.com", false)).toEqual([]);
  });

  it("is satisfied by one letter and one digit, not a symbol zoo", () => {
    // Deliberately mild. NIST SP 800-63B advises against composition rules
    // because they produce `Password1!`, and FP-02 asks for the control anyway,
    // so the rule it enforces is the weakest one that still means something.
    expect(problems("abcdefg1")).toEqual([]);
  });

  it("accepts a passphrase with no digit only when strength is off", () => {
    expect(problems("correct horse battery staple")).toContain("needs_number");
    expect(problems("correct horse battery staple", "member@example.com", false)).toEqual([]);
  });
});

describe("the common-password rule", () => {
  it("refuses an entry on the list", () => {
    expect(problems("password123")).toContain("too_common");
  });

  it("is case insensitive, since capitalising does not help", () => {
    expect(problems("PASSWORD123")).toContain("too_common");
    expect(problems("Password123")).toContain("too_common");
  });

  it("only matches the whole value, not a substring", () => {
    // "password" appearing inside a longer phrase is not the guess this rule
    // is about, and refusing it would reject a reasonable passphrase.
    expect(problems("my-password-is-long-9")).not.toContain("too_common");
  });

  it("keeps the list short, because it ships inside the component", () => {
    // PRD section 14.2 P3 budgets 40kB gzipped per component. A real breach
    // corpus is gigabytes and belongs on the server.
    expect(COMMON_PASSWORDS.length).toBeLessThanOrEqual(40);
    expect(COMMON_PASSWORDS.length).toBeGreaterThan(0);
  });

  it("holds only lowercase entries, which the lookup depends on", () => {
    // The check lowercases the input and compares. An uppercase entry would be
    // unreachable, so the list would silently stop protecting that value.
    for (const entry of COMMON_PASSWORDS) {
      expect(entry).toBe(entry.toLowerCase());
    }
  });

  it("holds no entry shorter than the minimum length", () => {
    // A shorter entry could never be reported as too_common, because too_short
    // already applies. It would be dead weight in the bundle.
    for (const entry of COMMON_PASSWORDS) {
      expect(entry.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    }
  });
});

describe("the email-in-password rule", () => {
  it("refuses a password containing the local part", () => {
    expect(problems("jordan2024!", "jordan@example.com")).toContain("contains_email");
  });

  it("is case insensitive in both directions", () => {
    expect(problems("JORDAN2024", "jordan@example.com")).toContain("contains_email");
    expect(problems("jordan2024", "JORDAN@example.com")).toContain("contains_email");
  });

  it("ignores the domain, which is shared by every colleague", () => {
    // Half a company has the same domain. Refusing it would reject "example"
    // for everyone at example.com, which is noise rather than protection.
    expect(problems("example12", "jordan@example.com")).not.toContain("contains_email");
  });

  it("does not fire on a local part shorter than the floor", () => {
    expect(EMAIL_FRAGMENT_MIN_LENGTH).toBe(3);
    // Without the floor, "jogging2024" would be refused for jo@example.com.
    expect(problems("jogging2024", "jo@example.com")).not.toContain("contains_email");
  });

  it("fires at exactly the floor length", () => {
    expect(problems("joe-is-great1", "joe@example.com")).toContain("contains_email");
  });

  it("tolerates an email with no at sign without throwing", () => {
    // The field is validated separately and a visitor types in any order, so
    // this function is called with half-typed addresses constantly.
    expect(() => problems("anything1", "jordan")).not.toThrow();
    expect(problems("jordanxx1", "jordan")).toContain("contains_email");
  });

  it("tolerates an empty email", () => {
    expect(problems("Valid123", "")).toEqual([]);
  });
});

describe("problems are reported together, not one at a time", () => {
  it("returns every broken rule", () => {
    // A form that fixes one problem and immediately reveals another reads as
    // though it is inventing rules. All of them at once is kinder.
    const all = problems("jordan", "jordan@example.com");
    expect(all).toContain("too_short");
    expect(all).toContain("needs_number");
    expect(all).toContain("contains_email");
  });

  it("returns an empty array for an acceptable password", () => {
    expect(problems("Tr0ubadour-sprocket")).toEqual([]);
  });

  it("never returns a duplicate", () => {
    const all = problems("");
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("isAcceptablePassword", () => {
  it("agrees with the problem list in both directions", () => {
    const cases = ["", "short", "12345678", "Valid123", "password123", "Tr0ubadour"];

    for (const candidate of cases) {
      expect(isAcceptablePassword(candidate, "member@example.com", true)).toBe(
        problems(candidate).length === 0
      );
    }
  });
});

describe("passwordScore", () => {
  it("is zero for an empty value", () => {
    expect(passwordScore("")).toBe(0);
  });

  it("is zero for a listed common password however long", () => {
    // Length is normally the main input, which would otherwise score
    // "1234567890" above a short random string. A known guess scores nothing.
    expect(passwordScore("1234567890")).toBe(0);
    expect(passwordScore("password123")).toBe(0);
  });

  it("rises with length", () => {
    const eight = passwordScore("abcdefg1");
    const twelve = passwordScore("abcdefghijk1");
    const sixteen = passwordScore("abcdefghijklmno1");

    expect(twelve).toBeGreaterThan(eight);
    expect(sixteen).toBeGreaterThan(twelve);
  });

  it("rewards variety, but only at three character classes or more", () => {
    expect(passwordScore("abcdefgh1")).toBeLessThan(passwordScore("Abcdefgh1"));
  });

  it("never leaves the zero to four range", () => {
    const cases = ["", "a", "abcdefg1", "A".repeat(200), "Tr0ubadour-sprocket-horse!"];

    for (const candidate of cases) {
      const score = passwordScore(candidate);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    }
  });

  it("reaches the top of the range for a real passphrase", () => {
    expect(passwordScore("Tr0ubadour-sprocket-horse")).toBe(4);
  });
});

describe("the copy never shows a raw enum value", () => {
  const everyProblem: PasswordProblem[] = [
    "too_short",
    "too_long",
    "needs_letter",
    "needs_number",
    "contains_email",
    "too_common",
  ];

  it("has a sentence for every problem", () => {
    // PRD section 7.6 rule 4. An exhaustive switch means a new problem added
    // without copy fails tsc rather than rendering "needs_number" at a visitor.
    for (const problem of everyProblem) {
      const message = passwordProblemMessage(problem);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain("_");
    }
  });

  it("puts the real numbers in the length messages", () => {
    expect(passwordProblemMessage("too_short")).toContain(String(PASSWORD_MIN_LENGTH));
    expect(passwordProblemMessage("too_long")).toContain(String(PASSWORD_MAX_LENGTH));
  });

  it("has a label for every score", () => {
    const scores: PasswordScore[] = [0, 1, 2, 3, 4];

    for (const score of scores) {
      expect(passwordScoreLabel(score).length).toBeGreaterThan(0);
    }
  });

  it("uses no em-dash or en-dash in any message", () => {
    const text = [
      ...everyProblem.map(passwordProblemMessage),
      ...([0, 1, 2, 3, 4] as PasswordScore[]).map(passwordScoreLabel),
    ].join(" ");

    expect(text).not.toMatch(new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]"));
  });
});
