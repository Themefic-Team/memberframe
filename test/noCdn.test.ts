/**
 * No CDN: the build-time strip of remote CSS imports, and the inputs that
 * used to load Google Fonts. The built output itself is checked by
 * `npm run check:no-cdn` (.agents/scripts/check-no-cdn.js).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isRemoteImport, stripRemoteCssImports } from "../src/config/stripRemoteCssImports";

const read = (file: string) => readFileSync(path.resolve(__dirname, "..", file), "utf8");

describe("isRemoteImport", () => {
  it("is true for every way a stylesheet can point at another host", () => {
    expect(isRemoteImport('url("https://fonts.googleapis.com/css2?family=Inter")')).toBe(true);
    expect(isRemoteImport("url(https://fonts.googleapis.com/css2)")).toBe(true);
    expect(isRemoteImport('"http://example.com/a.css"')).toBe(true);
    expect(isRemoteImport("'//cdn.example.com/a.css' layer(x)")).toBe(true);
  });

  it("is false for the plugin's own stylesheets", () => {
    expect(isRemoteImport('"framer-plugin/framer.css" layer(framer)')).toBe(false);
    expect(isRemoteImport('"./fonts.css"')).toBe(false);
    expect(isRemoteImport('url("../fonts.css")')).toBe(false);
  });
});

describe("stripRemoteCssImports", () => {
  it("removes a remote import and keeps a local one", () => {
    const plugin = stripRemoteCssImports();
    const removed: string[] = [];
    const rule = (params: string) => ({ params, remove: () => removed.push(params) });
    plugin.AtRule.import(rule('url("https://fonts.googleapis.com/css2?family=Inter")'));
    plugin.AtRule.import(rule('"./fonts.css"'));
    expect(removed).toEqual(['url("https://fonts.googleapis.com/css2?family=Inter")']);
    expect(stripRemoteCssImports.postcss).toBe(true);
  });
});

describe("no font CDN in the sources", () => {
  it.each(["index.html", "src/styles/design-tokens.css", "src/styles/billing/theme.css", ".agents/skills/framer-plugin-suite/references/design-tokens.css"])(
    "%s does not load Google Fonts",
    (file) => {
      expect(read(file)).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
  );

  it("the panel font is Inter, not DM Sans", () => {
    expect(read("src/styles/design-tokens.css")).toMatch(/--font-body: var\(--font-sans\);/);
  });

  it("the bundled faces point at files that exist", () => {
    for (const file of ["src/styles/fonts.css", "src/styles/billing/fonts.css"]) {
      const css = read(file);
      const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(() => readFileSync(path.resolve(path.dirname(path.resolve(__dirname, "..", file)), url))).not.toThrow();
      }
    }
  });
});
