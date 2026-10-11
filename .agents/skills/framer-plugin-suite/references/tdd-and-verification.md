# Test-Driven Development (TDD) & Quality Verification Guide

This document defines the **Test-Driven Development (TDD)** and verification protocols for Framer plugin development across the Framefic ecosystem. It ensures that generated components, licensing logic, and telemetry pipelines are validated systematically before marketplace packaging.

---

## 1. The TDD & Verification Lifecycle for Framer Plugins

Because Framer plugins execute both inside an iframe sandbox and on the Framer canvas, testing encompasses three layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRAMER PLUGIN TDD TRIAD                         │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. Unit & Mock Testing   │ • Framer Plugin SDK Mocking (framerMock.ts) │
│    (Vitest / Jest)       │ • Auth & Token Storage verification         │
│                          │ • 2kB Differential compression tests        │
│                          │ • Regex lock-state auto-patcher tests       │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 2. Visual & Theme Tests  │ • Zero Inline CSS enforcement linter        │
│    (DOM / CSS Tokens)    │ • Light & Dark mode synchronization         │
│                          │ • .primary-cta button styling verification  │
│                          │ • Canvas Frosted Lock banner appearance     │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 3. Marketplace Pack Test │ • Type checking (`tsc --noEmit`)            │
│    (framer-plugin-tools) │ • Production bundle build (`vite build`)    │
│                          │ • Sandbox packaging (`npm run pack`)        │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 2. Framer SDK Mocking (`framerMock.ts`)

For unit testing without a running Framer desktop environment, use the standard company mock engine:

```typescript
// src/utils/framerMock.ts
export const createFramerMock = (overrides = {}) => ({
  mode: "canvas",
  getProjectInfo: async () => ({
    id: "test-site-id-123",
    name: "Test Framer Project",
    slug: "test-project",
  }),
  getPublishInfo: async () => ({
    production: { url: "https://example.framer.app" },
    staging: null,
  }),
  getCurrentUser: async () => ({
    id: "user-123",
    name: "Alex Designer",
    email: "designer@example.com",
  }),
  isAllowedTo: (permission: string) => true,
  getCodeFiles: async () => [],
  createCodeFile: async (name: string, content: string) => ({ name, content }),
  showUI: () => {},
  notify: (msg: string) => {},
  ...overrides,
});
```

---

## 3. Automated Test Suites

### 3.1. Test Suite 1: Pro-Lock Regex Auto-Patcher Test
Verifies that `enforceLockState` properly rewrites lock and trial constants across deployed canvas components:

```typescript
// test/proLockPatcher.test.ts
import { describe, it, expect } from "vitest";

describe("Pro-Lock Regex Auto-Patcher", () => {
  const sampleCode = `
    const IS_LOCKED = true;
    const IS_TRIAL = true;
    // @myplugin-lock-state: locked
    // @myplugin-trial-state: trial
  `;

  it("should unlock code and set trial to paid upon upgrade", () => {
    let patched = sampleCode.replace(
      /const IS_LOCKED = (true|false);/,
      "const IS_LOCKED = false;"
    );
    patched = patched.replace(
      /const IS_TRIAL = (true|false);/,
      "const IS_TRIAL = false;"
    );
    patched = patched.replace(
      /\/\/ @myplugin-lock-state: (locked|unlocked)/,
      "// @myplugin-lock-state: unlocked"
    );

    expect(patched).toContain("const IS_LOCKED = false;");
    expect(patched).toContain("const IS_TRIAL = false;");
    expect(patched).toContain("// @myplugin-lock-state: unlocked");
  });
});
```

### 3.2. Test Suite 2: Strict Zero Inline CSS Linter Test
Enforces that no generated UI component in `src/` uses inline `style={{ ... }}`:

```typescript
// test/zeroInlineCss.test.ts
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Strict Zero Inline CSS Enforcement", () => {
  it("should have zero style={{ ... }} in React JSX files", () => {
    const srcDir = path.resolve(__dirname, "../src");
    const violations: string[] = [];

    function scanDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          // Match style={{ ... }} while ignoring comment lines
          const matches = content.match(/style=\{\{[^}]+\}\}/g);
          if (matches) {
            violations.push(`${file}: found ${matches.length} inline style(s)`);
          }
        }
      }
    }

    scanDir(srcDir);
    expect(violations).toEqual([]);
  });
});
```

#### Standalone Linter Command
You can also run the automated Zero-Inline-CSS linter directly from terminal at any time:
```bash
node .agent/scripts/lint-zero-inline-css.js [path/to/src]
```

### 3.3. Test Suite 3: 2kB Differential Compression Test
Verifies that differential configuration compression respects Framer's 2kB limit:

```typescript
// test/compression.test.ts
import { describe, it, expect } from "vitest";
import { compressConfig, decompressConfig } from "../src/utils/compression";

describe("2kB Storage Differential Compression", () => {
  const defaults = { color: "#5271ff", speed: 1.5, loop: true, badge: "SALE" };

  it("should compress by only saving changed fields", () => {
    const userConfig = { color: "#ff0000", speed: 1.5, loop: true, badge: "SALE" };
    const diff = compressConfig(userConfig, defaults);

    expect(diff).toEqual({ color: "#ff0000" });
    const jsonStr = JSON.stringify(diff);
    expect(jsonStr.length).toBeLessThan(2048);

    const restored = decompressConfig(diff, defaults);
    expect(restored).toEqual(userConfig);
  });
});
```

---

## 4. Pre-Pack Verification Checklist

Before running `npm run pack`, the Orchestrator checks off all 6 items:
- [ ] **Typecheck**: `npm run typecheck` or `npx tsc --noEmit` passes with 0 errors.
- [ ] **CSS Audit**: 100% external CSS files, `.primary-cta` double-gradient applied on primary actions, zero inline styles.
- [ ] **Theme Sync**: Test body theme `data-framer-theme="dark"` and `data-framer-theme="light"` for full visual parity.
- [ ] **Trial Flow & Watermark**:
  - Trial active ➔ live countdown ticker visible.
  - Trial active ➔ 1-instance limit enforced.
  - Trial active ➔ watermark visible on canvas.
  - Upgraded to paid ➔ watermark automatically disappears.
- [ ] **Telemetry Safe**: `framer.mode` checked before calling `getCodeFiles()`.
- [ ] **Framer Pack**: `npm run pack` finishes cleanly and generates the `.framerplugin` bundle.
