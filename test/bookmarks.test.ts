/**
 * FP-10 and PRD F14: bookmarks, run from the code that ships.
 *
 * The sync rule is cut out of `BookmarkButton.tsx`, transpiled, and driven
 * against a fake server with controllable timing: rapid clicks, failures, and
 * a signed-out visitor. The rest pins the guarantees the plan lists.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { generateBookmarkButtonCode, generateBookmarksTrayCode } from "../src/services/canvasComponentCodeGenerator";
import { DEFAULT_BOOKMARK_BUTTON_CONFIG, DEFAULT_BOOKMARKS_TRAY_CONFIG } from "../src/types/canvas";

const DIR = path.join(process.cwd(), "src", "canvas-components");
const button = readFileSync(path.join(DIR, "BookmarkButton.tsx"), "utf-8");
const tray = readFileSync(path.join(DIR, "BookmarksTray.tsx"), "utf-8");

interface SlugSync {
  desired: boolean;
  confirmed: boolean;
  inFlight: boolean;
}

function loadSync() {
  const start = button.indexOf("// @memberframe-bookmark-sync-start");
  const endMarker = "// @memberframe-bookmark-sync-end";
  const end = button.indexOf(endMarker) + endMarker.length;
  const js = ts.transpileModule(button.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText;
  // eslint-disable-next-line no-new-func
  return new Function(`${js}\nreturn { nextSyncAction, clickSync, settleSync, revertSync };`)() as {
    nextSyncAction(state: SlugSync): "add" | "remove" | null;
    clickSync(state: SlugSync): SlugSync;
    settleSync(state: SlugSync, saved: boolean): SlugSync;
    revertSync(state: SlugSync): SlugSync;
  };
}

const sync = loadSync();

/**
 * A model of one button against a server that holds a set of slugs and adds
 * each bookmark at most once, like the unique key does. Requests resolve only
 * when the test says, so clicks can land while one is in flight.
 */
function harness(serverAnswer: () => "ok" | "fail" | "unauthorized" = () => "ok") {
  const server = new Set<string>();
  let adds = 0;
  let state: SlugSync = { desired: false, confirmed: false, inFlight: false };
  const pending: Array<() => void> = [];
  let promptedSignIn = false;
  let toasts = 0;

  function pump() {
    const action = sync.nextSyncAction(state);
    if (!action) return;
    state = { ...state, inFlight: true };
    pending.push(() => {
      const answer = serverAnswer();
      if (answer === "ok") {
        if (action === "add" && !server.has("item")) {
          server.add("item");
          adds += 1;
        }
        if (action === "remove") server.delete("item");
        state = sync.settleSync(state, server.has("item"));
        pump();
      } else {
        state = sync.revertSync(state);
        if (answer === "unauthorized") promptedSignIn = true;
        else toasts += 1;
      }
    });
  }

  return {
    click() {
      state = sync.clickSync(state);
      pump();
    },
    /** Let the oldest request land. */
    flush() {
      pending.shift()?.();
    },
    flushAll() {
      while (pending.length > 0) pending.shift()?.();
    },
    get icon() {
      return state.desired;
    },
    get state() {
      return state;
    },
    get saved() {
      return server.has("item");
    },
    get adds() {
      return adds;
    },
    get inFlightCount() {
      return pending.length;
    },
    get promptedSignIn() {
      return promptedSignIn;
    },
    get toasts() {
      return toasts;
    },
  };
}

describe("the icon fills before the network answers (criterion 1)", () => {
  it("shows saved on click, with the request still pending", () => {
    const h = harness();
    h.click();
    expect(h.icon).toBe(true);
    expect(h.saved).toBe(false);
    expect(h.inFlightCount).toBe(1);
    h.flushAll();
    expect(h.saved).toBe(true);
  });
});

describe("rapid clicks (criterion 3)", () => {
  it("add, remove, add inside one request resolves to saved, once", () => {
    const h = harness();
    h.click();
    h.click();
    h.click();
    // Only one request is ever in flight per item.
    expect(h.inFlightCount).toBe(1);
    h.flushAll();
    expect(h.icon).toBe(true);
    expect(h.saved).toBe(true);
    expect(h.adds).toBe(1);
  });

  it("a double click ends unsaved, with no bookmark left behind", () => {
    const h = harness();
    h.click();
    h.click();
    h.flushAll();
    expect(h.icon).toBe(false);
    expect(h.saved).toBe(false);
    expect(h.state).toEqual({ desired: false, confirmed: false, inFlight: false });
  });

  it("ten clicks while requests trickle in settle where the last click left them", () => {
    for (const clicks of [1, 2, 3, 4, 7, 10]) {
      const h = harness();
      for (let index = 0; index < clicks; index += 1) {
        h.click();
        if (index % 3 === 0) h.flush();
      }
      h.flushAll();
      expect(h.saved, `${clicks} clicks`).toBe(clicks % 2 === 1);
      expect(h.icon).toBe(h.saved);
      expect(h.adds).toBeLessThanOrEqual(Math.ceil(clicks / 2));
    }
  });
});

describe("failures (criteria 2 and 5)", () => {
  it("a failed sync puts the icon back and shows a toast", () => {
    const h = harness(() => "fail");
    h.click();
    expect(h.icon).toBe(true);
    h.flushAll();
    expect(h.icon).toBe(false);
    expect(h.toasts).toBe(1);
  });

  it("a signed-out click puts the icon back and prompts sign in", () => {
    const h = harness(() => "unauthorized");
    h.click();
    h.flushAll();
    expect(h.icon).toBe(false);
    expect(h.promptedSignIn).toBe(true);
  });

  it("times out a hung request, which then counts as a failure", () => {
    expect(button).toContain("const REQUEST_TIMEOUT_MS = 10_000;");
    expect(button).toContain("controller.abort()");
  });

  it("asks a known guest to sign in without a request, and saves the item after", () => {
    expect(button).toMatch(/if \(store\.status === "guest"\) \{\s*\/\/ Known to be signed out: no request, straight to the sign in prompt\.\s*writePending\(item\);/);
    expect(button).toContain('window.dispatchEvent(new CustomEvent("memberframe:open-auth", { detail: { reason: "bookmark" } }));');
    expect(button).toMatch(/const pending = readPending\(\);\s*if \(pending\) \{\s*writePending\(null\);\s*if \(!isSaved\(pending\.itemSlug\)\) toggle\(pending\);/);
  });
});

describe("the tray (criterion 4)", () => {
  it("is a modal dialog that traps focus and closes on Escape", () => {
    expect(tray).toContain('role="dialog"');
    expect(tray).toContain("aria-modal={onCanvas ? undefined : true}");
    expect(tray).toContain('if (event.key === "Escape") {');
    expect(tray).toContain('if (event.key !== "Tab" || !panel) return;');
    expect(tray).toContain("triggerRef.current?.focus()");
  });

  it("removes optimistically and restores the item when the server says no", () => {
    expect(tray).toContain("setLoad({ phase: \"ready\", items: before.filter((entry) => entry.itemSlug !== item.itemSlug) });");
    expect(tray).toContain("setLoad({ phase: \"ready\", items: before });");
    expect(tray).toContain('setToast(t("removeFailed"));');
  });

  it("only renders a link for a site path or a web address", () => {
    expect(tray).toContain("function safeHref(value: string): string | null {");
    expect(tray).toContain("const href = safeHref(item.url);");
  });

  it("stays in step with the buttons through one event", () => {
    expect(button).toContain('const UPDATED_EVENT = "memberframe:bookmark-updated";');
    expect(tray).toContain('const UPDATED_EVENT = "memberframe:bookmark-updated";');
  });
});

describe("the generated files", () => {
  const context = { apiBaseUrl: "https://api.example.com", siteKey: "site_9", afterLoginPath: "", loginPath: "/login", afterLogoutPath: "/" };

  it("bake in the connection and clamp what they are given", () => {
    const buttonFile = generateBookmarkButtonCode({ ...DEFAULT_BOOKMARK_BUTTON_CONFIG, activeFillColor: "red;}" }, undefined, context);
    expect(buttonFile.config.activeFillColor).toBe("#5271ff");
    expect(buttonFile.code).toContain('siteKey: "site_9",');

    const trayFile = generateBookmarksTrayCode({ ...DEFAULT_BOOKMARKS_TRAY_CONFIG, maxItems: 5000 }, undefined, context);
    expect(trayFile.config.maxItems).toBe(200);
    expect(trayFile.code).toContain("maxItems: 200,");
  });
});
