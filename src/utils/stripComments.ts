/**
 * Whole-line comments out of a generated component, before it is written into
 * the creator's Framer project.
 *
 * The authored components explain themselves at length, and that explanation
 * is for this repository, not for every visitor's download of a published site
 * nor for the 40kB budget each component has to fit (PRD section 14.2 P3).
 *
 * Conservative on purpose, line by line, never inside a line:
 *   - a line that is only a `//` comment goes;
 *   - a block comment goes when it starts a line and its closing `*\/` ends one;
 *     one that closes mid-line, with code after it, is kept whole;
 *   - anything naming `@memberframe`, `@plugin-`, `@framer`, `@ts-`, or
 *     `eslint-` stays: the plugin's markers (config, license, lock state),
 *     Framer's layout annotations, and compiler directives.
 * A CSS comment inside a style string is a whole-line block comment too, and
 * removing it changes nothing. `test/stripComments.test.ts` holds that the
 * result compiles to exactly what the original does.
 */

const KEEP = /@memberframe|@plugin-|@framer|@ts-|eslint-/;

export function stripComments(source: string): string {
  const out: string[] = [];
  let block: string[] | null = null;

  for (const line of source.split("\n")) {
    const trimmed = line.trim();

    if (block) {
      block.push(line);
      const close = line.indexOf("*/");
      if (close !== -1) {
        // Code after the close: not a whole-line block, so keep it all.
        if (line.slice(close + 2).trim() !== "" || KEEP.test(block.join("\n"))) out.push(...block);
        block = null;
      }
      continue;
    }

    if (trimmed.startsWith("/*")) {
      const close = trimmed.indexOf("*/", 2);
      if (close === -1) {
        block = [line];
        continue;
      }
      if (trimmed.slice(close + 2).trim() !== "" || KEEP.test(trimmed)) out.push(line);
      continue;
    }

    if (trimmed.startsWith("//")) {
      if (KEEP.test(trimmed)) out.push(line);
      continue;
    }

    out.push(line);
  }

  // An unterminated block is not a comment this can judge: keep it.
  if (block) out.push(...block);

  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
