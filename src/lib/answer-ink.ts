/** Wong / IBM colorblind-safe inks for A–F letter chips on phones. */
const LETTER_INK = [
  { bg: "#E69F00", fg: "#1a1200" },
  { bg: "#56B4E9", fg: "#0b1a24" },
  { bg: "#009E73", fg: "#04140f" },
  { bg: "#F0E442", fg: "#1a1200" },
  { bg: "#0072B2", fg: "#f4f7fb" },
  { bg: "#D55E00", fg: "#fff8f3" },
] as const;

export function answerLetterInk(index: number) {
  return LETTER_INK[index % LETTER_INK.length];
}
