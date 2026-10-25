/**
 * The design lint's icon rules (12 to 14) and its @font-face allowance catch
 * what they should, on planted files in a throwaway folder.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const LINT = path.join(process.cwd(), ".agents", "scripts", "lint-design-system.js");
const root = mkdtempSync(path.join(tmpdir(), "mf-lint-"));

function lint(files: Record<string, string>): { code: number | null; out: string } {
  const dir = mkdtempSync(path.join(root, "case-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  const run = spawnSync(process.execPath, [LINT, dir], { encoding: "utf8" });
  return { code: run.status, out: `${run.stdout}${run.stderr}` };
}

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("design lint, icons", () => {
  it("rejects a typed glyph, even in the billing screens", () => {
    const result = lint({ "components/billing/Paid.tsx": 'export const A = () => <span>✓ Paid</span>;\n' });
    expect(result.code).toBe(1);
    expect(result.out).toContain("typed glyph as an icon");
  });

  it("rejects a hand-drawn svg in a panel component", () => {
    const result = lint({ "components/manage/Row.tsx": 'export const A = () => <svg viewBox="0 0 24 24"><path d="M0 0" /></svg>;\n' });
    expect(result.code).toBe(1);
    expect(result.out).toContain("hand-drawn svg");
  });

  it("rejects a numeric size on a Lucide icon", () => {
    const result = lint({
      "components/ui/Thing.tsx": 'import { Check } from "lucide-react";\nexport const A = () => <Check size={12} />;\n',
    });
    expect(result.code).toBe(1);
    expect(result.out).toContain("numeric size on Lucide <Check>");
  });

  it("accepts Lucide icons sized by CSS, and the allowed brand marks", () => {
    const result = lint({
      "components/ui/Thing.tsx": 'import { Check } from "lucide-react";\nexport const A = () => <Check className="x" aria-hidden={true} />;\n',
      "components/providerMarks.tsx": 'export const B = () => <svg viewBox="0 0 24 24" />;\n',
    });
    expect(result.out).toContain("PASSED");
    expect(result.code).toBe(0);
  });
});

describe("design lint, glass", () => {
  it("rejects a literal blur, billing included, and accepts the glass tokens", () => {
    const bad = lint({ "styles/billing/modal.css": ".a {\n  backdrop-filter: blur(4px);\n}\n" });
    expect(bad.code).toBe(1);
    expect(bad.out).toContain("backdrop-filter must be blur(var(--px-glass-blur");
    const ok = lint({
      "styles/tokens.css": "body {\n  --px-glass-blur-backdrop: 4px;\n}\n",
      "styles/kit.css": ".a {\n  -webkit-backdrop-filter: blur(var(--px-glass-blur-backdrop));\n  backdrop-filter: blur(var(--px-glass-blur-backdrop));\n}\n",
    });
    expect(ok.out).toContain("PASSED");
  });
});

describe("design lint, loading", () => {
  it("rejects loading text in a panel component, and accepts a skeleton's label", () => {
    const bad = lint({ "components/manage/Panel.tsx": 'export const A = () => <p className="x">Loading payments.</p>;\n' });
    expect(bad.code).toBe(1);
    expect(bad.out).toContain("loading text, show a <SkeletonList> instead");
    const ok = lint({ "components/manage/Panel.tsx": 'export const A = () => <SkeletonList label="Loading payments" />;\n' });
    expect(ok.out).toContain("PASSED");
  });
});

describe("design lint, legacy tokens", () => {
  it("rejects a legacy alias that has a Figma twin, and names the twin", () => {
    const result = lint({
      "styles/tokens.css": ":root {\n  --title: #fff;\n}\n",
      "styles/manage.css": ".a {\n  color: var(--title);\n}\n",
    });
    expect(result.code).toBe(1);
    expect(result.out).toContain("legacy token --title, use its Figma name (--framer-color-text)");
  });
});

describe("design lint, fonts", () => {
  it("allows a literal family and weight range inside @font-face only", () => {
    const ok = lint({ "styles/fonts.css": '@font-face {\n  font-family: "Inter";\n  font-weight: 100 900;\n}\n' });
    expect(ok.code).toBe(0);
    const bad = lint({ "styles/x.css": '.a {\n  font-family: "Inter";\n}\n' });
    expect(bad.code).toBe(1);
    expect(bad.out).toContain("font-family must be var");
  });
});
