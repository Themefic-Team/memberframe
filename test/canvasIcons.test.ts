/**
 * Canvas icons are Lucide icons (design-system.md section 12).
 *
 * A canvas component can import nothing (Framer compiles each file alone, and
 * an npm import would load from a CDN), so its icons are inline svg. Each one
 * is tagged: `data-lucide="<name>"` must draw exactly that Lucide icon, at the
 * version this repository installs; `data-brand` marks a logo Lucide does not
 * have (the Framefic mark, the sign-in providers). An untagged svg fails.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "src", "canvas-components");
const LUCIDE = path.join(process.cwd(), "node_modules", "lucide-react", "dist", "esm", "icons");

type IconNode = Array<[string, Record<string, string>]>;

/** Lucide's own element list for an icon, without React keys. */
function lucide(name: string): IconNode {
  const source = readFileSync(path.join(LUCIDE, `${name}.js`), "utf8");
  const body = source.slice(source.indexOf("["), source.lastIndexOf("]") + 1);
  // The file's array literal, evaluated: plain strings and objects only.
  const node = new Function(`return ${body};`)() as IconNode;
  return node.map(([tag, attrs]) => {
    const { key: _key, ...rest } = attrs;
    return [tag, rest];
  });
}

/** The elements inside one inline svg, as tag and attributes. */
function children(inner: string): IconNode {
  return [...inner.matchAll(/<(\w+)\s+([^>]*?)\s*\/>/g)].map((match) => {
    const attrs: Record<string, string> = {};
    for (const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[attr[1]] = attr[2];
    return [match[1], attrs];
  });
}

interface InlineIcon {
  file: string;
  line: number;
  lucide: string | null;
  brand: string | null;
  inner: string;
}

function inlineIcons(): InlineIcon[] {
  const icons: InlineIcon[] = [];
  for (const file of readdirSync(DIR).filter((name) => name.endsWith(".tsx"))) {
    const source = readFileSync(path.join(DIR, file), "utf8");
    for (const match of source.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)) {
      icons.push({
        file,
        line: source.slice(0, match.index).split("\n").length,
        lucide: /data-lucide="([a-z0-9-]+)"/.exec(match[1])?.[1] ?? null,
        brand: /data-brand="([a-z]+)"/.exec(match[1])?.[1] ?? null,
        inner: match[2],
      });
    }
  }
  return icons;
}

describe("canvas icons", () => {
  const icons = inlineIcons();

  it("finds the icons", () => {
    expect(icons.length).toBeGreaterThan(20);
  });

  it("tags every inline svg as a Lucide icon or a brand mark", () => {
    const untagged = icons.filter((icon) => !icon.lucide && !icon.brand).map((icon) => `${icon.file}:${icon.line}`);
    expect(untagged).toEqual([]);
  });

  it("draws each Lucide icon exactly as Lucide does", () => {
    for (const icon of icons.filter((entry) => entry.lucide)) {
      expect(children(icon.inner), `${icon.file}:${icon.line} ${icon.lucide}`).toEqual(lucide(icon.lucide!));
    }
  });

  it("keeps brand marks to the Framefic mark and the sign-in providers", () => {
    const brands = new Set(icons.filter((icon) => icon.brand).map((icon) => icon.brand));
    expect([...brands].sort()).toEqual(["apple", "discord", "framefic", "github", "google"]);
  });
});
