/**
 * Canvas components import only what Framer's code runtime provides.
 *
 * Framer compiles each code file alone and resolves only `react`,
 * `react-dom`, and `framer`. Any other bare specifier is a module error
 * ("Unable to resolve specifier 'lucide-react'"), the file never loads, and
 * Add to canvas stalls on it. This list once allowed `lucide-react`, on the
 * belief that Framer bundled a copy; on 2026-10-28 every component using it
 * failed that way, so icons are inline svg (test/canvasIcons.test.ts).
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "src", "canvas-components");

const FRAMER_PROVIDED = new Set(["react", "react-dom", "framer"]);

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/^\s*import\s[\s\S]*?\sfrom\s*"([^"]+)"/gm), ...source.matchAll(/^\s*import\s*"([^"]+)"/gm)].map(
    (match) => match[1]!
  );
}

describe("canvas component imports", () => {
  const files = readdirSync(DIR).filter((name) => name.endsWith(".tsx"));

  it.each(files)("%s imports only what Framer provides", (file) => {
    const specifiers = importSpecifiers(readFileSync(path.join(DIR, file), "utf8"));
    expect(specifiers.filter((specifier) => !FRAMER_PROVIDED.has(specifier))).toEqual([]);
  });

  it("catches a lucide-react import", () => {
    expect(importSpecifiers('import { Lock } from "lucide-react";\n')).toEqual(["lucide-react"]);
  });
});
