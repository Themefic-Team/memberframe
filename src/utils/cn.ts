/**
 * Joins class names, dropping anything falsy.
 *
 * The zero-inline-CSS rule means every visual state is a class, so components
 * compose class strings constantly. This keeps that from turning into template
 * literals full of `&&` and stray spaces.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
