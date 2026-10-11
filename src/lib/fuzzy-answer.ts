/** Lowercase, drop accents and punctuation, and ignore a leading The / A / An. */
export function normalizeAnswer(raw: string): string {
  const stripped = raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.replace(/^(the|a|an)\s+/, "");
}

function typoLimit(length: number): number {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  return 2;
}

/** Distance, or one past `limit` once it is clear the strings are farther apart. */
function levenshtein(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const value = Math.min(
        prev[j] + 1,
        next[j - 1] + 1,
        prev[j - 1] + cost
      );
      next[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > limit) return limit + 1;
    prev = next;
  }
  return prev[b.length];
}

/**
 * Index of the accepted answer this guess matches, or -1.
 * Exact normalized matches win. Short answers do not get a typo allowance.
 */
export function matchTypedAnswer(guess: string, accepted: string[]): number {
  const normalized = normalizeAnswer(guess);
  if (!normalized) return -1;
  for (let i = 0; i < accepted.length; i++) {
    if (normalizeAnswer(accepted[i] ?? "") === normalized) return i;
  }
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < accepted.length; i++) {
    const target = normalizeAnswer(accepted[i] ?? "");
    if (!target) continue;
    const limit = typoLimit(Math.max(normalized.length, target.length));
    if (limit === 0) continue;
    const dist = levenshtein(normalized, target, limit);
    if (dist <= limit && dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}
