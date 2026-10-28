/**
 * Dev-only blocks in the canvas component sources.
 *
 * A free ngrok tunnel answers a browser with its own warning page unless the
 * request sends `ngrok-skip-browser-warning`, so each component sends that
 * header when its base URL is a tunnel. A shipped component never talks to a
 * tunnel, and Marketplace review problem 8 flagged the header as dev wiring in
 * the bundle. So those lines sit between these two markers, and a production
 * build removes them twice over:
 *
 *   - `vite.config.ts` strips them from the `?raw` sources the bundle carries,
 *     so `dist` holds no trace of them.
 *   - the code generator strips them from what it deploys, which is what the
 *     tests can see.
 *
 * `vite.config.ts` imports this file, so like `config/devProxy.ts` it must stay
 * free of `import.meta` and of anything in `src` that reads it.
 */

export const DEV_ONLY_START_MARKER = "// @memberframe-dev-only-start";
export const DEV_ONLY_END_MARKER = "// @memberframe-dev-only-end";

/**
 * Remove every marked block, markers and their own lines included.
 *
 * Throws on an unpaired marker: half a block removed is a syntax error on a
 * creator's published site, and that is a repo defect to fix, not ship.
 */
export function stripDevOnlyBlocks(source: string): string {
  let out = source;

  for (;;) {
    const start = out.indexOf(DEV_ONLY_START_MARKER);
    const end = out.indexOf(DEV_ONLY_END_MARKER);
    if (start === -1 && end === -1) return out;
    if (start === -1 || end === -1 || end < start) {
      throw new Error(`Unpaired ${DEV_ONLY_START_MARKER} / ${DEV_ONLY_END_MARKER} in a canvas component source.`);
    }

    const lineStart = out.lastIndexOf("\n", start) + 1;
    const lineEnd = out.indexOf("\n", end);
    out = out.slice(0, lineStart) + (lineEnd === -1 ? "" : out.slice(lineEnd + 1));
  }
}
