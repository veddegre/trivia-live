import { ROUND_TITLE_MAX } from "@/lib/rounds";
import { isQuestionBonus } from "@/lib/scoring";
import { START_SPEED_DEFAULT, START_ZOOM_DEFAULT } from "@/lib/types";

/**
 * Browser-safe bank helpers. question-bank.ts also talks to Prisma, so client
 * components must import these from here.
 */
export type DraftBankQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
  basePoints: number;
  timeBonus: number;
  bonus?: string;
};

export function padDraftOptions(options: string[]): string[] {
  const next = [...options];
  while (next.length < 4) next.push("");
  return next.slice(0, 6);
}

/** Copy a bank question into a trivia night, using the bank title as the round. */
export function draftQuestionFromBank(q: DraftBankQuestion, bankTitle: string) {
  const options = q.options.map((o) => o.trim()).filter(Boolean);
  return {
    prompt: q.prompt,
    options,
    correctIndex: Math.min(q.correctIndex, Math.max(0, options.length - 1)),
    timeLimitSec: q.timeLimitSec,
    basePoints: q.basePoints,
    timeBonus: q.timeBonus,
    bonus: isQuestionBonus(q.bonus) ? q.bonus : "NONE",
    imageKey: null,
    audioKey: null,
    startZoom: START_ZOOM_DEFAULT,
    startSpeed: START_SPEED_DEFAULT,
    revealText: "",
    roundTitle: bankTitle.trim().slice(0, ROUND_TITLE_MAX),
  };
}
