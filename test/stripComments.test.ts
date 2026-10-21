/**
 * The generator strips whole-line comments from what it writes into a Framer
 * project (utils/stripComments.ts). The proof that it removes only comments:
 * every component compiles to exactly the same JavaScript before and after.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { stripComments } from "../src/utils/stripComments";

const DIR = path.join(process.cwd(), "src", "canvas-components");
const COMPONENTS = readdirSync(DIR).filter((name) => name.endsWith(".tsx"));

const compile = (source: string) =>
  ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve, removeComments: true },
  })
    // JS comments are gone with removeComments; what is left between /* */ is a
    // CSS comment inside a style string, which the stripper may drop.
    .outputText.replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, "")
    .replace(/\n\s*\n/g, "\n");

describe("stripComments", () => {
  it("found the components", () => {
    expect(COMPONENTS.length).toBeGreaterThan(5);
  });

  for (const name of COMPONENTS) {
    it(`leaves ${name} compiling to the same code, and smaller`, () => {
      const source = readFileSync(path.join(DIR, name), "utf8");
      const stripped = stripComments(source);
      expect(compile(stripped)).toBe(compile(source));
      expect(stripped.length).toBeLessThan(source.length);
    });
  }

  it("keeps the plugin's markers and Framer's layout notes", () => {
    const source = readFileSync(path.join(DIR, "MemberAuth.tsx"), "utf8");
    const stripped = stripComments(source);
    for (const marker of ["// @memberframe-config-start", "// @memberframe-license-start", "// @plugin-lock-state", "@framerSupportedLayoutWidth"]) {
      expect(stripped, marker).toContain(marker);
    }
  });

  it("keeps a block that closes mid-line, and code inside strings", () => {
    const input = ["/* note */ const a = 1;", "/*", " * gone", " */", "// gone", 'const url = "https://example.com"; // tail kept', "const b = `", "// in a string? kept only as a line", "`;"].join("\n");
    const out = stripComments(input);
    expect(out).toContain("/* note */ const a = 1;");
    expect(out).not.toContain("gone");
    expect(out).toContain('const url = "https://example.com"; // tail kept');
  });
});
