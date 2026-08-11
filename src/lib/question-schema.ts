import { z } from "zod";
import { SCORE_BASE_DEFAULT, SCORE_TIME_BONUS_DEFAULT } from "@/lib/types";

export const questionSchema = z.object({
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  timeLimitSec: z.number().int().min(5).max(300).default(30),
  basePoints: z.number().int().min(0).max(10000).default(SCORE_BASE_DEFAULT),
  timeBonus: z.number().int().min(0).max(10000).default(SCORE_TIME_BONUS_DEFAULT),
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
