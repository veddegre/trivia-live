import type { GamePublicState } from "@/lib/types";
import { visiblePuzzleText } from "@/lib/text-reveal";

/**
 * Watch screens get the puzzle as it looks right now.
 * The solved phrase stays on the host socket until reveal.
 */
export function forSpectator(
  state: GamePublicState,
  now = Date.now()
): GamePublicState {
  const question = state.question;
  if (!question?.revealText || state.phase !== "question") return state;
  if (state.gameType !== "UNSCRAMBLE" && state.gameType !== "FINISH_LINE") {
    return state;
  }
  const shown = visiblePuzzleText({
    text: question.revealText,
    mode: state.gameType === "FINISH_LINE" ? "line" : "unscramble",
    seed: question.id,
    openedAt: state.questionOpenedAt,
    timeLimitSec: state.timeLimitSec,
    now,
  });
  return {
    ...state,
    question: {
      ...question,
      revealText: shown,
      revealSnapshot: true,
    },
  };
}
