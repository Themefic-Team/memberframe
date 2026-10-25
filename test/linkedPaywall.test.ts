/**
 * The linked Soft Paywall: the component on a CMS page, the post body tagged
 * by the PaywallArticle override. Development doc: 21-blog-paywalls.md, 1.5.
 *
 * The component runs on the creator's published site and cannot be rendered
 * here (blocker B5), so, like test/softPaywall.test.ts, this reads its source
 * for the properties that decide whether a locked post can be read whole: the
 * two classes agree with the override, the cut is in the first render, and an
 * open post is left alone.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  ARTICLE_TAG_FILE_NAME,
  GATED_BODY_CLASS,
  LINKED_ARTICLE_CLASS,
  articleTagCode,
} from "../src/services/articleTag";

const source = readFileSync(path.join(process.cwd(), "src", "canvas-components", "MeteredPaywall.tsx"), "utf-8");

describe("the PaywallArticle override", () => {
  const code = articleTagCode();

  it("is the file and override Framer lists", () => {
    expect(ARTICLE_TAG_FILE_NAME).toBe("MemberArticle.tsx");
    expect(code).toContain("export function PaywallArticle(Component: React.ComponentType<any>): React.ComponentType<any> {");
  });

  it("keeps the layer's own class and props, and adds the two the paywall reads", () => {
    expect(code).toContain("{ ...props, ref, className,");
    // forwardRef: Framer's appear effect needs the ref, or the post stays invisible.
    expect(code).toContain("return React.forwardRef(function Tagged(props: any, ref: any) {");
    expect(code).toContain(`props.className + " ${GATED_BODY_CLASS} ${LINKED_ARTICLE_CLASS}"`);
    expect(code).toContain(`: "${GATED_BODY_CLASS} ${LINKED_ARTICLE_CLASS}"`);
  });

  it("uses the classes the component looks for and the schema points at", () => {
    expect(source).toContain(`const MF_LINKED_ARTICLE_CLASS = "${LINKED_ARTICLE_CLASS}";`);
    expect(source).toContain(`const MF_GATED_BODY_CLASS = "${GATED_BODY_CLASS}";`);
  });
});

describe("the component in linked mode", () => {
  it("has no Article Body, Article ID, or the other settings it now decides itself", () => {
    const controls = source.slice(source.indexOf("addPropertyControls(MeteredPaywall"));
    for (const gone of ["contentSlot:", "articleId:", "previewHeight:", "blurIntensity:", "showSignInLink:", "pricingPath:", "loginPath:", "seoMarkup:", "schemaType:"]) {
      expect(controls, gone).not.toContain(gone);
    }
    expect(source).toContain("const pricingPath = CONFIG.pricingPath;");
    // Article for a text block, WebPage for anything else (21-blog-paywalls.md 9).
    expect(source).toContain('mfInjectPaywallSchema(linkedArticle.matches(MF_TEXT_BLOCK) ? "Article" : "WebPage");');
  });

  it("finds the article itself: a tagged layer first, else the nearest text block above with two paragraphs", () => {
    expect(source).toContain("function findArticle(root: Element | null, ownId: string): HTMLElement | null {");
    expect(source).toContain('[data-framer-component-type="RichTextContainer"]');
    expect(source).toContain('element.querySelectorAll("p").length >= 2');
    expect(source).toContain("linkedArticle.setAttribute(MF_ARTICLE_ATTR, instanceId);");
  });

  it("cuts only its own article, and only while it is not open", () => {
    // Several paywalls on a page each cut theirs (21-blog-paywalls.md 8).
    expect(source).toContain('const cut = effective.phase !== "open";');
    expect(source).toMatch(/const linkedCss =\s*!onCanvas && cut && instanceId/);
    expect(source).toContain('const target = `[${MF_ARTICLE_ATTR}="${instanceId}"]`;');
    expect(source).toContain("{linkedCss ? <style>{linkedCss}</style> : null}");
  });

  it("styles nothing on the creator's layer but the clip: no mask, no ::after, no position (9.5)", () => {
    const css = source.slice(source.indexOf("const linkedCss ="), source.indexOf("const goPricing"));
    // A mask and ::after on Framer's layer did not show on the test site.
    expect(css).not.toContain("mask-image");
    expect(css).not.toContain("::after");
    expect(css).not.toContain("position:");
    expect(source).not.toContain("staticLayer");
  });

  it("frosts the locked content with its own band, fading into the page's colour (9.5)", () => {
    expect(source).toContain('{cut && frost ? <div className="mf-meter-frost" aria-hidden={true} /> : null}');
    expect(source).toContain("-webkit-backdrop-filter: blur(var(--mf-frost-blur, 10px)); backdrop-filter: blur(var(--mf-frost-blur, 10px));");
    expect(source).toContain("var(--mf-frost-color, #ffffff) 100%);");
    // Placed from the layer's and the root's boxes, so a stack's gap does not matter.
    expect(source).toContain("edge: Math.round(layerBox.top + Math.min(cutAt, layerBox.height) - rootBox.top),");
    expect(source).toContain("color: mfBackdropColor(linkedArticle),");
    // The root is its own block, so the card's negative margin never moves it.
    expect(source).toContain("display: flow-root;");
  });

  it("draws a glass card over the frost on the site, its blur and opacity set under Glass (9.5)", () => {
    expect(source).toContain("background: color-mix(in srgb, var(--mf-c-surface) var(--mf-card-alpha, 80%), transparent);");
    expect(source).toContain("backdrop-filter: blur(var(--mf-card-blur, 16px)) saturate(160%);");
    expect(source).toContain(".mf-meter:not(.is-canvas) .mf-meter-card { margin-top: var(--mf-card-shift, 0px); }");
    expect(source).toContain("`--mf-card-shift: ${frost.edge - overlap}px; `");
    expect(source).toContain("const overlap = Math.min(MF_OVERLAP_PX, Math.round(cutAt * 0.4));");
    expect(source).toContain("setCutAt(Math.max(80, Math.round(bottom - top + MF_PEEK_PX)));");
    const controls = source.slice(source.indexOf("addPropertyControls(MeteredPaywall"));
    expect(controls).toContain('contentBlur: { type: ControlType.Number, title: "Content Blur", min: 0, max: 30, step: 1, unit: "px", defaultValue: 10 },');
    expect(controls).toContain('cardBlur: { type: ControlType.Number, title: "Card Blur", min: 0, max: 40, step: 1, unit: "px", defaultValue: 16 },');
    expect(controls).toContain('cardOpacity: { type: ControlType.Number, title: "Card Opacity", min: 30, max: 100, step: 1, unit: "%", defaultValue: 80 },');
  });

  it("reads the page's colour behind the layer, skipping transparent ones", () => {
    const start = source.indexOf("function mfBackdropColor(");
    const fn = source.slice(start, source.indexOf("\n}\n", start) + 2);
    const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
    const colours: Record<string, string> = { grid: "rgba(0, 0, 0, 0)", stack: "transparent", page: "rgb(17, 17, 17)" };
    const chain = (names: string[]) => {
      const nodes = names.map((name) => ({ name, parentElement: null as unknown }));
      nodes.forEach((node, index) => (node.parentElement = nodes[index + 1] ?? null));
      return nodes[0];
    };
    // eslint-disable-next-line no-new-func
    const read = new Function("window", `${js}\nreturn mfBackdropColor;`)({
      getComputedStyle: (node: { name: string }) => ({ backgroundColor: colours[node.name] ?? "" }),
    }) as (element: unknown) => string;
    expect(read(chain(["grid", "stack", "page"]))).toBe("rgb(17, 17, 17)");
    expect(read(chain(["grid", "stack"]))).toBe("rgb(255, 255, 255)");
  });

  it("keeps the layer's designed size: clipped, not squeezed (2026-10-22)", () => {
    const css = source.slice(source.indexOf("const linkedCss ="), source.indexOf("const goPricing"));
    // A max-height squeezed a Framer grid's rows; the layer is clipped instead,
    // and a negative margin of the hidden height pulls what follows up.
    expect(css).not.toContain("max-height");
    expect(css).toContain("clip-path: inset(0 0 calc(100% - ${cutAt}px) 0) !important; margin-bottom: ${baseMargin - hiddenPx}px !important;");
    expect(source).toContain("const hiddenPx = Math.max(0, layerHeight - cutAt);");
    // Measured on the real layout, again when images load or the width changes.
    expect(source).toContain("const observer = new ResizeObserver(() => setSettled((value) => value + 1));");
    expect(source).toContain("const units = previewUnits(body, wanted);");
  });

  it("keeps locked text out of focus and screen readers on the tagged layer", () => {
    expect(source).toMatch(/const body = linkedArticle;\s*if \(!body\) return;\s*if \(locked\) body\.setAttribute\("inert", ""\);/);
  });

  it("shows only the lock card on the canvas, with no placeholder box (2026-10-22)", () => {
    const canvasBranch = source.slice(source.indexOf("function body(): React.ReactNode {"), source.indexOf("if (!linkedArticle) return null;"));
    expect(canvasBranch).toContain('if (onCanvas) return lockCard(mode === "teaser" ? "teaser" : "meter", false);');
    expect(source).not.toContain("mf-meter-placeholder");
    expect(source).not.toContain("Paywall card");
  });

  it("reads the layer's own bottom margin before the mark", () => {
    expect(source).toContain(
      "setBaseMargin(parseFloat(window.getComputedStyle(linkedArticle).marginBottom) || 0);\n    linkedArticle.setAttribute(MF_ARTICLE_ATTR, instanceId);"
    );
  });
});

describe("a linked paywall with no tagged post body", () => {
  it("shows nothing on the live site rather than a card under a readable post", () => {
    expect(source).toContain("if (!linkedArticle) return null;");
  });
});

describe("finding the article, several paywalls to a page (2026-10-22)", () => {
  // Cut out of the shipped file and run against a small fake page.
  const start = source.indexOf("/** Shown on this viewport");
  const end = source.indexOf("type TierKey =");
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;

  type Fake = { name: string; order: number; paragraphs?: number; tagged?: boolean; hidden?: boolean; paywall?: boolean; owner?: string };
  function page(layers: Fake[]) {
    const all = layers.map((layer) => ({
      name: layer.name,
      order: layer.order,
      getClientRects: () => (layer.hidden ? [] : [{}]),
      querySelectorAll: () => ({ length: layer.paragraphs ?? 0 }),
      getAttribute: () => layer.owner ?? null,
      contains: () => false,
      compareDocumentPosition: (other: { order: number }) => (other.order > layer.order ? 4 : 2),
    }));
    const document = {
      querySelectorAll: (selector: string) =>
        all.filter((_, index) => {
          const layer = layers[index]!;
          if (selector === ".mf-meter") return Boolean(layer.paywall);
          if (selector.startsWith(".")) return Boolean(layer.tagged);
          return !layer.paywall && !layer.tagged;
        }),
    };
    // eslint-disable-next-line no-new-func
    const api = new Function("document", "Node", "MF_LINKED_ARTICLE_CLASS", "MF_ARTICLE_ATTR", `${js}\nreturn { findArticle };`)(
      document,
      { DOCUMENT_POSITION_FOLLOWING: 4 },
      "mf-paywall-article",
      "data-mf-paywall-article"
    ) as { findArticle(root: unknown, id: string): { name: string } | null };
    return (paywallName: string, id = "me") => api.findArticle(all.find((layer) => layer.name === paywallName), id)?.name ?? null;
  }

  it("takes the nearest text block above with two or more paragraphs, skipping a heading block", () => {
    const find = page([
      { name: "about", order: 1, paragraphs: 8 },
      { name: "heading", order: 2, paragraphs: 0 },
      { name: "paywall", order: 3, paywall: true },
    ]);
    expect(find("paywall")).toBe("about");
  });

  it("gives two paywalls on one page their own articles, never reaching past the one before", () => {
    const find = page([
      { name: "first article", order: 1, paragraphs: 5 },
      { name: "first paywall", order: 2, paywall: true },
      { name: "second article", order: 3, paragraphs: 4 },
      { name: "second paywall", order: 4, paywall: true },
      { name: "a lone paywall", order: 6, paywall: true },
    ]);
    expect(find("first paywall")).toBe("first article");
    expect(find("second paywall")).toBe("second article");
    // Nothing between it and the paywall before it: no article, so no card.
    expect(find("a lone paywall")).toBeNull();
  });

  it("skips an article another paywall has marked, and a copy hidden for another breakpoint", () => {
    const find = page([
      { name: "older", order: 1, paragraphs: 4 },
      { name: "claimed", order: 2, paragraphs: 4, owner: "other" },
      { name: "hidden copy", order: 3, paragraphs: 4, hidden: true },
      { name: "paywall", order: 4, paywall: true },
    ]);
    expect(find("paywall")).toBe("older");
  });

  it("still prefers a layer with the old PaywallArticle override in its range", () => {
    const find = page([
      { name: "tagged", order: 1, paragraphs: 2, tagged: true },
      { name: "closer", order: 2, paragraphs: 5 },
      { name: "paywall", order: 3, paywall: true },
    ]);
    expect(find("paywall")).toBe("tagged");
  });
});

describe("any page: the layer right above (2026-10-22)", () => {
  // The finder, cut out of the shipped file, run against a small page tree.
  const start = source.indexOf("/** Shown on this viewport");
  const end = source.indexOf("type TierKey =");
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
  const TEXT = '[data-framer-component-type="RichTextContainer"]';

  /**
   * A layer: `text` makes it a text block with that many paragraphs. Laid out
   * by page order unless `top` says otherwise, 300px tall unless `height` does.
   */
  type Spec = {
    name: string;
    tag?: string;
    text?: number;
    paywall?: boolean;
    tagged?: boolean;
    hidden?: boolean;
    owner?: string;
    top?: number;
    height?: number;
    position?: string;
    root?: boolean;
    /** Framer's \`.ssr-variant\`: \`display: contents\`, no rectangles of its own. */
    boxless?: boolean;
    kids?: Spec[];
  };
  type Node = {
    name: string;
    tagName: string;
    order: number;
    spec: Spec;
    parentElement: Node | null;
    children: Node[];
    readonly previousElementSibling: Node | null;
    readonly nextElementSibling: Node | null;
    getClientRects(): unknown[];
    matches(selector: string): boolean;
    querySelectorAll(selector: string): Node[];
    querySelector(selector: string): Node | null;
    contains(other: Node): boolean;
    compareDocumentPosition(other: Node): number;
    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
    getBoundingClientRect(): { top: number; bottom: number; height: number };
    id: string;
  };
  const FOOTER = 'footer, [data-framer-name*="footer" i]';

  function page(kids: Spec[]) {
    const all: Node[] = [];
    const make = (spec: Spec, parent: Node | null): Node => {
      const node: Node = {
        name: spec.name,
        tagName: (spec.tag ?? "div").toUpperCase(),
        order: all.length,
        spec,
        parentElement: parent,
        children: [],
        get previousElementSibling() {
          const siblings = node.parentElement?.children ?? [];
          return siblings[siblings.indexOf(node) - 1] ?? null;
        },
        get nextElementSibling() {
          const siblings = node.parentElement?.children ?? [];
          return siblings[siblings.indexOf(node) + 1] ?? null;
        },
        getClientRects: () => {
          for (let at: Node | null = node; at; at = at.parentElement) if (at.spec.hidden) return [];
          return spec.boxless ? [] : [{}];
        },
        matches: (selector) =>
          selector === ".mf-meter"
            ? Boolean(spec.paywall)
            : selector === TEXT
              ? spec.text !== undefined
              : selector === ".mf-paywall-article"
                ? Boolean(spec.tagged)
                : selector === FOOTER
                  ? node.tagName === "FOOTER"
                  : node.tagName === selector.toUpperCase(),
        querySelectorAll: (selector) => all.filter((other) => other !== node && node.contains(other) && other.matches(selector)),
        querySelector: (selector) => node.querySelectorAll(selector)[0] ?? null,
        contains: (other) => {
          for (let at: Node | null = other; at; at = at.parentElement) if (at === node) return true;
          return false;
        },
        compareDocumentPosition: (other) => (other.order > node.order ? (node.contains(other) ? 20 : 4) : other.contains(node) ? 10 : 2),
        getAttribute: () => spec.owner ?? null,
        hasAttribute: (name) => name === "data-framer-root" && Boolean(spec.root),
        getBoundingClientRect: () => {
          if (node.getClientRects().length === 0) return { top: 0, bottom: 0, height: 0 };
          const top = spec.top ?? node.order * 10;
          const height = spec.height ?? 300;
          return { top, bottom: top + height, height };
        },
        id: "",
      };
      all.push(node);
      const inner = spec.text !== undefined ? Array.from({ length: spec.text }, (_, index) => ({ name: `${spec.name} p${index + 1}`, tag: "p" })) : spec.kids ?? [];
      node.children = inner.map((kid) => make(kid, node));
      return node;
    };
    const body = make({ name: "body", kids }, null);
    const document = { body, querySelectorAll: (selector: string) => body.querySelectorAll(selector) };
    const window = {
      getComputedStyle: (node: Node) => ({
        position: node.spec.position ?? "static",
        display: node.spec.hidden ? "none" : node.spec.boxless ? "contents" : "block",
      }),
    };
    // eslint-disable-next-line no-new-func
    const api = new Function("document", "window", "Node", "MF_LINKED_ARTICLE_CLASS", "MF_ARTICLE_ATTR", `${js}\nreturn { findArticle, previewUnits, layersBelow, layersBetween };`)(
      document,
      window,
      { DOCUMENT_POSITION_FOLLOWING: 4 },
      "mf-paywall-article",
      "data-mf-paywall-article"
    ) as {
      findArticle(root: Node, id: string): Node | null;
      previewUnits(layer: Node, wanted?: number): Node[];
      layersBelow(root: Node): Node[];
      layersBetween(layer: Node, root: Node): Node[];
    };
    const byName = (name: string) => all.find((node) => node.name === name)!;
    return {
      find: (paywallName: string) => api.findArticle(byName(paywallName), "me")?.name ?? null,
      units: (layerName: string, wanted?: number) => api.previewUnits(byName(layerName), wanted).map((unit) => unit.name),
      below: (paywallName: string) => api.layersBelow(byName(paywallName)).map((layer) => layer.name),
      between: (layerName: string, paywallName: string) => api.layersBetween(byName(layerName), byName(paywallName)).map((layer) => layer.name),
    };
  }

  /** A paywall as Framer publishes it: a container, a variant per breakpoint. */
  const wrapped = (name: string, hiddenCopy = false): Spec => ({
    name: `${name} container`,
    kids: [
      ...(hiddenCopy ? [{ name: `${name} tablet`, hidden: true, kids: [{ name: `${name} copy`, paywall: true }] }] : []),
      { name: `${name} desktop`, kids: [{ name, paywall: true }] },
    ],
  });

  it("locks a CMS post body right above it, through Framer's wrappers; a hidden copy takes nothing", () => {
    const { find } = page([{ name: "post", kids: [{ name: "title", text: 0 }, { name: "body", text: 6 }, wrapped("paywall", true)] }]);
    expect(find("paywall")).toBe("body");
    expect(find("paywall copy")).toBeNull();
  });

  it("locks a stack of mixed layers on an ordinary page, skipping a style tag, and counts its items", () => {
    const { find, units } = page([
      {
        name: "section",
        kids: [
          { name: "intro", text: 3 },
          { name: "premium", kids: [{ name: "lead", text: 1 }, { name: "image" }, { name: "more", text: 1 }, { name: "video" }] },
          { name: "css", tag: "style" },
          wrapped("paywall"),
        ],
      },
    ]);
    expect(find("paywall")).toBe("premium");
    expect(units("premium")).toEqual(["lead", "image", "more", "video"]);
  });

  it("counts a grid's cards through a wrapper, and a text block's paragraphs", () => {
    const { units } = page([
      { name: "wrapper", kids: [{ name: "grid", kids: [{ name: "c1" }, { name: "c2" }, { name: "c3", hidden: true }, { name: "c4" }] }] },
      { name: "post", text: 3 },
    ]);
    expect(units("wrapper")).toEqual(["c1", "c2", "c4"]);
    expect(units("post")).toEqual(["post p1", "post p2", "post p3"]);
  });

  it("opens a section's grid when the heading and grid are too few: Free Preview 2 keeps the heading and first cards", () => {
    const { units } = page([
      { name: "photography", kids: [{ name: "heading row", kids: [{ name: "h" }, { name: "view more" }] }, { name: "grid", kids: [{ name: "c1" }, { name: "c2" }, { name: "c3" }, { name: "c4" }] }] },
    ]);
    expect(units("photography", 1)).toEqual(["heading row", "grid"]);
    expect(units("photography", 2)).toEqual(["heading row", "c1", "c2", "c3", "c4"]);
  });

  it("never reaches into the section before when the paywall is first in its stack", () => {
    const { find } = page([
      { name: "section a", kids: [{ name: "photo" }] },
      { name: "section b", kids: [wrapped("paywall"), { name: "note", text: 1 }] },
    ]);
    expect(find("paywall")).toBeNull();
  });

  it("gives two paywalls their own layers, and skips one that holds another paywall", () => {
    const { find } = page([
      { name: "first", kids: [{ name: "a" }, { name: "b" }] },
      wrapped("first paywall"),
      { name: "second", text: 4 },
      wrapped("second paywall"),
    ]);
    expect(find("first paywall")).toBe("first");
    expect(find("second paywall")).toBe("second");
    const nested = page([{ name: "old post", text: 4 }, { name: "box", kids: [wrapped("inner")] }, wrapped("outer")]);
    // The box holds a paywall, and the text search stops at that paywall.
    expect(nested.find("outer")).toBeNull();
  });

  /** The published Home page of the test site, 2026-10-22: the paywall last in Featured, under a "View all" row. */
  const homePage = (): Spec[] => [
    {
      name: "page root",
      root: true,
      kids: [
        { name: "nav", position: "sticky", top: 0, height: 60 },
        {
          name: "hero",
          kids: [
            {
              name: "articles",
              kids: [
                {
                  name: "featured",
                  kids: [
                    { name: "title", top: 80, height: 40 },
                    { name: "grid", top: 140, height: 700 },
                    { name: "view all", top: 850, height: 30 },
                    { ...wrapped("paywall", true), top: 900, height: 160 },
                  ],
                },
                { name: "latest", top: 80, height: 1200 },
              ],
            },
          ],
        },
        { name: "categories", top: 1400, height: 1500 },
        { name: "categories phone", hidden: true },
        { name: "footer wrap", top: 3000, kids: [{ name: "footer container", kids: [{ name: "site footer", tag: "footer" }] }] },
        { name: "remix badge", position: "fixed", top: 3200, height: 40 },
      ],
    },
  ];

  it("skips a small View all row to lock the grid above it, and hides the row while locked (9.3)", () => {
    const { find, between } = page(homePage());
    expect(find("paywall")).toBe("grid");
    expect(between("grid", "paywall")).toEqual(["view all"]);
  });

  it("looks through Framer's boxless breakpoint wrappers: the grid's four cards count, not a 320px guess (9.4)", () => {
    // As published: each CMS card sits in a \`.ssr-variant\` with display: contents.
    const card = (name: string): Spec => ({ name: `${name} variant`, boxless: true, kids: [{ name }] });
    const { find, units } = page([
      {
        name: "featured",
        kids: [{ name: "grid", kids: [card("c1"), card("c2"), card("c3"), card("c4")] }, { name: "view all", height: 30 }, wrapped("paywall")],
      },
    ]);
    expect(find("paywall")).toBe("grid");
    expect(units("grid", 2)).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("never climbs out of a stack whose other layers sit in boxless wrappers", () => {
    const { find } = page([
      { name: "outer", kids: [{ name: "far above", height: 600 }, { name: "row", kids: [{ name: "v", boxless: true, kids: [{ name: "text", text: 1, height: 30 }] }, wrapped("paywall")] }] },
    ]);
    // The row's only layer before the paywall is a short text: no climbing to "far above".
    expect(find("paywall")).toBeNull();
  });

  it("gives up after three small layers rather than reaching far up", () => {
    const { find } = page([
      {
        name: "stack",
        kids: [{ name: "far", height: 600 }, { name: "s1", height: 20 }, { name: "s2", height: 20 }, { name: "s3", height: 20 }, { name: "s4", height: 20 }, wrapped("paywall")],
      },
    ]);
    expect(find("paywall")).toBeNull();
  });

  it("Below Paywall: Hide takes everything below on the page, but a column beside it, the footer, and fixed layers (9.3)", () => {
    const { below } = page(homePage());
    // Latest starts above the paywall, beside it; Categories is below; the
    // footer's wrappers are opened and the footer kept; the badge is fixed.
    // A copy hidden for another breakpoint is taken, so it stays hidden too.
    expect(below("paywall")).toEqual(["categories", "categories phone"]);
  });

  it("Below Paywall: Hide stops at the page root", () => {
    const { below } = page([{ name: "page root", root: true, kids: [{ name: "post", text: 4 }, wrapped("paywall")] }, { name: "outside the page" }]);
    expect(below("paywall")).toEqual([]);
  });

  it("falls back to the text search when the layer right above is another paywall's", () => {
    const { find } = page([{ name: "older", text: 3 }, { name: "claimed", owner: "other", kids: [{ name: "x" }] }, wrapped("paywall")]);
    expect(find("paywall")).toBe("older");
  });
});

describe("the sidebar, every setting doing something (2026-10-22)", () => {
  const controls = source.slice(source.indexOf("addPropertyControls(MeteredPaywall"));

  it("has no Canvas Preview, and no Checking label that was never shown", () => {
    expect(controls).not.toContain("canvasPreview");
    expect(source).not.toContain("canvasPreview");
    expect(source).not.toContain('checking: ["Checking"');
  });

  it("gives the Read More Teaser its own Lock Title and Lock Message, out of Labels", () => {
    expect(source).not.toContain('teaserTitle: ["Read More title"');
    expect(controls).toMatch(/teaserCardTitle: \{\s*type: ControlType\.String,\s*title: "Lock Title",\s*defaultValue: TEASER_TITLE,\s*hidden: \(props\) => props\.mode !== "teaser",/);
    expect(controls).toMatch(/teaserCardDescription: \{\s*type: ControlType\.String,\s*title: "Lock Message",/);
    expect(controls).toMatch(/cardTitle: \{\s*type: ControlType\.String,\s*title: "Lock Title",\s*defaultValue: CONFIG\.cardTitle,\s*hidden: \(props\) => props\.mode === "teaser",/);
  });

  it("still reads an older instance's teaser words from Labels", () => {
    const start = source.indexOf("function teaserWords(");
    const fn = source.slice(start, source.indexOf("\n}\n", start) + 2);
    const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
    // eslint-disable-next-line no-new-func
    const teaserWords = new Function(`${js}\nreturn teaserWords;`)() as (own: string | undefined, older: unknown, standard: string) => string;
    expect(teaserWords("Members only", "Old words", "Keep reading")).toBe("Members only");
    expect(teaserWords("Keep reading", "Old words", "Keep reading")).toBe("Old words");
    expect(teaserWords(undefined, "", "Keep reading")).toBe("Keep reading");
  });

  it("offers Below Paywall: Show by default; Hide hides the layers below only while not open", () => {
    expect(controls).toMatch(/belowPaywall: \{\s*type: ControlType\.Enum,\s*title: "Below Paywall",\s*options: \["show", "hide"\],\s*optionTitles: \["Show", "Hide"\],\s*displaySegmentedControl: true,\s*defaultValue: "show",/);
    expect(source).toContain('belowPaywall = "show",');
    // Part of linkedCss, which exists only while cut and off the canvas.
    expect(source).toContain('` [${MF_BELOW_ATTR}="${instanceId}"] { display: none !important; }`');
    expect(source).toContain("marked = layersBetween(linkedArticle, root).concat(hideBelow ? layersBelow(root) : []);");
    // Marked again on resize, old marks first.
    expect(source).toContain('window.addEventListener("resize", mark);');
    // Only its own marks are removed.
    expect(source).toContain("if (layer.getAttribute(MF_BELOW_ATTR) === instanceId) layer.removeAttribute(MF_BELOW_ATTR);");
  });

  it("says where it goes, and what Free Preview counts", () => {
    expect(controls).toContain('description: "Locks the layer right above it, on any page.');
    expect(controls).toContain('title: "Free Preview",');
    expect(controls).toContain("Paragraphs of a text block, or items of a stack, grid, or list, shown before the frost.");
  });
});

describe("the plugin no longer asks for the override", () => {
  it("writes no MemberArticle file when the Soft Paywall is added, and says so on the card", () => {
    const builder = readFileSync(path.join(process.cwd(), "src", "components", "tabs", "BuilderTab.tsx"), "utf-8");
    const registry = readFileSync(path.join(process.cwd(), "src", "components", "studio", "componentRegistry.ts"), "utf-8");
    expect(builder).not.toContain("writeCodeFile(framer, ARTICLE_TAG_FILE_NAME");
    expect(registry).toContain("Place it right below what it protects, on any page. No code override needed.");
  });
});
