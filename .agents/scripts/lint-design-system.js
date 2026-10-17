#!/usr/bin/env node
/**
 * Design System Linter for Pixelfic Framer plugins (Foundations v0.4.0).
 *
 * Enforces the mechanical half of .agents/rules/design-system.md so a rule
 * nobody remembers to read still cannot be broken silently.
 *
 * CSS (every .css under the target, except the verbatim reference slices):
 *   1. No colour literals: hex, rgb(), rgba(), hsl(). Use a token.
 *   2. font-size on the type scale: 11, 12, 14, 15, 20px.
 *   3. font-weight is 400, 500, or 600.
 *   4. border-radius literals on the radius scale: 0, 4, 6, 8, 10, 12, 14, 16, 20, 999px, 50%.
 *   5. padding, margin, gap literals on the spacing scale: 0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32px.
 *      (1px is allowed for hairline nudges.)
 *   6. Every var(--token) resolves to a custom property declared in some
 *      stylesheet under the target, or is a Framer runtime --framer-* variable.
 *   7. Brand primary (#5271FF) is never a text colour: 4.07:1 on white fails AA.
 *      Use --px-color-text-brand.
 *   8. font-family is a var(--font-*) token, never a literal stack.
 *   9. No text-transform: uppercase. Labels are sentence case.
 *
 * TS/TSX (every .ts and .tsx under the target):
 *  10. No unicode emoji or pictographs.
 *  11. No en-dash or em-dash characters, per instruction/INSTRUCTION.md.
 *
 * Usage:
 *   node .agents/scripts/lint-design-system.js [directory]
 */

import fs from "fs";
import path from "path";

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(process.cwd(), "src");

if (!fs.existsSync(targetDir)) {
  console.log(`[Design System Linter] Target directory "${targetDir}" does not exist. Skipping check.`);
  process.exit(0);
}

/* Verbatim slices of .agents/skills/framer-plugin-suite/references/design-tokens.css.
   They are governed by their provenance diff, not by this linter. */
const VERBATIM_SLICES = new Set([
  path.join("styles", "design-tokens.css"),
  path.join("styles", "components.css"),
  "App.css",
]);

const ignoreDirs = new Set(["node_modules", "dist", ".git", "build"]);

const FONT_SIZES = new Set([11, 12, 14, 15, 20]);
const FONT_WEIGHTS = new Set(["400", "500", "600", "inherit"]);
const RADII = new Set([0, 4, 6, 8, 10, 12, 14, 16, 20, 999]);
const SPACING = new Set([0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32]);

const cssFiles = [];
const codeFiles = [];
const declaredTokens = new Set();
const violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) walk(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".css") cssFiles.push(full);
      else if (ext === ".ts" || ext === ".tsx") codeFiles.push(full);
    }
  }
}

/** Blanks out comments but keeps line breaks, so line numbers stay true. */
function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

function report(file, line, rule, snippet) {
  violations.push({ file: path.relative(process.cwd(), file), line, rule, snippet: snippet.trim() });
}

function pxValues(value) {
  return [...value.matchAll(/(-?\d*\.?\d+)px/g)].map((m) => Math.abs(Number(m[1])));
}

walk(targetDir);

// Pass 1: every custom property declared anywhere, slices included.
for (const file of cssFiles) {
  const css = stripCssComments(fs.readFileSync(file, "utf8"));
  for (const match of css.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) declaredTokens.add(match[1]);
}

// Pass 2: CSS rules.
for (const file of cssFiles) {
  const rel = path.relative(targetDir, file);
  if (VERBATIM_SLICES.has(rel)) continue;

  const lines = stripCssComments(fs.readFileSync(file, "utf8")).split("\n");

  lines.forEach((line, index) => {
    const n = index + 1;
    const decl = line.match(/^\s*([a-z-]+)\s*:\s*(.+?);?\s*$/);

    if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\b(rgba?|hsla?)\(/.test(line)) {
      report(file, n, "colour literal, use a token", line);
    }

    for (const match of line.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
      const token = match[1];
      if (!declaredTokens.has(token) && !token.startsWith("--framer-")) {
        report(file, n, `unknown token ${token}`, line);
      }
    }

    if (!decl) return;
    const [, prop, value] = decl;

    if (prop === "font-size") {
      for (const px of pxValues(value)) {
        if (!FONT_SIZES.has(px)) report(file, n, `font-size ${px}px is off the type scale (11, 12, 14, 15, 20)`, line);
      }
    }

    if (prop === "font-weight" && !FONT_WEIGHTS.has(value.trim())) {
      report(file, n, "font-weight must be 400, 500, or 600", line);
    }

    if (prop === "border-radius" && !value.includes("var(")) {
      for (const px of pxValues(value)) {
        if (!RADII.has(px)) report(file, n, `radius ${px}px is off the radius scale`, line);
      }
    }

    if (/^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left))?$/.test(prop) && !value.includes("calc(")) {
      for (const px of pxValues(value)) {
        if (!SPACING.has(px)) report(file, n, `${prop} ${px}px is off the spacing scale`, line);
      }
    }

    if (prop === "color" && /var\(--(secondary-default|px-brand-primary|primary-default|accent-blue)\b/.test(value)) {
      report(file, n, "brand primary as text fails AA (4.07:1), use --px-color-text-brand", line);
    }

    if (prop === "font-family" && !/^var\(--font-/.test(value.trim()) && value.trim() !== "inherit") {
      report(file, n, "font-family must be var(--font-sans | --font-mono | --font-body)", line);
    }

    if (prop === "text-transform" && value.trim() === "uppercase") {
      report(file, n, "no uppercase labels, use sentence case", line);
    }
  });
}

// Pass 3: TS/TSX copy rules.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const DASHES = /[–—]/;

for (const file of codeFiles) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (EMOJI.test(line)) report(file, index + 1, "unicode emoji, use a Lucide icon", line);
    if (DASHES.test(line)) report(file, index + 1, "en-dash or em-dash, use a comma, colon, or new sentence", line);
  });
}

console.log(
  `[Design System Linter] Scanned ${cssFiles.length} stylesheets and ${codeFiles.length} source files in: ${targetDir}`,
);

if (violations.length > 0) {
  console.error(`\n[Design System Linter FAILED] ${violations.length} violation(s):\n`);
  violations.forEach((v, i) => {
    console.error(`  ${i + 1}. ${v.file}:${v.line}  ${v.rule}`);
    console.error(`     ${v.snippet}\n`);
  });
  console.error("RULES: .agents/rules/design-system.md");
  process.exit(1);
}

console.log("[Design System Linter PASSED] 0 violations.");
process.exit(0);
