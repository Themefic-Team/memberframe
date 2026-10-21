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
    expect(source).toContain('mfInjectPaywallSchema("Article");');
  });

  it("finds the article itself: a tagged layer first, else the nearest text block above with two paragraphs", () => {
    expect(source).toContain("function findArticle(root: Element | null): HTMLElement | null {");
    expect(source).toContain('[data-framer-component-type="RichTextContainer"]');
    expect(source).toContain('element.querySelectorAll("p").length >= 2');
    expect(source).toContain("filter(mfShown)");
    expect(source).toContain("linkedArticle.setAttribute(MF_ARTICLE_ATTR, \"\");");
  });

  it("cuts the tagged layer from the first render, and only while it is not open", () => {
    // `cut` is true in the "checking" phase the component starts in, so the
    // server-rendered page already hides the rest of the post.
    expect(source).toContain('const [view, setView] = useState<View>({ phase: "checking" });');
    expect(source).toContain('const cut = effective.phase !== "open";');
    expect(source).toMatch(/const linkedCss =\s*!onCanvas && cut/);
    expect(source).toContain("const target = `.${MF_LINKED_ARTICLE_CLASS}, [${MF_ARTICLE_ATTR}]`;");
    expect(source).toContain("{linkedCss ? <style>{linkedCss}</style> : null}");
  });

  it("fades with a mask, so it suits any page background", () => {
    const css = source.slice(source.indexOf("const linkedCss ="), source.indexOf("const goPricing"));
    expect(css).toContain("mask-image: linear-gradient(to bottom, #000 calc(100% - 120px), transparent)");
    expect(css).toContain("max-height: ${cutAt}px !important");
    expect(css).not.toMatch(/background:/);
  });

  it("keeps locked text out of focus and screen readers on the tagged layer", () => {
    expect(source).toMatch(/const body = linkedArticle;\s*if \(!body\) return;\s*if \(locked\) body\.setAttribute\("inert", ""\);/);
  });

  it("shows the lock card on the canvas, so it can be designed there", () => {
    const canvasBranch = source.slice(source.indexOf("function body(): React.ReactNode {"), source.indexOf("if (!linkedArticle) return null;"));
    expect(canvasBranch).toContain('lockCard(mode === "teaser" ? "teaser" : "meter", false)');
    expect(canvasBranch).toContain("Place this below the article.");
  });
});

describe("a linked paywall with no tagged post body", () => {
  it("shows nothing on the live site rather than a card under a readable post", () => {
    expect(source).toContain("if (!linkedArticle) return null;");
  });
});

describe("finding the article with no override (2026-10-20)", () => {
  // Cut out of the shipped file and run against a small fake page.
  const start = source.indexOf("/** Shown on this viewport");
  const end = source.indexOf("type TierKey =");
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;

  type Fake = { name: string; paragraphs: number; tagged?: boolean; hidden?: boolean; order: number; rich?: boolean };
  function find(layers: Fake[], paywallOrder: number): string | null {
    const make = (layer: Fake) => ({
      name: layer.name,
      order: layer.order,
      getClientRects: () => (layer.hidden ? [] : [{}]),
      querySelectorAll: () => ({ length: layer.paragraphs }),
      contains: () => false,
      compareDocumentPosition: (other: { order: number }) => (other.order > layer.order ? 4 : 2),
    });
    const all = layers.map(make);
    const document = {
      querySelectorAll: (selector: string) =>
        selector.startsWith(".")
          ? all.filter((_, index) => layers[index]!.tagged)
          : all.filter((_, index) => layers[index]!.rich !== false && !layers[index]!.tagged),
    };
    // eslint-disable-next-line no-new-func
    const api = new Function("document", "Node", "MF_LINKED_ARTICLE_CLASS", `${js}\nreturn { findArticle };`)(
      document,
      { DOCUMENT_POSITION_FOLLOWING: 4 },
      "mf-paywall-article"
    ) as { findArticle(root: unknown): { name: string } | null };
    return api.findArticle({ order: paywallOrder })?.name ?? null;
  }

  it("takes the nearest text block above with two or more paragraphs, skipping a heading block", () => {
    expect(find([{ name: "about", paragraphs: 8, order: 1 }, { name: "heading", paragraphs: 0, order: 2 }], 5)).toBe("about");
  });

  it("ignores a block below the paywall and a copy hidden for another breakpoint", () => {
    expect(
      find(
        [
          { name: "shown", paragraphs: 4, order: 1 },
          { name: "hidden copy", paragraphs: 4, order: 2, hidden: true },
          { name: "below", paragraphs: 9, order: 9 },
        ],
        5
      )
    ).toBe("shown");
  });

  it("prefers a layer given the PaywallArticle override", () => {
    expect(find([{ name: "tagged", paragraphs: 2, order: 1, tagged: true }, { name: "closer", paragraphs: 5, order: 3 }], 5)).toBe("tagged");
  });
});
