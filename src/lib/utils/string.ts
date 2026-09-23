/**
 * Case- and accent-folding without trimming, so offsets into the folded string
 * still line up with the original. Use this when you need match indices.
 */
export function foldForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Comparison key for search and equality checks. Trims, so offsets shift. */
export function normalizeString(value: string): string {
  return foldForMatch(value).trim();
}
