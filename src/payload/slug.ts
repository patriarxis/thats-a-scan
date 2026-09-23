/**
 * The single slug transform. Used by the Tags collection's `beforeValidate`
 * hook and by both migration scripts — they each carried a verbatim copy, which
 * is exactly how a taxonomy ends up with `wild-style` and `wildstyle`.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
