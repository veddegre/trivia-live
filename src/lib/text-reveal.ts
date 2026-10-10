function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hashSeed(seed));
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const swap = arr[i];
    arr[i] = arr[j];
    arr[j] = swap;
  }
  return arr;
}

export function revealProgress(
  openedAt: string | null | undefined,
  timeLimitSec: number | null | undefined,
  now: number,
  revealed: boolean
): number {
  if (revealed) return 1;
  if (!openedAt) return 0;
  const limit = Math.max(1, (timeLimitSec ?? 45) * 1000);
  const elapsed = now - new Date(openedAt).getTime();
  return Math.min(1, Math.max(0, elapsed / limit));
}

/** The phrase as it should appear at `now`. This string does not include hidden words. */
export function visiblePuzzleText(opts: {
  text: string;
  mode: "unscramble" | "line";
  seed: string;
  openedAt: string | null;
  timeLimitSec: number | null;
  now: number;
  revealed?: boolean;
}): string {
  const progress = revealProgress(
    opts.openedAt,
    opts.timeLimitSec,
    opts.now,
    !!opts.revealed
  );
  if (opts.mode === "line") {
    return finishLineTokens(opts.text, progress)
      .map((token) => token.text)
      .join(" ");
  }
  return unscrambleText(opts.text, progress, opts.seed);
}

function isLetter(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

/**
 * Letters start in a stable scramble and lock into place from the left.
 * Spaces and punctuation stay put. progress 0 is scrambled; 1 is the phrase.
 */
export function unscrambleText(
  text: string,
  progress: number,
  seed: string
): string {
  const chars = [...text];
  const letterIdx: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (isLetter(chars[i])) letterIdx.push(i);
  }
  const letters = letterIdx.map((i) => chars[i]);
  const n = letters.length;
  if (n === 0) return text;
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped >= 1) return text;

  let scrambled = seededShuffle(letters, seed);
  if (n > 1 && scrambled.every((ch, i) => ch === letters[i])) {
    scrambled = seededShuffle(letters, `${seed}:again`);
  }
  const locked = Math.floor(clamped * n);
  for (let i = 0; i < locked; i++) {
    if (scrambled[i] === letters[i]) continue;
    const j = scrambled.findIndex((ch, idx) => idx >= i && ch === letters[i]);
    if (j > i) {
      const swap = scrambled[i];
      scrambled[i] = scrambled[j];
      scrambled[j] = swap;
    }
  }
  const out = chars.slice();
  letterIdx.forEach((pos, i) => {
    out[pos] = scrambled[i];
  });
  return out.join("");
}

export type LineToken = { text: string; hidden: boolean };

/** The first word is visible immediately. Later words fill in as progress → 1. */
export function finishLineTokens(text: string, progress: number): LineToken[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const clamped = Math.min(1, Math.max(0, progress));
  const shown =
    clamped >= 1
      ? words.length
      : 1 + Math.floor(clamped * (words.length - 1));
  return words.map((word, i) => {
    if (i < shown) return { text: word, hidden: false };
    const blank = [...word]
      .map((ch) => (isLetter(ch) ? "·" : ch))
      .join("");
    return { text: blank, hidden: true };
  });
}
