/**
 * The PaywallArticle tag: how a Soft Paywall finds a CMS post's body.
 * Development doc: `docs/development-docs/21-blog-paywalls.md`.
 *
 * The Soft Paywall takes its article through a slot, and Framer connects a
 * slot only to a frame outside every page, which has no CMS item. So on a CMS
 * page the component runs linked: Article Body empty, the post body tagged by
 * this override, and the component cutting and frosting the tagged layer.
 */

/**
 * The code file holding `PaywallArticle`. Framer lists it as "MemberArticle".
 *
 * The designer's way to paywall a CMS post: the Soft Paywall component sits
 * below the post with Article Body empty, styled in Framer's sidebar, and the
 * post body gets this override. The override only tags the layer; the
 * component finds the tag on the published site and cuts, frosts, and locks
 * it. Written whenever the Soft Paywall is added to the canvas.
 */
export const ARTICLE_TAG_FILE_NAME = "MemberArticle.tsx";

/** The class the component looks for. Held to `MF_LINKED_ARTICLE_CLASS` in MeteredPaywall by a test. */
export const LINKED_ARTICLE_CLASS = "mf-paywall-article";

/** The class the paywall's JSON-LD points search engines at. Held to `MF_GATED_BODY_CLASS`. */
export const GATED_BODY_CLASS = "memberframe-gated-body";

export function articleTagCode(): string {
  const classes = `${GATED_BODY_CLASS} ${LINKED_ARTICLE_CLASS}`;
  return [
    "// MemberFrame article tag.",
    "//",
    "// Written by the MemberFrame plugin when the Soft Paywall is added to the",
    "// canvas. It is replaced on the next add, so do not edit it here.",
    "//",
    "// To paywall a CMS post with a Soft Paywall you design on the canvas:",
    "//   1. Place the Soft Paywall below the post, and leave Article Body empty.",
    "//   2. Select the post body (the Rich Text, or the stack holding it), open",
    "//      Code overrides, choose File MemberArticle and PaywallArticle.",
    "//   3. Publish. The paywall cuts and frosts the tagged body on the live site.",
    "// Overrides do not run on the canvas, so the canvas shows the whole post.",
    "",
    'import * as React from "react"',
    "",
    "/** The post body a Soft Paywall on this page protects. One per page. */",
    "// forwardRef, as Framer's own overrides do: Framer's appear and scroll",
    "// effects hold the layer by its ref, and without it the layer stays at its",
    "// starting state (often invisible) on the published site.",
    "export function PaywallArticle(Component: React.ComponentType<any>): React.ComponentType<any> {",
    "  return React.forwardRef(function Tagged(props: any, ref: any) {",
    `    const className = props && props.className ? props.className + ${JSON.stringify(" " + classes)} : ${JSON.stringify(classes)}`,
    '    return React.createElement(Component, { ...props, ref, className, "data-mf-article": "" })',
    "  }) as React.ComponentType<any>",
    "}",
    "",
  ].join("\n");
}
