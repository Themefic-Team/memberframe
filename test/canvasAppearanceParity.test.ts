/**
 * The shared appearance block, held identical across the four canvas
 * components and executed, not just read.
 *
 * Every canvas component carries a copy of the block between
 * `@memberframe-appearance-start` and `@memberframe-appearance-end`, because
 * Framer compiles each file alone on the creator's site and none of them can
 * import from this repository. Same arrangement as the password policy and the
 * profile field rules, and for the same reason.
 *
 * Unlike those parity tests, this one also runs the code. The block is
 * transpiled with TypeScript and evaluated with a stub `ControlType`, so the
 * sanitizers are proved against real injection attempts rather than by
 * reading their source. Their output lands inside a `<style>` element on a
 * creator's published page, so that is the part worth proving.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "src", "canvas-components");

const COMPONENTS = {
  MemberAuth: { labels: "AUTH_LABELS", root: ".memberframe-auth-root" },
  MemberDashboard: { labels: "DASH_LABELS", root: ".mf-dash" },
  MemberPricing: { labels: "PRICING_LABELS", root: ".mf-pricing" },
  MeteredPaywall: { labels: "METER_LABELS", root: ".mf-meter" },
  ProtectedDownload: { labels: "DOWNLOAD_LABELS", root: ".mf-download" },
  BookmarkButton: { labels: "BOOKMARK_LABELS", root: ".mf-bookmark" },
  BookmarksTray: { labels: "TRAY_LABELS", root: ".mf-tray" },
} as const;

type ComponentName = keyof typeof COMPONENTS;
const NAMES = Object.keys(COMPONENTS) as ComponentName[];

const sources: Record<ComponentName, string> = Object.fromEntries(
  NAMES.map((name) => [name, readFileSync(path.join(DIR, `${name}.tsx`), "utf-8")])
) as Record<ComponentName, string>;

const START = "// @memberframe-appearance-start";
const END = "// @memberframe-appearance-end";

function block(source: string): string {
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  if (start === -1 || end === -1) throw new Error("appearance markers missing");
  return source.slice(start, end + END.length);
}

/** Everything outside the shared block. */
function outside(source: string): string {
  return source.replace(block(source), "");
}

// ---------------------------------------------------------------------------
// Compile and load the block once.
// ---------------------------------------------------------------------------

interface Block {
  mfSafeColor(value: unknown, fallback: string): string;
  mfNumber(value: unknown, min: number, max: number, fallback: number): number;
  mfFontFamily(font: unknown): string | null;
  mfThemeClass(theme: unknown): string;
  mfFill(template: string, values: Record<string, string | number>): string;
  mfLabel(labels: unknown, defaults: Record<string, readonly [string, string]>, key: string): string;
  mfAppearanceVars(input: Record<string, unknown>): string;
  mfThemeCss(root: string): string;
  mfAppearanceControls(defaults: { padding: number; gap: number; shadow: boolean }): Record<
    string,
    Record<string, unknown>
  >;
  mfLabelControls(defaults: Record<string, readonly [string, string]>): Record<string, unknown>;
  mfBox(value: unknown, max: number): [number, number, number, number] | null;
  mfSpacingCss(spacing: Record<string, unknown> | null | undefined): string;
  mfStyleScope(prefix: string, rule: string): { scope: string; css: string };
  MF_SCOPE_SLOT: string;
}

const ControlType = {
  Enum: "enum",
  String: "string",
  Number: "number",
  Boolean: "boolean",
  Color: "color",
  Object: "object",
  Font: "font",
  Padding: "padding",
};

function loadBlock(): Block {
  const js = ts.transpileModule(block(sources.MemberAuth), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText;

  const exported = [
    "mfSafeColor",
    "mfNumber",
    "mfFontFamily",
    "mfThemeClass",
    "mfFill",
    "mfLabel",
    "mfAppearanceVars",
    "mfThemeCss",
    "mfAppearanceControls",
    "mfLabelControls",
    "mfBox",
    "mfSpacingCss",
    "mfStyleScope",
    "MF_SCOPE_SLOT",
  ];

  // eslint-disable-next-line no-new-func
  const factory = new Function("ControlType", `${js}\nreturn { ${exported.join(", ")} };`);
  return factory(ControlType) as Block;
}

const mf = loadBlock();

// ---------------------------------------------------------------------------

describe("the shared block is one block", () => {
  it("is byte-identical in every component", () => {
    const reference = block(sources.MemberAuth);
    for (const name of NAMES) {
      expect(block(sources[name]), name).toBe(reference);
    }
  });

  it("names no component, so it cannot quietly fork", () => {
    const text = block(sources.MemberAuth);
    for (const name of NAMES) expect(text).not.toContain(`${name}(`);
  });
});

describe("mfSafeColor", () => {
  it("accepts every notation a Color control can produce", () => {
    for (const colour of [
      "#fff",
      "#5271ff",
      "#5271ffcc",
      "rgb(82, 113, 255)",
      "rgba(2, 8, 20, 1)",
      "hsl(230, 100%, 66%)",
      "hsla(230deg, 100%, 66%, 0.4)",
      "transparent",
      // A Framer colour style or variable, with and without a name comment.
      "var(--token-3c8c9d7e-1234, rgb(2, 8, 20))",
      'var(--token-3c8c9d7e-1234, rgb(2, 8, 20)) /* {"name":"Navy"} */',
      "var(--token-abc)",
    ]) {
      expect(mf.mfSafeColor(colour, "FALLBACK"), colour).toBe(colour.replace(/\s*\/\*[^*]*\*\/\s*$/, ""));
    }
  });

  it("refuses anything that could close a declaration or leave the style block", () => {
    for (const attack of [
      "red; } body { display: none } .x {",
      "#fff; background: url(https://evil.example.com)",
      "var(--x, red; } body {)",
      "var(--x, url(javascript:alert(1)))",
      "var(--x, expression(alert(1)))",
      "#fff /* comment */ ; }",
      "expression(alert(1))",
      "url(javascript:alert(1))",
      "</style><script>alert(1)</script>",
      "rgb(1, 2, 3)\\;",
      "red",
      "",
      `#${"f".repeat(200)}`,
    ]) {
      expect(mf.mfSafeColor(attack, "FALLBACK"), attack).toBe("FALLBACK");
    }
  });

  it("refuses non-strings", () => {
    for (const value of [undefined, null, 12, {}, ["#fff"]]) {
      expect(mf.mfSafeColor(value, "FALLBACK")).toBe("FALLBACK");
    }
  });
});

describe("mfFontFamily", () => {
  it("reads the family out of a Font control value or a string", () => {
    expect(mf.mfFontFamily({ fontFamily: '"Inter", "Inter Placeholder", sans-serif', fontWeight: 400 })).toBe(
      '"Inter", "Inter Placeholder", sans-serif'
    );
    expect(mf.mfFontFamily("Space Grotesk, sans-serif")).toBe("Space Grotesk, sans-serif");
  });

  it("refuses anything that is not a plain family list", () => {
    for (const attack of [
      "Inter; } body { display: none",
      "Inter</style>",
      "url(https://evil.example.com/font.woff)",
      "Inter\\",
      "",
      { fontFamily: 12 },
      null,
      undefined,
    ]) {
      expect(mf.mfFontFamily(attack), String(attack)).toBeNull();
    }
  });
});

describe("mfNumber, mfThemeClass, mfFill, mfLabel", () => {
  it("clamps numbers and falls back on junk", () => {
    expect(mf.mfNumber(50, 0, 24, 10)).toBe(24);
    expect(mf.mfNumber(-3, 0, 24, 10)).toBe(0);
    expect(mf.mfNumber("12", 0, 24, 10)).toBe(12);
    expect(mf.mfNumber("", 0, 24, 10)).toBe(10);
    expect(mf.mfNumber("1; }", 0, 24, 10)).toBe(10);
    expect(mf.mfNumber(Number.NaN, 0, 24, 10)).toBe(10);
  });

  it("maps a theme to a root class, defaulting to Light like the editor", () => {
    expect(mf.mfThemeClass("dark")).toBe("is-dark");
    expect(mf.mfThemeClass("auto")).toBe("is-auto");
    expect(mf.mfThemeClass("light")).toBe("is-light");
    expect(mf.mfThemeClass(undefined)).toBe("is-light");
    expect(mf.mfThemeClass("sepia")).toBe("is-light");
  });

  it("fills placeholders as plain text", () => {
    expect(mf.mfFill("Step {current} of {total}", { current: 2, total: 3 })).toBe("Step 2 of 3");
    expect(mf.mfFill("Continue with {provider}", { provider: "GitHub" })).toBe("Continue with GitHub");
  });

  it("uses the creator's label when typed, the default when empty", () => {
    const defaults = { signIn: ["Sign in button", "Sign in"] } as const;
    expect(mf.mfLabel({ signIn: "Log in" }, defaults, "signIn")).toBe("Log in");
    expect(mf.mfLabel({ signIn: "   " }, defaults, "signIn")).toBe("Sign in");
    expect(mf.mfLabel(undefined, defaults, "signIn")).toBe("Sign in");
    expect(mf.mfLabel({ signIn: 12 }, defaults, "signIn")).toBe("Sign in");
  });
});

describe("mfAppearanceVars", () => {
  const base = { accent: "#020814", radius: 10, radiusMax: 24, shadowByDefault: true };

  function vars(extra: Record<string, unknown> = {}): Record<string, string> {
    const out: Record<string, string> = {};
    for (const declaration of mf.mfAppearanceVars({ ...base, ...extra }).split(";")) {
      const [name, ...rest] = declaration.split(":");
      if (name.trim()) out[name.trim()] = rest.join(":").trim();
    }
    return out;
  }

  it("declares every variable, so a nested component cannot inherit an outer override", () => {
    expect(Object.keys(vars()).sort()).toEqual(
      [
        "--mf-accent",
        "--mf-radius",
        "--mf-on-accent",
        "--mf-surface",
        "--mf-text",
        "--mf-muted",
        "--mf-border",
        "--mf-field",
        "--mf-font",
        "--mf-text-scale",
        "--mf-pad",
        "--mf-gap",
        "--mf-border-width",
        "--mf-card-shadow",
      ].sort()
    );
  });

  it("applies the accent the creator picked, including a colour style", () => {
    expect(vars()["--mf-accent"]).toBe("#020814");
    expect(vars({ accent: "var(--token-x, rgb(2, 8, 20))" })["--mf-accent"]).toBe("var(--token-x, rgb(2, 8, 20))");
  });

  it("falls back to the brand accent and to theme defaults for unsafe values", () => {
    const out = vars({ accent: "red; } body {", colors: { surface: "x; }", text: "#111" } });
    expect(out["--mf-accent"]).toBe("#5271ff");
    expect(out["--mf-surface"]).toBe("initial");
    expect(out["--mf-text"]).toBe("#111");
  });

  it("leaves untouched groups at initial, so the theme defaults show", () => {
    const out = vars();
    for (const name of ["--mf-surface", "--mf-text", "--mf-font", "--mf-pad", "--mf-gap", "--mf-border-width"]) {
      expect(out[name], name).toBe("initial");
    }
    expect(out["--mf-text-scale"]).toBe("1");
  });

  it("uses a custom font only when Custom font is on", () => {
    const font = { fontFamily: '"Space Grotesk", sans-serif' };
    expect(vars({ typography: { customFont: false, font } })["--mf-font"]).toBe("initial");
    expect(vars({ typography: { customFont: true, font } })["--mf-font"]).toBe('"Space Grotesk", sans-serif');
  });

  it("clamps radius, layout, and text size", () => {
    const out = vars({ radius: 99, typography: { textScale: 400 }, layout: { padding: 500, gap: -4, borderWidth: 9 } });
    expect(out["--mf-radius"]).toBe("24px");
    expect(out["--mf-text-scale"]).toBe("1.6");
    expect(out["--mf-pad"]).toBe("64px");
    expect(out["--mf-gap"]).toBe("0px");
    expect(out["--mf-border-width"]).toBe("4px");
  });

  it("honours the Shadow toggle, and each component's default when it is untouched", () => {
    expect(vars({ layout: { shadow: false } })["--mf-card-shadow"]).toBe("none");
    expect(vars({ layout: { shadow: true } })["--mf-card-shadow"]).toBe("initial");
    expect(vars({ shadowByDefault: false })["--mf-card-shadow"]).toBe("none");
  });
});

describe("Spacing", () => {
  it("reads a Padding control value the way CSS shorthand does", () => {
    expect(mf.mfBox("24px", 400)).toEqual([24, 24, 24, 24]);
    expect(mf.mfBox("10px 20px", 400)).toEqual([10, 20, 10, 20]);
    expect(mf.mfBox("10px 20px 30px", 400)).toEqual([10, 20, 30, 20]);
    expect(mf.mfBox("120px 0px 80px 0px", 400)).toEqual([120, 0, 80, 0]);
    expect(mf.mfBox(16, 400)).toEqual([16, 16, 16, 16]);
    expect(mf.mfBox("900px", 400)).toEqual([400, 400, 400, 400]);
  });

  it("refuses anything that could leave the declaration", () => {
    for (const attack of [
      "10px; } body { display: none } .x {",
      "10px 10px 10px 10px 10px",
      "-20px",
      "10em",
      "calc(100vh)",
      "",
      "   ",
      null,
      undefined,
      {},
      Number.NaN,
      -4,
    ]) {
      expect(mf.mfBox(attack, 400), String(attack)).toBeNull();
    }
  });

  it("leaves the component's own spacing alone when untouched", () => {
    expect(mf.mfSpacingCss(undefined)).toBe("");
    expect(mf.mfSpacingCss({ margin: "0px", customPadding: false, padding: "24px" })).toBe("");
    expect(mf.mfAppearanceVars({ accent: "#000", radius: 8, radiusMax: 24, shadowByDefault: true })).not.toMatch(
      /margin|padding:/
    );
  });

  it("keeps a root's own centring for top and bottom margin, and fills between side margins", () => {
    // The root shrinks by its vertical margin, so it stays inside the frame Framer selects.
    expect(mf.mfSpacingCss({ margin: "120px 0px 80px 0px" })).toBe(
      "margin-top: 120px; margin-bottom: 80px; height: calc(100% - 200px);"
    );
    expect(mf.mfSpacingCss({ margin: "0px 16px" })).toBe("margin-left: 16px; margin-right: 16px; width: auto;");
  });

  it("applies padding only when Custom padding is on", () => {
    expect(mf.mfSpacingCss({ customPadding: false, padding: "8px" })).toBe("");
    expect(mf.mfSpacingCss({ customPadding: true, padding: "8px 16px" })).toBe("padding: 8px 16px 8px 16px;");
    expect(mf.mfSpacingCss({ customPadding: true, padding: "8px; }" })).toBe("");
  });

  it("reaches the scoped rule through mfAppearanceVars", () => {
    const out = mf.mfAppearanceVars({
      accent: "#000",
      radius: 8,
      radiusMax: 24,
      shadowByDefault: true,
      spacing: { margin: "40px 0px 0px 0px" },
    });
    expect(out.endsWith("margin-top: 40px; height: calc(100% - 40px);")).toBe(true);
  });
});

describe("mfThemeCss", () => {
  const css = mf.mfThemeCss(".x-root");

  it("is Light on the bare root, matching the Framer canvas", () => {
    const bare = css.slice(0, css.indexOf(".x-root.is-dark"));
    expect(bare).toContain("--mf-c-surface: var(--mf-surface, #ffffff)");
    expect(bare).toContain("color-scheme: light");
  });

  it("is Dark only by choice, or by the visitor's OS under Match visitor", () => {
    expect(css).toContain(".x-root.is-dark {");
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*\.x-root\.is-auto \{/);
    // The media query never applies to the bare root or to is-light.
    expect(css).not.toMatch(/@media \(prefers-color-scheme: dark\) \{\s*\.x-root \{/);
  });
});

describe("the shared controls", () => {
  const controls = mf.mfAppearanceControls({ padding: 24, gap: 14, shadow: true });

  it("offers Theme with Light as the default", () => {
    expect(controls.theme.defaultValue).toBe("light");
    expect(controls.theme.options).toEqual(["light", "dark", "auto"]);
  });

  it("groups Colors, Typography, Layout, and Spacing, with optional colours", () => {
    for (const group of ["colors", "typography", "layout", "spacing"]) expect(controls[group].type).toBe("object");
    const spacing = controls.spacing.controls as Record<string, Record<string, unknown>>;
    expect(spacing.margin).toMatchObject({ type: "padding", defaultValue: "0px" });
    expect(spacing.customPadding).toMatchObject({ type: "boolean", defaultValue: false });
    expect(spacing.padding.type).toBe("padding");
    const colours = controls.colors.controls as Record<string, Record<string, unknown>>;
    for (const key of ["surface", "text", "muted", "border", "field", "onAccent"]) {
      expect(colours[key].optional, key).toBe(true);
    }
  });

  it("builds one String control per label", () => {
    const labels = mf.mfLabelControls({ signIn: ["Sign in button", "Sign in"] });
    expect(labels.type).toBe("object");
    expect((labels.controls as Record<string, Record<string, unknown>>).signIn).toEqual({
      type: "string",
      title: "Sign in button",
      defaultValue: "Sign in",
    });
  });
});

// ---------------------------------------------------------------------------
// Each component uses the block the same way.
// ---------------------------------------------------------------------------

describe.each(NAMES)("%s", (name) => {
  const source = sources[name];
  const rest = outside(source);
  const { labels, root } = COMPONENTS[name];

  it("switches palette on the Theme control, never on the visitor's OS alone", () => {
    expect(rest).not.toContain("@media (prefers-color-scheme");
    expect(rest).toContain("mfThemeClass(theme)");
    expect(rest).toContain(`mfThemeCss("${root}")`);
    expect(rest).toMatch(/theme = "light"/);
  });

  it("is a fixed size by default, the Dashboard's height alone fitting its content", () => {
    expect(rest).toContain("@framerSupportedLayoutWidth any-prefer-fixed");
    // The Dashboard grows with its profile form (2026-10-20), so the page scrolls, not the panel.
    expect(rest).toContain(
      `@framerSupportedLayoutHeight ${name === "MemberDashboard" ? "any-prefer-auto" : "any-prefer-fixed"}`
    );
    expect(rest).toMatch(/@framerIntrinsicWidth \d+/);
    expect(rest).toMatch(/@framerIntrinsicHeight \d+/);
  });

  it("routes its accent and radius through the shared sanitizer", () => {
    expect(rest).toContain("mfAppearanceVars({");
    expect(rest).toMatch(/mfAppearanceVars\(\{[^}]*\blayout,\s*spacing,/);
    expect(rest).not.toMatch(/function safeColor\(/);
  });

  it("exposes Theme, Colors, Typography, Layout, and Labels in the sidebar", () => {
    expect(rest).toMatch(/\.\.\.mfAppearanceControls\(\{ padding: \d+, gap: \d+, shadow: (true|false) \}\)/);
    expect(rest).toContain(`labels: mfLabelControls(${labels})`);
  });

  it("only asks for labels it defines", () => {
    const mapStart = rest.indexOf(`const ${labels}: Record<string, readonly [string, string]> = {`);
    expect(mapStart).toBeGreaterThan(-1);
    const mapText = rest.slice(mapStart, rest.indexOf("\n};", mapStart));
    const defined = new Set([...mapText.matchAll(/^\s{2}([a-zA-Z]+): \[/gm)].map((match) => match[1]));

    const used = new Set<string>();
    for (const match of rest.matchAll(/\bt\("([a-zA-Z]+)"/g)) used.add(match[1]);
    for (const match of rest.matchAll(new RegExp(`mfLabel\\(labels, ${labels}, "([a-zA-Z]+)"\\)`, "g"))) {
      used.add(match[1]);
    }

    expect(used.size).toBeGreaterThan(0);
    for (const key of used) expect(defined.has(key), `${name} uses undefined label "${key}"`).toBe(true);
  });

  it("scales every font size with Text size", () => {
    const css = rest.slice(rest.indexOf("const cssContent = `"));
    const stylesheet = css.slice(0, css.indexOf("`;"));
    expect(stylesheet).not.toMatch(/font-size: \d+px;/);
  });
});

describe("style scope (no unstyled first paint on a published page)", () => {
  const rule = (accent: string) => `[data-x="${mf.MF_SCOPE_SLOT}"] { --mf-accent: ${accent}; }`;

  it("is the same every time for the same settings, so server and browser agree", () => {
    expect(mf.mfStyleScope("mfa", rule("#5271ff"))).toEqual(mf.mfStyleScope("mfa", rule("#5271ff")));
  });

  it("differs for different settings, so two instances do not overwrite each other", () => {
    expect(mf.mfStyleScope("mfa", rule("#5271ff")).scope).not.toBe(mf.mfStyleScope("mfa", rule("#ff0000")).scope);
  });

  it("writes the scope into the selector and leaves a CSS-safe name", () => {
    const { scope, css } = mf.mfStyleScope("mfa", rule("#5271ff"));
    expect(scope).toMatch(/^mfa[a-z0-9]+$/);
    expect(css).toBe(`[data-x="${scope}"] { --mf-accent: #5271ff; }`);
  });
});
