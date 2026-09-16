import { z } from "zod";
import { prisma } from "@/lib/db";
import { ROUND_TITLE_MAX } from "@/lib/rounds";
import { isQuestionBonus } from "@/lib/scoring";
import { questionSchema, type QuestionInput } from "@/lib/question-schema";
import {
  SCORE_BASE_DEFAULT,
  SCORE_TIME_BONUS_DEFAULT,
  START_SPEED_DEFAULT,
  START_ZOOM_DEFAULT,
} from "@/lib/types";
import type { SessionUser } from "@/lib/auth";

export const MAX_BANKS = 40;
export const MAX_BANK_QUESTIONS = 80;
export const STARTER_BANK_TITLE = "Starter pack";

export const bankQuestionSchema = questionSchema.omit({
  imageKey: true,
  audioKey: true,
  startZoom: true,
  startSpeed: true,
  roundTitle: true,
});

export const bankWriteSchema = z.object({
  title: z.string().min(1).max(ROUND_TITLE_MAX),
  questions: z.array(bankQuestionSchema).min(1).max(MAX_BANK_QUESTIONS),
});

export type BankQuestionInput = z.infer<typeof bankQuestionSchema>;

export function banksOwnedBy(user: SessionUser) {
  if (user.role === "SUPERADMIN") return {};
  return { ownerId: user.id };
}

export function canManageBank(
  user: SessionUser,
  bank: { ownerId: string }
): boolean {
  if (user.role === "SUPERADMIN") return true;
  return bank.ownerId === user.id;
}

export function bankQuestionCreateData(q: BankQuestionInput, order: number) {
  return {
    order,
    prompt: q.prompt,
    options: q.options,
    correctIndex: q.correctIndex,
    timeLimitSec: q.timeLimitSec,
    basePoints: q.basePoints,
    timeBonus: q.timeBonus,
    bonus: isQuestionBonus(q.bonus) ? q.bonus : "NONE",
  };
}

/** Copy a bank question into a trivia night, using the bank title as the round. */
export function draftQuestionFromBank(
  q: BankQuestionInput,
  bankTitle: string
): QuestionInput {
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
    roundTitle: bankTitle.trim().slice(0, ROUND_TITLE_MAX),
  };
}

export function padDraftOptions(options: string[]): string[] {
  const next = [...options];
  while (next.length < 4) next.push("");
  return next.slice(0, 6);
}

export const STARTER_BANK_QUESTIONS: BankQuestionInput[] = [
  {
    prompt: "What is the capital of France?",
    options: ["Paris", "Lyon", "Marseille", "Nice"],
    correctIndex: 0,
    timeLimitSec: 30,
    basePoints: SCORE_BASE_DEFAULT,
    timeBonus: SCORE_TIME_BONUS_DEFAULT,
    bonus: "NONE",
  },
  {
    prompt: "How many strings does a standard guitar have?",
    options: ["4", "5", "6", "7"],
    correctIndex: 2,
    timeLimitSec: 30,
    basePoints: SCORE_BASE_DEFAULT,
    timeBonus: SCORE_TIME_BONUS_DEFAULT,
    bonus: "NONE",
  },
  {
    prompt: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    correctIndex: 1,
    timeLimitSec: 30,
    basePoints: SCORE_BASE_DEFAULT,
    timeBonus: SCORE_TIME_BONUS_DEFAULT,
    bonus: "NONE",
  },
  {
    prompt: "How many degrees are in a right angle?",
    options: ["45", "90", "180", "360"],
    correctIndex: 1,
    timeLimitSec: 30,
    basePoints: SCORE_BASE_DEFAULT,
    timeBonus: SCORE_TIME_BONUS_DEFAULT,
    bonus: "NONE",
  },
  {
    prompt: "Which ocean is the largest?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correctIndex: 3,
    timeLimitSec: 30,
    basePoints: SCORE_BASE_DEFAULT,
    timeBonus: SCORE_TIME_BONUS_DEFAULT,
    bonus: "NONE",
  },
  {
    prompt: "How many players are on the field for one soccer team?",
    options: ["9", "10", "11", "12"],
    correctIndex: 2,
    timeLimitSec: 30,
    basePoints: SCORE_BASE_DEFAULT,
    timeBonus: SCORE_TIME_BONUS_DEFAULT,
    bonus: "NONE",
  },
  {
    prompt: "What gas do plants absorb from the air?",
    options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"],
    correctIndex: 2,
    timeLimitSec: 30,
    basePoints: SCORE_BASE_DEFAULT,
    timeBonus: SCORE_TIME_BONUS_DEFAULT,
    bonus: "NONE",
  },
  {
    prompt: "Which of these is a primary color of light?",
    options: ["Green", "Yellow", "Orange", "Brown"],
    correctIndex: 0,
    timeLimitSec: 30,
    basePoints: SCORE_BASE_DEFAULT,
    timeBonus: SCORE_TIME_BONUS_DEFAULT,
    bonus: "NONE",
  },
];

export async function ensureStarterBank(ownerId: string) {
  const existing = await prisma.questionBank.findFirst({
    where: { ownerId, title: STARTER_BANK_TITLE },
    select: { id: true },
  });
  if (existing) return { bank: existing, created: false };

  const bank = await prisma.questionBank.create({
    data: {
      title: STARTER_BANK_TITLE,
      ownerId,
      questions: {
        create: STARTER_BANK_QUESTIONS.map((q, order) =>
          bankQuestionCreateData(q, order)
        ),
      },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  return { bank, created: true };
}
