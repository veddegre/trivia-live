export const ROUND_TITLE_MAX = 40;

export type RoundGroup = {
  title: string;
  index: number;
  startIndex: number;
  endIndex: number;
};

export type RoundView = {
  title: string;
  index: number;
  total: number;
  questionInRound: number;
  questionsInRound: number;
};

export function resolvedRoundTitles(titles: string[]): string[] {
  const out: string[] = [];
  let prev = "";
  for (const raw of titles) {
    const t = raw.trim();
    if (t) {
      prev = t;
      out.push(t);
    } else {
      out.push(prev);
    }
  }
  return out;
}

export function hasNamedRounds(titles: string[]): boolean {
  return titles.some((t) => t.trim().length > 0);
}

export function groupRounds(titles: string[]): RoundGroup[] {
  const resolved = resolvedRoundTitles(titles);
  if (resolved.length === 0) return [];
  const named = hasNamedRounds(titles);
  const groups: RoundGroup[] = [];
  let start = 0;
  for (let i = 1; i <= resolved.length; i++) {
    if (i < resolved.length && resolved[i] === resolved[start]) continue;
    groups.push({
      title: named
        ? resolved[start] || `Round ${groups.length + 1}`
        : "",
      index: groups.length,
      startIndex: start,
      endIndex: i - 1,
    });
    start = i;
  }
  return groups;
}

export function roundForQuestion(
  titles: string[],
  questionIndex: number
): RoundGroup | null {
  if (questionIndex < 0) return null;
  return (
    groupRounds(titles).find(
      (g) => questionIndex >= g.startIndex && questionIndex <= g.endIndex
    ) ?? null
  );
}

export function roundViewAt(
  titles: string[],
  questionIndex: number
): RoundView | null {
  if (!hasNamedRounds(titles)) return null;
  const groups = groupRounds(titles);
  const group = roundForQuestion(titles, questionIndex);
  if (!group) return null;
  return {
    title: group.title,
    index: group.index,
    total: groups.length,
    questionInRound: questionIndex - group.startIndex,
    questionsInRound: group.endIndex - group.startIndex + 1,
  };
}

/** True when this question is the last of a named round and more questions follow. */
export function isEndOfNamedRound(
  titles: string[],
  questionIndex: number
): boolean {
  if (!hasNamedRounds(titles)) return false;
  const group = roundForQuestion(titles, questionIndex);
  if (!group || group.endIndex !== questionIndex) return false;
  return group.endIndex < titles.length - 1;
}

export function roundSummaries(
  titles: string[]
): { title: string; count: number }[] | null {
  if (!hasNamedRounds(titles)) return null;
  return groupRounds(titles).map((g) => ({
    title: g.title,
    count: g.endIndex - g.startIndex + 1,
  }));
}
