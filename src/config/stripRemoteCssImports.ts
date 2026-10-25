/**
 * Keeps CDN stylesheets out of the build.
 *
 * Framer's own `framer-plugin/styles/framer.css` opens with
 * `@import url("https://fonts.googleapis.com/...")` for Inter. The panel
 * imports that file (`styles/framer-base.css`), so without this the built
 * CSS would load Google Fonts on every open. The panel bundles Inter itself
 * (`styles/fonts.css`), so the remote import is dropped instead of copying
 * Framer's file and letting it drift.
 *
 * A PostCSS plugin, because Vite inlines local `@import`s with PostCSS first
 * and leaves the remote ones as at-rules: this removes what is left. Any
 * remote `@import`, from any stylesheet, goes the same way.
 *
 * Plain objects rather than PostCSS's types, so this file needs no import.
 */

interface ImportAtRule {
  params: string;
  remove(): void;
}

/** True for `url("https://...")`, `"http://..."`, and protocol-relative `//host/...`. */
export function isRemoteImport(params: string): boolean {
  const target = params
    .trim()
    .replace(/^url\(\s*/i, "")
    .replace(/^["']/, "")
    .trim();
  return /^(https?:)?\/\//i.test(target);
}

export function stripRemoteCssImports() {
  return {
    postcssPlugin: "memberframe-strip-remote-css-imports",
    AtRule: {
      import(rule: ImportAtRule) {
        if (isRemoteImport(rule.params)) rule.remove();
      },
    },
  };
}
stripRemoteCssImports.postcss = true as const;
