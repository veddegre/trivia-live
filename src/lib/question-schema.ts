import { z } from "zod";
import { mediaFileExists } from "@/lib/media";
import { ROUND_TITLE_MAX } from "@/lib/rounds";
import {
  SCORE_BASE_DEFAULT,
  SCORE_TIME_BONUS_DEFAULT,
  START_SPEED_DEFAULT,
  START_SPEED_MAX,
  START_SPEED_MIN,
  START_ZOOM_DEFAULT,
  START_ZOOM_MAX,
  START_ZOOM_MIN,
  gameTypeUsesAudio,
  gameTypeUsesImage,
  gameTypeUsesRevealText,
  questionTypeOf,
  type GameType,
} from "@/lib/types";
import { parseGuess } from "@/lib/closest-wager";
import { isQuestionBonus } from "@/lib/scoring";

export const gameTypeSchema = z.enum([
  "TRIVIA",
  "IMAGE_ZOOM",
  "AUDIO_SPEED",
  "PICTURE_FINISH",
  "AUDIO_REVERSE",
  "UNSCRAMBLE",
  "FINISH_LINE",
  "SILHOUETTE",
]);

export const questionSchema = z.object({
  gameType: gameTypeSchema.optional(),
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(1).max(6),
  typed: z.boolean().optional().default(false),
  closest: z.boolean().optional().default(false),
  wager: z.boolean().optional().default(false),
  correctIndex: z.number().int().min(0),
  timeLimitSec: z.number().int().min(5).max(300).default(30),
  basePoints: z.number().int().min(0).max(10000).default(SCORE_BASE_DEFAULT),
  timeBonus: z.number().int().min(0).max(10000).default(SCORE_TIME_BONUS_DEFAULT),
  imageKey: z.string().min(1).max(80).nullable().optional(),
  startZoom: z
    .number()
    .int()
    .min(START_ZOOM_MIN)
    .max(START_ZOOM_MAX)
    .default(START_ZOOM_DEFAULT),
  audioKey: z.string().min(1).max(80).nullable().optional(),
  startSpeed: z
    .number()
    .min(START_SPEED_MIN)
    .max(START_SPEED_MAX)
    .default(START_SPEED_DEFAULT),
  revealText: z.string().max(300).optional().default(""),
  roundTitle: z.string().max(ROUND_TITLE_MAX).optional().default(""),
  bonus: z
    .enum(["NONE", "DOUBLE", "LIGHTNING"])
    .optional()
    .default("NONE"),
});

export type QuestionInput = z.infer<typeof questionSchema>;

export function assertCorrectIndexes(
  questions: Array<{ options: string[]; correctIndex: number }>
) {
  for (const q of questions) {
    if (q.correctIndex >= q.options.length) {
      return "correctIndex out of range for a question";
    }
  }
  return null;
}

export function assertQuestionsForGameType(
  gameType: GameType,
  questions: QuestionInput[]
) {
  const indexErr = assertCorrectIndexes(questions);
  if (indexErr) return indexErr;
  for (const q of questions) {
    if (q.closest && q.wager) {
      return "A question can't be both a wager and a closest number";
    }
    if (q.closest) {
      const target = q.options[q.correctIndex] ?? "";
      if (parseGuess(target) == null) {
        return "Each closest-number question needs a number";
      }
    } else if (q.typed) {
      if (q.options.length < 1) return "Each typed question needs an accepted answer";
    } else if (q.options.length < 2) {
      return "Each question needs at least two options";
    }
  }

  for (const q of questions) {
    const type = questionTypeOf(q, gameType);
    if (gameTypeUsesImage(type)) {
      if (!q.imageKey) return "Each photo question needs an uploaded image";
      if (!mediaFileExists(q.imageKey)) {
        return "An image is missing — re-upload it and try again";
      }
    }
    if (gameTypeUsesRevealText(type)) {
      if (!q.revealText?.trim()) {
        return type === "UNSCRAMBLE"
          ? "Each Unscramble question needs a phrase"
          : "Each Finish the Line question needs a line";
      }
    }
    if (gameTypeUsesAudio(type)) {
      if (!q.audioKey) {
        return type === "AUDIO_REVERSE"
          ? "Each Backwards Song question needs an uploaded audio clip"
          : "Each Guess the Song question needs an uploaded audio clip";
      }
      if (!mediaFileExists(q.audioKey)) {
        return "An audio clip is missing — re-upload it and try again";
      }
    }
  }
  return null;
}

export function questionCreateData(
  q: QuestionInput,
  order: number,
  gameType: GameType
) {
  const type = questionTypeOf(q, gameType);
  return {
    order,
    gameType: type,
    prompt: q.prompt,
    options: q.options,
    correctIndex: q.correctIndex,
    typed: q.typed === true && q.closest !== true,
    closest: q.closest === true,
    wager: q.wager === true && q.closest !== true,
    timeLimitSec: q.timeLimitSec,
    basePoints: q.basePoints,
    timeBonus: q.timeBonus,
    imageKey: gameTypeUsesImage(type) ? q.imageKey || null : null,
    startZoom: q.startZoom ?? START_ZOOM_DEFAULT,
    audioKey: gameTypeUsesAudio(type) ? q.audioKey || null : null,
    startSpeed: q.startSpeed ?? START_SPEED_DEFAULT,
    revealText: gameTypeUsesRevealText(type)
      ? (q.revealText ?? "").trim().slice(0, 300)
      : "",
    roundTitle: (q.roundTitle ?? "").trim().slice(0, ROUND_TITLE_MAX),
    bonus: isQuestionBonus(q.bonus) ? q.bonus : "NONE",
  };
}
