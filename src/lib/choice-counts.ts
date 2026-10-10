/** How many answers landed on each option, in option order. */
export function choiceCountsFor(
  optionCount: number,
  answers: { choiceIndex: number }[]
): number[] {
  const counts = Array.from({ length: Math.max(0, optionCount) }, () => 0);
  for (const answer of answers) {
    if (answer.choiceIndex >= 0 && answer.choiceIndex < counts.length) {
      counts[answer.choiceIndex] += 1;
    }
  }
  return counts;
}
