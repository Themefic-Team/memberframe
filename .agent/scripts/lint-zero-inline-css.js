#!/usr/bin/env node
/**
 * Zero-Inline-CSS Linter for Company Framer Plugins
 *
 * Scans all JSX/TSX files in the project to enforce the Strict Zero Inline CSS Rule.
 * Rejects any occurrence of style={{ ... }} in React components.
 *
 * Usage:
 *   node .agent/scripts/lint-zero-inline-css.js [directory]
 */

import fs from "fs";
import path from "path";

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(process.cwd(), "src");

if (!fs.existsSync(targetDir)) {
  console.log(`[Zero-Inline-CSS Linter] Target directory "${targetDir}" does not exist. Skipping check.`);
  process.exit(0);
}

const fileExtensions = [".tsx", ".jsx", ".ts", ".js"];
const ignoreDirs = ["node_modules", "dist", ".git", "build"];

let totalFilesScanned = 0;
const violations = [];

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name)) {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (fileExtensions.includes(ext)) {
        scanFile(fullPath);
      }
    }
  }
}

function scanFile(filePath) {
  totalFilesScanned++;
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Regex targeting inline style={{ in JSX
  const inlineStyleRegex = /\bstyle\s*=\s*\{\{/;

  lines.forEach((line, index) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      return;
    }

    if (inlineStyleRegex.test(line)) {
      violations.push({
        file: path.relative(process.cwd(), filePath),
        line: index + 1,
        code: trimmed,
      });
    }
  });
}

console.log(`[Zero-Inline-CSS Linter] Scanning files in: ${targetDir}`);
scanDirectory(targetDir);

if (violations.length > 0) {
  console.error(`\n[Zero-Inline-CSS Linter FAILED] Found ${violations.length} inline CSS violation(s):\n`);
  violations.forEach((v, i) => {
    console.error(`  ${i + 1}. ${v.file}:${v.line}`);
    console.error(`     Snippet: ${v.code}\n`);
  });
  console.error("RULE: Never use inline style={{ ... }} in React JSX. All styles must reside in external .css files.");
  process.exit(1);
} else {
  console.log(`[Zero-Inline-CSS Linter PASSED] Successfully checked ${totalFilesScanned} files. 0 inline style violations found!`);
  process.exit(0);
}
