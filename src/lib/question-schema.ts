import { z } from "zod";
import { mediaFileExists } from "@/lib/media";
import {
  SCORE_BASE_DEFAULT,
  SCORE_TIME_BONUS_DEFAULT,
  START_ZOOM_DEFAULT,
  START_ZOOM_MAX,
  START_ZOOM_MIN,
  type GameType,
} from "@/lib/types";

export const gameTypeSchema = z.enum(["TRIVIA", "IMAGE_ZOOM"]);

export const questionSchema = z.object({
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
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
});

export type QuestionInput = z.infer<typeof questionSchema>;

export function assertCorrectIndexes(questions: QuestionInput[]) {
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

  if (gameType === "IMAGE_ZOOM") {
    for (const q of questions) {
      if (!q.imageKey) {
        return "Each Image Zoom question needs an uploaded image";
      }
      if (!mediaFileExists(q.imageKey)) {
        return "An image is missing — re-upload it and try again";
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
  return {
    order,
    prompt: q.prompt,
    options: q.options,
    correctIndex: q.correctIndex,
    timeLimitSec: q.timeLimitSec,
    basePoints: q.basePoints,
    timeBonus: q.timeBonus,
    imageKey: gameType === "IMAGE_ZOOM" ? q.imageKey || null : null,
    startZoom: q.startZoom ?? START_ZOOM_DEFAULT,
  };
}
