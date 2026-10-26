/**
 * Forms follow the Framefic UI kit (design-system.md section 8).
 *
 * A text input, select, or text area sits in a `Field`: label on top, control
 * full width, help under it. A checkbox, toggle, or segmented control sits in
 * a `Setting`: title left, control right. The connect and config forms open
 * in a `Sheet`, never an accordion. Read from source, like the other panel
 * structure tests.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src", "components");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "billing" ? [] : tsxFiles(full);
    return name.endsWith(".tsx") ? [full] : [];
  });
}

/** Each `<Tag ...>children</Tag>` in a file, with the first JSX element inside it. */
function blocks(source: string, tag: string): Array<{ child: string; line: number }> {
  const found: Array<{ child: string; line: number }> = [];
  const open = new RegExp(`<${tag}[\\s>]`, "g");
  for (const match of source.matchAll(open)) {
    const start = match.index!;
    const close = source.indexOf(`</${tag}>`, start);
    const selfClose = source.indexOf("/>", start);
    const tagEnd = source.indexOf(">", start);
    if (close === -1 || (selfClose !== -1 && selfClose < tagEnd)) continue;
    const inner = source.slice(source.indexOf(">", start) + 1, close);
    const child = /<([A-Z]\w*|[a-z]+)\b/.exec(inner)?.[1] ?? "";
    found.push({ child, line: source.slice(0, start).split("\n").length });
  }
  return found;
}

const INLINE_CONTROLS = new Set(["Checkbox", "Toggle", "Segmented"]);
const files = tsxFiles(SRC).filter((file) => !file.includes(`${path.sep}ui${path.sep}`));

describe("kit forms", () => {
  it("no FieldRow is left: Field or Setting", () => {
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/<FieldRows?[\s>]/);
  });

  it("every Setting holds a checkbox, a toggle, or a segmented control", () => {
    const wrong = files.flatMap((file) =>
      blocks(readFileSync(file, "utf8"), "Setting")
        .filter((block) => !INLINE_CONTROLS.has(block.child))
        .map((block) => `${path.basename(file)}:${block.line} <${block.child}>`)
    );
    expect(wrong).toEqual([]);
  });

  it("no Field holds a checkbox, a toggle, or a segmented control", () => {
    const wrong = files.flatMap((file) =>
      blocks(readFileSync(file, "utf8"), "Field")
        .filter((block) => INLINE_CONTROLS.has(block.child))
        .map((block) => `${path.basename(file)}:${block.line} <${block.child}>`)
    );
    expect(wrong).toEqual([]);
  });

  it("finds the forms it checks", () => {
    const count = (tag: string) => files.reduce((sum, file) => sum + blocks(readFileSync(file, "utf8"), tag).length, 0);
    expect(count("Field")).toBeGreaterThan(30);
    expect(count("Setting")).toBeGreaterThanOrEqual(5);
  });
});

describe("connect and config forms open in a sheet", () => {
  const CONFIG = [
    "settings/IntegrationCard.tsx",
    "settings/EmailSettings.tsx",
    "manage/PaymentsPanel.tsx",
    "settings/WebhooksPanel.tsx",
    "manage/TierEditor.tsx",
    "settings/CustomFieldsPanel.tsx",
  ];

  it.each(CONFIG)("%s opens a Sheet, with no accordion left", (file) => {
    const source = readFileSync(path.join(SRC, file), "utf8");
    expect(source).toContain("<Sheet");
    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).not.toContain("aria-expanded");
    // The accordion's open state on a card (a <details> disclosure inside a form is fine).
    expect(source).not.toMatch(/open && "is-open"/);
  });

  it("puts each sheet's primary action in its pinned footer", () => {
    for (const file of CONFIG) {
      const source = readFileSync(path.join(SRC, file), "utf8");
      const sheet = source.slice(source.indexOf("<Sheet"));
      const footer = sheet.slice(sheet.indexOf("footer={"), sheet.indexOf("\n        >"));
      expect(footer, file).toContain('variant="primary"');
    }
  });
});

describe("a sheet opening leaves the info tips closed", () => {
  it("focuses the first field, never an info tip's icon", () => {
    const sheet = readFileSync(path.join(SRC, "ui", "Sheet.tsx"), "utf8");
    expect(sheet).toContain('!node.closest(".info-tip")');
    expect(sheet).toContain('node.matches("input, select, textarea")');
  });

  it("opens an info tip on keyboard focus only, not on focus a script moved", () => {
    const tip = readFileSync(path.join(SRC, "ui", "InfoTip.tsx"), "utf8");
    expect(tip).not.toContain("onFocus={show}");
    expect(tip).toContain('element.matches(":focus-visible")');
  });
});

describe("page locks, section locks, and profile fields open in a sheet", () => {
  const read = (file: string) => readFileSync(path.join(SRC, "settings", file), "utf8");

  it("opens each lock from its card, with no accordion left", () => {
    const card = read("LockCard.tsx");
    expect(card).toContain('aria-haspopup="dialog"');
    for (const file of ["PageLocksPanel.tsx", "SectionLocksEditor.tsx"]) {
      const source = read(file);
      expect(source, file).toContain("<Sheet");
      expect(source, file).toContain("<LockCard");
      expect(source, file).not.toContain("aria-expanded");
      expect(source, file).not.toMatch(/&& "is-open"/);
    }
  });

  it("saves from the sheet, a toggle, a move, or a delete, so no list-wide save button is left", () => {
    for (const file of ["PageLocksPanel.tsx", "SectionLocksEditor.tsx", "CustomFieldsPanel.tsx"]) {
      const source = read(file);
      expect(source, file).not.toMatch(/\{saving \? "Saving" : "Save (locks|fields)"\}/);
      // The sheet closes only once the save resolves true.
      expect(source, file).toMatch(/if \(await (onSave|savePages)\(/);
    }
    const tab = readFileSync(path.join(SRC, "tabs", "SettingsTab.tsx"), "utf8");
    expect(tab).toContain("onSave={handleSavePageLocks}");
    expect(tab).toContain("onSave={handleSaveFields}");
  });
});
