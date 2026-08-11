/**
 * Host TV headline while status is BETWEEN.
 * `nextIndex` is the 0-based index of the upcoming question
 * (already advanced when entering BETWEEN).
 */
export function betweenHeadline(nextIndex: number, total: number): string {
  const completed = Math.max(0, nextIndex);
  const remaining = total - nextIndex;

  // Endgame beats take priority (including 2-question games).
  if (remaining <= 1) return "One more";
  if (total >= 5 && remaining <= 2) return "Final stretch";

  const lines = [
    "Nice start",
    "Take a breath",
    "Looking good",
    "Keep rolling",
    "Stay sharp",
  ];
  return lines[(completed - 1) % lines.length] ?? "Take a breath";
}
