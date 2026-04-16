/**
 * Normalizes a string by converting it to NFD form, removing Greek diacritics (tonos, dialytika),
 * and converting to lowercase.
 */
export const normalizeStr = (str: string): string =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
