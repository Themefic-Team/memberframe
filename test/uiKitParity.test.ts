/**
 * MemberFrame's tokens match the Framefic UI kit's (design-system.md section 1).
 *
 * The kit (`framefic-ui-kit/`, `@pixelfic/ui`) is the company's source of
 * truth and is git-ignored here: it is its own repository. When it is checked
 * out, every semantic token the kit declares must exist in our reference CSS
 * with the same value in both themes. Names differ by design: the kit's
 * `--px-space-8` is our `--space-8`, its `--px-color-text` is Framer's own
 * `--framer-color-text`. Without the kit folder the test skips and says so.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const KIT = path.join(ROOT, "framefic-ui-kit", "css", "tokens.css");
const OURS = path.join(ROOT, ".agents", "skills", "framer-plugin-suite", "references", "design-tokens.css");

type Decls = Record<string, string>;

function blocks(css: string): Array<{ selector: string; decls: Decls }> {
  const out: Array<{ selector: string; decls: Decls }> = [];
  for (const block of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls: Decls = {};
    for (const decl of block[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls[decl[1]!] = decl[2]!.trim();
    out.push({ selector: block[1]!.trim().replace(/\s+/g, " "), decls });
  }
  return out;
}

/** Follow var() to a value. A Framer runtime variable resolves to its fallback, as outside Framer. */
function resolve(map: Decls, value: string, depth = 0): string {
  if (depth > 20) return value;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g, (all, name: string, fallback?: string) => {
    if (name.startsWith("--framer-") && fallback !== undefined) return resolve(map, fallback.trim(), depth + 1);
    if (map[name] !== undefined) return resolve(map, map[name]!, depth + 1);
    return fallback !== undefined ? resolve(map, fallback.trim(), depth + 1) : all;
  });
}

function colour(value: string): string {
  const hex8 = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(value);
  const hex6 = /^#([0-9a-f]{6})$/i.exec(value);
  const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i.exec(value);
  const parts = hex8 ?? hex6;
  if (parts) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(parts[1]!.slice(i, i + 2), 16));
    const a = hex8 ? parseInt(hex8[2]!, 16) / 255 : 1;
    return `rgba(${r},${g},${b},${a.toFixed(2)})`;
  }
  if (rgba) return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${Number(rgba[4] ?? 1).toFixed(2)})`;
  return value.toLowerCase();
}

/** Formatting aside: numbers by value, colours as rgba, shadows by their parts. */
function canonical(value: string): string {
  const v = value.trim();
  if (/^[^,]*(\d+px|\b0)\s.*(rgba?\(|#)/i.test(v) || /^inset /.test(v)) {
    return v
      .split(/,(?![^(]*\))/)
      .map((shadow) => {
        const tokens: string[] = shadow.trim().match(/rgba?\([^)]*\)|#[0-9a-f]+|\S+/gi) ?? [];
        const inset = tokens.includes("inset");
        const paint = tokens.find((token) => /^(rgba?\(|#)/i.test(token)) ?? "";
        const lengths = tokens.filter((token) => token !== "inset" && token !== paint).map((token) => String(parseFloat(token)));
        while (lengths.length < 4) lengths.push("0");
        return `${inset ? "inset " : ""}${lengths.join(" ")} ${colour(paint)}`;
      })
      .join(", ");
  }
  if (/^(#|rgba?\()/i.test(v)) return colour(v);
  return v.replace(/-?\d*\.?\d+/g, (number) => String(Number(number))).replace(/\s+/g, " ").toLowerCase();
}

const TEXT: Record<string, string> = {
  "title-large": "title-lg",
  "title-medium": "title-md",
  "title-small": "title-sm",
  "body-large": "body-lg",
  "body-default": "body",
  "body-strong": "body-strong",
  "body-small": "body-sm",
  "body-small-strong": "body-sm-strong",
  "mono-default": "mono",
};
const FRAMER: Record<string, string> = {
  "--px-color-bg": "--framer-color-bg",
  "--px-color-bg-secondary": "--framer-color-bg-secondary",
  "--px-color-bg-tertiary": "--framer-color-bg-tertiary",
  "--px-color-divider": "--framer-color-divider",
  "--px-color-text": "--framer-color-text",
  "--px-color-text-secondary": "--framer-color-text-secondary",
  "--px-color-text-tertiary": "--framer-color-text-tertiary",
  "--px-color-text-reversed": "--framer-color-text-reversed",
  "--px-color-tint": "--framer-color-tint",
  "--px-color-tint-dark": "--framer-color-tint-dark",
  "--px-color-tint-extra-dark": "--framer-color-tint-extra-dark",
};

/** The kit's name for a token, as MemberFrame spells it. */
function ourName(kitName: string): string {
  let match: RegExpExecArray | null;
  if ((match = /^--px-space-(\d+)$/.exec(kitName))) return `--space-${match[1]}`;
  if ((match = /^--px-radius-(\w+)$/.exec(kitName))) return `--radius-${match[1]}`;
  if ((match = /^--px-text-([\w-]+?)(-tracking)?$/.exec(kitName)) && TEXT[match[1]!]) return `--text-${TEXT[match[1]!]}${match[2] ?? ""}`;
  if (kitName === "--px-font-sans") return "--font-sans";
  if (kitName === "--px-font-mono") return "--font-mono";
  return FRAMER[kitName] ?? kitName;
}

const PRIMITIVE = /^--px-(indigo|framer-blue|neutral|green|amber|red|alpha|emerald|violet|ai)-/;

describe.skipIf(!existsSync(KIT))("tokens match the Framefic UI kit", () => {
  const kit = blocks(readFileSync(KIT, "utf8"));
  const kitBase = Object.assign({}, ...kit.filter((b) => b.selector === ":root" || b.selector.includes('"pixelfic"')).map((b) => b.decls)) as Decls;
  const kitLight: Decls = { ...kitBase, ...kit.find((b) => b.selector.includes('"light"'))!.decls };
  const kitDark: Decls = { ...kitBase, ...kit.find((b) => b.selector === '[data-framer-theme="dark"]')!.decls };

  const ours = blocks(readFileSync(OURS, "utf8"));
  const dark = ours.find((b) => b.selector.startsWith(':root, html[data-user-theme="dark"] body'))!.decls;
  const light = ours.find((b) => b.selector.startsWith('body[data-framer-theme="light"]'))!.decls;
  const body = ours.find((b) => b.selector === "body")!.decls;
  const ourDark: Decls = { ...dark, ...body };
  const ourLight: Decls = { ...dark, ...light, ...body };

  const semantic = Object.keys(kitLight).filter((name) => !PRIMITIVE.test(name));

  it("declares every semantic kit token", () => {
    expect(semantic.length).toBeGreaterThan(80);
    expect(semantic.filter((name) => ourLight[ourName(name)] === undefined)).toEqual([]);
  });

  it.each([
    ["light", kitLight, ourLight],
    ["dark", kitDark, ourDark],
  ] as const)("gives each one the kit's value in the %s theme", (_theme, kitMap, ourMap) => {
    const differ = semantic
      .filter((name) => kitMap[name] !== undefined && ourMap[ourName(name)] !== undefined)
      .map((name) => ({ name, kit: canonical(resolve(kitMap, kitMap[name]!)), ours: canonical(resolve(ourMap, ourMap[ourName(name)]!)) }))
      .filter((entry) => entry.kit !== entry.ours);
    expect(differ).toEqual([]);
  });
});

describe.runIf(!existsSync(KIT))("without the kit checked out", () => {
  it("skips the parity check: framefic-ui-kit/ is its own repository and git-ignored here", () => {
    expect(existsSync(KIT)).toBe(false);
  });
});
