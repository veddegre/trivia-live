/** A whole number or decimal. Commas and a leading $ are ignored. */
export function parseGuess(text: string): number | null {
  const cleaned = text.trim().replace(/[$,]/g, "").replace(/\s+/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const DISTANCE_TIE = 1e-6;

/** Ids of the guesses nearest the target. Invalid text is ignored. Ties all win. */
export function closestAnswerIds(
  target: number,
  guesses: { id: string; text: string }[]
): string[] {
  let best = Number.POSITIVE_INFINITY;
  const ranked: { id: string; distance: number }[] = [];
  for (const guess of guesses) {
    const value = parseGuess(guess.text);
    if (value == null) continue;
    const distance = Math.abs(value - target);
    ranked.push({ id: guess.id, distance });
    if (distance < best) best = distance;
  }
  if (!Number.isFinite(best)) return [];
  return ranked
    .filter((row) => row.distance <= best + DISTANCE_TIE)
    .map((row) => row.id);
}

/** Right answer adds the bet. Wrong answer subtracts it. */
export function wagerPoints(isCorrect: boolean, wager: number): number {
  const bet = Math.max(0, Math.trunc(wager));
  if (bet === 0) return 0;
  return isCorrect ? bet : -bet;
}
