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

describe("the page a navigation-bar button saves (2026-10-20)", () => {
  // Cut out of the shipped file, from the location listener to `itemFor`.
  const start = button.indexOf('const LOCATION_EVENT = "memberframe:location";');
  const end = button.indexOf("function ShapeIcon(");
  const js = ts.transpileModule(button.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText;

  function load(page: { path: string; title: string; headings?: Array<{ text: string; inNav?: boolean; hidden?: boolean }> }) {
    const listeners = new Map<string, Array<() => void>>();
    const window = {
      location: { pathname: page.path, search: "" },
      history: {
        pushState(_state: unknown, _title: string, url: string) {
          window.location.pathname = url;
        },
        replaceState() {},
      },
      addEventListener(name: string, fn: () => void) {
        listeners.set(name, [...(listeners.get(name) ?? []), fn]);
      },
      removeEventListener() {},
      dispatchEvent(event: { type: string }) {
        for (const fn of listeners.get(event.type) ?? []) fn();
        return true;
      },
    };
    const document = {
      title: page.title,
      headings: page.headings ?? [],
      querySelectorAll: () =>
        document.headings.map((heading) => ({
          textContent: heading.text,
          closest: () => (heading.inNav ? {} : null),
          getClientRects: () => (heading.hidden ? [] : [{}]),
        })),
    };
    class FakeEvent {
      constructor(public type: string) {}
    }
    // eslint-disable-next-line no-new-func
    const api = new Function("window", "document", "Event", "History", `${js}\nreturn { mfOnLocationChange, noteTitle, itemFor, slugWords };`)(
      window,
      document,
      FakeEvent,
      Object
    ) as {
      mfOnLocationChange(fn: () => void): () => void;
      noteTitle(): void;
      itemFor(slug: string, title: string, url: string): { itemSlug: string; title: string; url: string };
      slugWords(path: string): string;
    };
    return { api, window, document };
  }

  it("saves the page shown after a client-side navigation, not the first one", () => {
    const { api, window, document } = load({ path: "/", title: "Journal - Personal Blog Framer Template" });
    let changes = 0;
    api.mfOnLocationChange(() => (changes += 1));
    api.noteTitle();
    expect(api.itemFor("", "", "")).toMatchObject({ itemSlug: "/", title: "Journal - Personal Blog Framer Template", url: "/" });

    window.history.pushState(null, "", "/article/artificial-intelligence");
    expect(changes).toBe(1);
    document.title = "Journal - Personal Blog Framer Template";
    api.noteTitle();
    // The site-wide title was seen on another page, so it names nothing here.
    expect(api.itemFor("", "", "")).toMatchObject({
      itemSlug: "/article/artificial-intelligence",
      title: "Artificial Intelligence",
      url: "/article/artificial-intelligence",
    });
  });

  it("names a page by its main heading, skipping the navigation's, then by its own title", () => {
    const { api } = load({ path: "/article/ai", title: "Site", headings: [{ text: "Menu", inNav: true }, { text: "The Rise of AI" }] });
    expect(api.itemFor("", "", "").title).toBe("The Rise of AI");
    const own = load({ path: "/article/ai", title: "AI, explained" });
    expect(own.api.itemFor("", "", "").title).toBe("AI, explained");
  });

  it("never takes the title of the page just left, when saved before Framer sets the new one", () => {
    const { api, window } = load({ path: "/article/artificial-intelligence", title: "Artificial Intelligence: Beyond the Hype" });
    api.mfOnLocationChange(() => undefined);
    // Navigated, and document.title still names the article left.
    window.history.pushState(null, "", "/article/nomadic-tech");
    expect(api.itemFor("", "", "").title).toBe("Nomadic Tech");
    window.history.pushState(null, "", "/");
    expect(api.itemFor("", "", "").title).toBe("Home");
  });

  it("skips a heading hidden for another breakpoint", () => {
    const { api } = load({ path: "/article/ai", title: "Site", headings: [{ text: "Hidden", hidden: true }, { text: "Shown heading" }] });
    expect(api.itemFor("", "", "").title).toBe("Shown heading");
  });

  it("sends the real title once Framer sets it, and repairs a saved site-wide title", () => {
    expect(button).toContain("watchTitle(current.itemSlug, path);");
    expect(button).toContain("if (genericTitle(stored.title, path)) retitle(item.itemSlug, pageTitle(path).slice(0, 255));");
  });

  it("keeps the creator's Item Slug and Item Title when set", () => {
    const { api } = load({ path: "/blog", title: "Blog" });
    expect(api.itemFor("pricing-guide", "", "")).toMatchObject({ itemSlug: "pricing-guide", title: "Pricing Guide" });
    expect(api.itemFor("pricing-guide", "How to Price", "/blog/pricing-guide")).toMatchObject({ title: "How to Price", url: "/blog/pricing-guide" });
  });

  it("builds the item at the click, and the tray shows each item's path", () => {
    expect(button).toContain('const current = itemFor(String(itemSlug ?? ""), String(itemTitle ?? ""), String(itemUrl ?? ""));');
    expect(button).toContain("[itemSlug, itemTitle, itemUrl, locationKey]");
    expect(tray).toContain('const path = item.url.startsWith("/") ? item.url.split(/[?#]/)[0] : "";');
  });
});
