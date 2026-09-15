import { resolvedRoundTitles, roundSummaries } from "@/lib/rounds";
import type { GameType } from "@/lib/types";

export const NIGHT_RECAP_VERSION = 1;

export type RecapAnswer = {
  name: string;
  choiceIndex: number | null;
  isCorrect: boolean;
  points: number;
};

export type RecapQuestion = {
  order: number;
  prompt: string;
  roundTitle: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
  answerCount: number;
  correctCount: number;
  answers: RecapAnswer[];
};

export type NightRecap = {
  version: 1;
  gameType: GameType;
  standings: { name: string; totalScore: number }[];
  rounds: { title: string; count: number }[] | null;
  questions: RecapQuestion[];
};

export type RecapSourceQuestion = {
  id: string;
  order: number;
  prompt: string;
  roundTitle: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
};

export type RecapSourcePlayer = {
  id: string;
  name: string;
  totalScore: number;
};

export type RecapSourceAnswer = {
  playerId: string;
  questionId: string;
  choiceIndex: number;
  isCorrect: boolean;
  points: number;
};

export function buildNightRecap(opts: {
  gameType: GameType;
  questions: RecapSourceQuestion[];
  players: RecapSourcePlayer[];
  answers: RecapSourceAnswer[];
}): NightRecap {
  const questions = [...opts.questions].sort((a, b) => a.order - b.order);
  const standings = [...opts.players].sort(
    (a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name)
  );
  const titles = questions.map((q) => q.roundTitle);
  const resolved = resolvedRoundTitles(titles);
  const byQuestion = new Map<string, RecapSourceAnswer[]>();
  for (const a of opts.answers) {
    const list = byQuestion.get(a.questionId) ?? [];
    list.push(a);
    byQuestion.set(a.questionId, list);
  }

  return {
    version: NIGHT_RECAP_VERSION,
    gameType: opts.gameType,
    standings: standings.map((p) => ({
      name: p.name,
      totalScore: p.totalScore,
    })),
    rounds: roundSummaries(titles),
    questions: questions.map((q, i) => {
      const rows = byQuestion.get(q.id) ?? [];
      const byPlayer = new Map(rows.map((a) => [a.playerId, a]));
      const answers: RecapAnswer[] = standings.map((p) => {
        const hit = byPlayer.get(p.id);
        if (!hit) {
          return {
            name: p.name,
            choiceIndex: null,
            isCorrect: false,
            points: 0,
          };
        }
        return {
          name: p.name,
          choiceIndex: hit.choiceIndex,
          isCorrect: hit.isCorrect,
          points: hit.points,
        };
      });
      const answered = answers.filter((a) => a.choiceIndex != null);
      return {
        order: q.order,
        prompt: q.prompt,
        roundTitle: resolved[i] || "",
        options: q.options,
        correctIndex: q.correctIndex,
        timeLimitSec: q.timeLimitSec,
        answerCount: answered.length,
        correctCount: answered.filter((a) => a.isCorrect).length,
        answers,
      };
    }),
  };
}

export function isNightRecap(value: unknown): value is NightRecap {
  if (!value || typeof value !== "object") return false;
  const v = value as NightRecap;
  return (
    v.version === 1 &&
    Array.isArray(v.standings) &&
    Array.isArray(v.questions)
  );
}

export function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function recapToCsv(recap: NightRecap): string {
  const lines: string[] = ["Standings"];
  lines.push(["Place", "Name", "Score"].map(csvCell).join(","));
  recap.standings.forEach((row, i) => {
    lines.push(
      [i + 1, row.name, row.totalScore].map(csvCell).join(",")
    );
  });

  lines.push("");
  lines.push("Questions");
  lines.push(
    ["#", "Round", "Prompt", "Correct", "Answered", "Accuracy"]
      .map(csvCell)
      .join(",")
  );
  for (const q of recap.questions) {
    const correct = q.options[q.correctIndex] ?? "";
    const accuracy =
      q.answerCount === 0
        ? ""
        : `${Math.round((q.correctCount / q.answerCount) * 100)}%`;
    lines.push(
      [
        q.order + 1,
        q.roundTitle,
        q.prompt,
        correct,
        q.answerCount,
        accuracy,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  lines.push("");
  lines.push("Answers");
  lines.push(
    ["#", "Round", "Player", "Choice", "Correct", "Points"]
      .map(csvCell)
      .join(",")
  );
  for (const q of recap.questions) {
    for (const a of q.answers) {
      const choice =
        a.choiceIndex == null ? "" : (q.options[a.choiceIndex] ?? "");
      lines.push(
        [
          q.order + 1,
          q.roundTitle,
          a.name,
          choice,
          a.choiceIndex == null ? "" : a.isCorrect ? "yes" : "no",
          a.points,
        ]
          .map(csvCell)
          .join(",")
      );
    }
  }

  return lines.join("\n") + "\n";
}

export function recapFilename(title: string, joinCode: string): string {
  const slug =
    title
      .normalize("NFKD")
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "recap";
  return `${slug}-${joinCode}.csv`;
}
