/**
 * A canvas file runs in Framer, not under Vite: it has no `import.meta.env`,
 * and Framer reports the read as an error in the file (it stopped Builder
 * inserts in a new project, 2026-10-27). The generator bakes the API address
 * into CONFIG instead, so no canvas source may read the Vite env.
 */

import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../src/canvas-components");

describe("canvas components and the Vite env", () => {
  const files = readdirSync(DIR).filter((name) => name.endsWith(".tsx"));

  it("finds the components", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it.each(files)("%s reads no import.meta", (file) => {
    const code = readFileSync(path.join(DIR, file), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/import\.meta/);
  });
});
