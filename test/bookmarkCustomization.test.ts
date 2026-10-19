/**
 * The Bookmark Button's and Bookmarks Tray's design controls, added on
 * 2026-10-18. Development doc: 18-content-features.md, "Design Controls".
 *
 * Both components run on the creator's site and cannot be rendered here
 * (blocker B5), so this reads their source: every control is declared, its
 * default keeps the look a placed instance already has, and every creator
 * value reaches CSS through a clamp or the colour sanitizer.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "src", "canvas-components");
const button = readFileSync(path.join(DIR, "BookmarkButton.tsx"), "utf-8");
const tray = readFileSync(path.join(DIR, "BookmarksTray.tsx"), "utf-8");

/** The property control block for one prop. */
function control(source: string, prop: string): string {
  const start = source.indexOf(`\n  ${prop}: {`, source.indexOf("addPropertyControls("));
  expect(start, `${prop} control`).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf("\n  },", start));
}

describe("Bookmark Button", () => {
  it("offers Button Style, Icon Size, Icon Position, and Save Animation", () => {
    expect(control(button, "buttonStyle")).toContain('optionTitles: ["Outline", "Soft", "Icon Only"]');
    expect(control(button, "iconSize")).toContain("defaultValue: 20");
    expect(control(button, "iconPosition")).toContain("hidden: (props) => !props.showLabel");
    expect(control(button, "animateSave")).toContain("defaultValue: true");
  });

  it("keeps the placed look by default: outline, 20px, icon on the left, pulse on", () => {
    expect(button).toContain('buttonStyle = "outline",');
    expect(button).toContain("iconSize = 20,");
    expect(button).toContain('iconPosition = "left",');
    expect(button).toContain("animateSave = true,");
  });

  it("clamps the icon size and falls back on an unknown style", () => {
    expect(button).toContain("mfNumber(iconSize, 12, 48, 20)");
    expect(button).toContain('BUTTON_STYLES.indexOf(buttonStyle) === -1 ? "outline" : buttonStyle');
  });

  it("pulses only when Save Animation is on", () => {
    expect(button).toContain("if (willSave && animateSave) {");
  });
});

describe("Bookmarks Tray", () => {
  it("offers the trigger, badge, drawer, and list controls", () => {
    expect(control(tray, "buttonStyle")).toContain('optionTitles: ["Outline", "Soft", "Icon Only"]');
    expect(control(tray, "iconShape")).toContain('optionTitles: ["Bookmark Ribbon", "Heart", "Star"]');
    expect(control(tray, "iconSize")).toContain("defaultValue: 18");
    expect(control(tray, "badgeColor")).toContain("optional: true");
    expect(control(tray, "drawerWidth")).toContain("defaultValue: 400");
    expect(control(tray, "showDates")).toContain("defaultValue: true");
    expect(control(tray, "backdrop")).toContain('optionTitles: ["Dim", "Blur", "None"]');
  });

  it("keeps the placed look by default", () => {
    for (const fragment of [
      'buttonStyle = "outline",',
      'iconShape = "bookmark",',
      "iconSize = 18,",
      "drawerWidth = 400,",
      "showDates = true,",
      'backdrop = "dim",',
    ]) {
      expect(tray).toContain(fragment);
    }
  });

  it("sanitizes the badge colour and clamps the sizes before they reach CSS", () => {
    expect(tray).toContain('mfSafeColor(badgeColor, "")');
    expect(tray).toContain("mfNumber(iconSize, 12, 48, 18)");
    expect(tray).toContain("mfNumber(drawerWidth, 280, 640, 400)");
  });

  it("draws the same three icons as the Bookmark Button", () => {
    const heart = "M19 14c1.5-1.5 3-3.3 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z";
    const star = "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z";
    for (const shape of [heart, star]) {
      expect(button).toContain(shape);
      expect(tray).toContain(shape);
    }
  });
});

describe("sizing on the canvas", () => {
  const builder = readFileSync(path.join(process.cwd(), "src", "components", "tabs", "BuilderTab.tsx"), "utf-8");

  it("inserts both at a fixed 44 square, not stretched to the stack they land in", () => {
    for (const id of ["bookmark_button", "bookmarks_tray"]) {
      expect(builder).toContain(`${id}: { width: "44px", height: "44px",`);
    }
  });

  it("keeps a 36px target at any size, without wrapping the label", () => {
    for (const [source, selector] of [
      [button, ".mf-bookmark-button {"],
      [tray, ".mf-tray-trigger {"],
    ] as const) {
      const rule = source.slice(source.indexOf(selector), source.indexOf("}", source.indexOf(selector)));
      expect(rule).toContain("min-width: 36px; min-height: 36px;");
      expect(rule).toContain("white-space: nowrap;");
    }
  });
});
