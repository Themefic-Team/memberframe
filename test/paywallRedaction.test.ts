/**
 * The Soft Paywall takes locked content out of the live page (2026-10-22):
 * past the free part, and in the layers hidden with it, text is scrambled in
 * place and media stripped, only on nodes React has hydrated, and restored on
 * access. The helpers are cut out of the shipped file and run on a small tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "src", "canvas-components", "MeteredPaywall.tsx"), "utf-8");
const block = source.slice(source.indexOf("// @memberframe-redact-start"), source.indexOf("// @memberframe-redact-end"));
const js = ts.transpileModule(block, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
// eslint-disable-next-line no-new-func
const api = new Function(`${js}\nreturn { mfScramble, mfRedactTree };`)() as {
  mfScramble(value: string): string;
  mfRedactTree(root: unknown, hide: (node: { name?: string }) => boolean): void;
};

type FakeNode = Record<string, unknown> & {
  nodeType: number;
  nodeName: string;
  nodeValue?: string;
  name?: string;
  attrs: Record<string, string>;
  firstChild: FakeNode | null;
  nextSibling: FakeNode | null;
};

function el(name: string, attrs: Record<string, string>, children: FakeNode[] = [], hydrated = true, label = ""): FakeNode {
  const node: FakeNode = {
    nodeType: 1,
    nodeName: name,
    name: label,
    attrs: { ...attrs },
    firstChild: children[0] ?? null,
    nextSibling: null,
    getAttribute: (key: string) => (key in node.attrs ? node.attrs[key] : null),
    setAttribute: (key: string, value: string) => {
      node.attrs[key] = value;
    },
  };
  children.forEach((child, index) => {
    if (index > 0) children[index - 1]!.nextSibling = child;
  });
  if (hydrated) node["__reactFiber$x1"] = {};
  return node;
}

const text = (value: string, label = ""): FakeNode =>
  ({ nodeType: 3, nodeName: "#text", nodeValue: value, name: label, attrs: {}, firstChild: null, nextSibling: null }) as FakeNode;

describe("the paywall takes locked content out of the live page", () => {
  it("scrambles letters and digits, keeping the text's shape", () => {
    const out = api.mfScramble("Chapter 3: The plan.");
    expect(out).toMatch(/^[A-Z][a-z]{6} \d: [A-Z][a-z]{2} [a-z]{4}\.$/);
  });

  it("scrambles only past the free part, strips media there, and restores on access", () => {
    const free = text("Free opening paragraph", "free");
    const locked = text("Paid ending paragraph", "locked");
    const photo = el("IMG", { src: "https://framerusercontent.com/images/paid.jpg", alt: "Paid photo" }, [], true, "locked");
    const article = el("DIV", {}, [el("P", {}, [free], true, "free"), el("P", {}, [locked], true, "locked"), photo], true, "article");

    // The test's "past the free part": nodes named locked, or inside a locked paragraph.
    const pastFree = (node: { name?: string }) => node.name === "locked";
    api.mfRedactTree(article, pastFree);
    expect(free.nodeValue).toBe("Free opening paragraph");
    expect(locked.nodeValue).not.toBe("Paid ending paragraph");
    expect(photo.attrs["src"]).toMatch(/^data:image\/gif;base64,/);
    expect(photo.attrs["alt"]).toBe("");

    api.mfRedactTree(article, () => false);
    expect(locked.nodeValue).toBe("Paid ending paragraph");
    expect(photo.attrs).toMatchObject({ src: "https://framerusercontent.com/images/paid.jpg", alt: "Paid photo" });
  });

  it("never touches a node React has not hydrated", () => {
    const early = text("Still server HTML");
    api.mfRedactTree(el("DIV", {}, [el("P", {}, [early], false)]), () => true);
    expect(early.nodeValue).toBe("Still server HTML");
  });

  it("runs only while locked, past the free edge and in the hidden layers, and restores when it goes", () => {
    const effect = source.slice(source.indexOf("// ---- While locked, take the locked content out of the live page ----"));
    expect(effect).toContain("if (!locked) {\n      restoreAll();");
    expect(effect).toContain("const edge = layer.getBoundingClientRect().top + freeHeight;");
    expect(effect).toContain("for (const element of now) mfRedactTree(element, () => true);");
    expect(effect).toContain("restoreAll(lastHidden);");
    // In place: nothing React owns is removed.
    expect(block).not.toContain("removeChild");
    expect(block).not.toContain(".remove()");
  });
});
