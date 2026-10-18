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
    expect(code).toContain("{ ...props, className,");
    expect(code).toContain(`props.className + " ${GATED_BODY_CLASS} ${LINKED_ARTICLE_CLASS}"`);
    expect(code).toContain(`: "${GATED_BODY_CLASS} ${LINKED_ARTICLE_CLASS}"`);
  });

  it("uses the classes the component looks for and the schema points at", () => {
    expect(source).toContain(`const MF_LINKED_ARTICLE_CLASS = "${LINKED_ARTICLE_CLASS}";`);
    expect(source).toContain(`const MF_GATED_BODY_CLASS = "${GATED_BODY_CLASS}";`);
  });
});

describe("the component in linked mode", () => {
  it("is linked whenever Article Body is empty", () => {
    expect(source).toContain("const linked = !hasArticle;");
  });

  it("cuts the tagged layer from the first render, and only while it is not open", () => {
    // `cut` is true in the "checking" phase the component starts in, so the
    // server-rendered page already hides the rest of the post.
    expect(source).toContain('const [view, setView] = useState<View>({ phase: "checking" });');
    expect(source).toContain('const cut = effective.phase !== "open";');
    expect(source).toMatch(/const linkedCss =\s*linked && !onCanvas && cut/);
    expect(source).toContain("{linkedCss ? <style>{linkedCss}</style> : null}");
  });

  it("fades with a mask, so it suits any page background", () => {
    const css = source.slice(source.indexOf("const linkedCss ="), source.indexOf("const goPricing"));
    expect(css).toContain("mask-image: linear-gradient(to bottom, #000 calc(100% - 120px), transparent)");
    expect(css).toContain("max-height: ${cutAt}px !important");
    expect(css).not.toMatch(/background:/);
  });

  it("keeps locked text out of focus and screen readers on the tagged layer", () => {
    expect(source).toContain("const articleElement = (): HTMLElement | null => (linked ? linkedArticle : bodyRef.current);");
    expect(source).toMatch(/const body = articleElement\(\);\s*if \(!body\) return;\s*if \(locked\) body\.setAttribute\("inert", ""\);/);
  });

  it("shows the lock card on the canvas, so it can be designed there", () => {
    const linkedBranch = source.slice(source.indexOf("if (linked) {"), source.indexOf("return (\n      <React.Fragment>\n        {onCanvas ?"));
    expect(linkedBranch).toContain('lockCard(mode === "teaser" ? "teaser" : "meter", false)');
    expect(linkedBranch).toContain("PaywallArticle override");
  });
});

describe("a linked paywall with no tagged post body", () => {
  it("shows nothing on the live site rather than a card under a readable post", () => {
    expect(source).toContain("if (!linkedArticle) return null;");
  });
});
