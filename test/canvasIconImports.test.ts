/**
 * Canvas components import only icons Framer's own `lucide-react` provides.
 *
 * Framer resolves `lucide-react` to its bundled copy, not this repository's,
 * and that copy is older. Importing an icon it lacks is a module error
 * ("doesn't provide an export named"), the file never compiles, its exports
 * stay empty, and Add to canvas cannot insert it. `Sparkles` in Member
 * Pricing did exactly that.
 *
 * The list below is the icons seen working on a Framer canvas. Add to it only
 * after inserting a component that uses the new icon in Framer itself.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "src", "canvas-components");

const FRAMER_LUCIDE_ICONS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "Check",
  "CreditCard",
  "Crown",
  "Eye",
  "EyeOff",
  "Loader2",
  "Lock",
  "LogOut",
  "Mail",
  "MailCheck",
  "ShieldCheck",
  "User",
  "UserPlus",
]);

function lucideImports(source: string): string[] {
  const match = /import\s*\{([^}]*)\}\s*from\s*"lucide-react"/.exec(source);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((name) => name.trim().split(/\s+as\s+/)[0])
    .filter(Boolean);
}

describe("canvas component icons", () => {
  const files = readdirSync(DIR).filter((name) => name.endsWith(".tsx"));

  it.each(files)("%s imports only icons Framer provides", (file) => {
    const icons = lucideImports(readFileSync(path.join(DIR, file), "utf8"));
    const missing = icons.filter((icon) => !FRAMER_LUCIDE_ICONS.has(icon));
    expect(missing).toEqual([]);
  });
});
