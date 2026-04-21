const GREEK_TO_LATIN_MAP: Record<string, string> = {
  α: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "i",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  τ: "t",
  υ: "y",
  φ: "f",
  χ: "ch",
  ψ: "ps",
  ω: "o",
  ς: "s",
  ά: "a",
  έ: "e",
  ή: "i",
  ί: "i",
  ό: "o",
  ύ: "y",
  ώ: "o",
  ϊ: "i",
  ϋ: "y",
  ΐ: "i",
  ΰ: "y",
  Α: "A",
  Β: "V",
  Γ: "G",
  Δ: "D",
  Ε: "E",
  Ζ: "Z",
  Η: "I",
  Θ: "Th",
  Ι: "I",
  Κ: "K",
  Λ: "L",
  Μ: "M",
  Ν: "N",
  Ξ: "X",
  Ο: "O",
  Π: "P",
  Ρ: "R",
  Σ: "S",
  Τ: "T",
  Υ: "Y",
  Φ: "Ph",
  Χ: "Ch",
  Ψ: "Ps",
  Ω: "O",
};

const DOUBLE_CHAR_MAP: Record<string, string> = {
  αι: "ai",
  ει: "ei",
  οι: "oi",
  ου: "ou",
  υι: "yi",
  αυ: "av",
  ευ: "ev",
  ηυ: "iv",
  μπ: "b",
  ντ: "nt",
  γκ: "g",
  γγ: "ng",
};

const COMMON_REPLACEMENTS: Record<string, string> = {
  Αθήνα: "Athens",
  ΑΘΗΝΑ: "Athens",
  Πειραιάς: "Piraeus",
  Θεσσαλονίκη: "Thessaloniki",
  Οδός: "St.",
  ΟΔΟΣ: "St.",
  Λεωφόρος: "Ave.",
  ΛΕΩΦΟΡΟΣ: "Ave.",
  Πλατεία: "Sq.",
  ΠΛΑΤΕΙΑ: "Sq.",
  Ελλάδα: "Greece",
};

export function transliterateGreek(text: string): string {
  if (!text) return "";

  let result = text;

  for (const [gr, en] of Object.entries(COMMON_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${gr}\\b`, "g");
    result = result.replace(regex, en);
  }

  for (const [gr, en] of Object.entries(DOUBLE_CHAR_MAP)) {
    result = result.replace(new RegExp(gr, "g"), en);
    result = result.replace(
      new RegExp(gr.toUpperCase(), "g"),
      en.charAt(0).toUpperCase() + en.slice(1),
    );
  }

  return result
    .split("")
    .map((char) => GREEK_TO_LATIN_MAP[char] || char)
    .join("");
}

export function translateGreekAddress(address: string): string {
  if (!address) return "";

  if (!address) return "";

  return transliterateGreek(address);
}
