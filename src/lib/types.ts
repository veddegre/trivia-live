import type { BrandConfig } from "@/lib/branding";
import type { RoundView } from "@/lib/rounds";
import type { QuestionBonus } from "@/lib/scoring";

export type GamePhase = "lobby" | "question" | "reveal" | "between" | "finished";

export type GameType =
  | "TRIVIA"
  | "IMAGE_ZOOM"
  | "AUDIO_SPEED"
  | "PICTURE_FINISH"
  | "AUDIO_REVERSE"
  | "UNSCRAMBLE"
  | "FINISH_LINE"
  | "SILHOUETTE";

export type PublicQuestion = {
  id: string;
  order: number;
  prompt: string;
  options: string[];
  timeLimitSec: number;
  /** Players type this answer. Options stay hidden until reveal. */
  typed?: boolean;
  // correctIndex only included after reveal / for host
  correctIndex?: number;
  /** Picks per option. Present on reveal, in the same order as options. */
  choiceCounts?: number[];
  imageUrl?: string | null;
  startZoom?: number;
  audioUrl?: string | null;
  startSpeed?: number;
  revealText?: string;
  /** Watch payload: revealText is the on-screen text, not the solved phrase. */
  revealSnapshot?: boolean;
  bonus?: QuestionBonus;
  /** Type of the question on screen. */
  gameType?: GameType;
};

export type LeaderboardEntry = {
  playerId: string;
  name: string;
  totalScore: number;
  lastPoints?: number;
  /** Set on a team row. */
  members?: number;
  /** Set on a person in the roster during a team night. */
  teamName?: string;
};

export type GamePublicState = {
  code: string;
  title: string;
  gameType: GameType;
  /** True when the night uses more than one question type. */
  mixedTypes?: boolean;
  phase: GamePhase;
  status: string;
  playerCount: number;
  answerCount: number;
  /** When true, the leaderboard is teams and phones share one answer. */
  teamMode: boolean;
  teamCount: number;
  /** People in the room. Kick uses this list. */
  roster: LeaderboardEntry[];
  questionIndex: number;
  questionTotal: number;
  question: PublicQuestion | null;
  questionOpenedAt: string | null;
  /** Set while the host has paused the open question. */
  questionPausedAt: string | null;
  /** Milliseconds the host has added to this question's clock. */
  questionExtraMs: number;
  /** Server time when this payload was built. Devices subtract the offset from Date.now(). */
  serverNow: string;
  timeLimitSec: number | null;
  leaderboard: LeaderboardEntry[];
  /** Present after a round ends (reveal / between / finished) */
  leader: LeaderboardEntry | null;
  winner: LeaderboardEntry | null;
  /** Finished: everyone sharing first place (length ≥ 2). */
  tiedWinners: LeaderboardEntry[] | null;
  /** Reveal / between: longest current streak of 3+ correct, if any. */
  hotStreak: { name: string; count: number } | null;
  allowLateJoin: boolean;
  allowAnswerChange: boolean;
  /** Null when no round names are set — question list is a single unlabeled night. */
  round: RoundView | null;
  rounds: { title: string; count: number }[] | null;
  /** BETWEEN only: the named round that just finished, with that round's scores. */
  endedRound: { title: string; leaderboard: LeaderboardEntry[] } | null;
  brand: BrandConfig;
};

export type PlayerView = {
  playerId: string;
  name: string;
  token: string;
  teamId: string | null;
  teamName: string | null;
  totalScore: number;
  /** What this player, or their team, typed. */
  answerText: string | null;
  hasAnswered: boolean;
  selectedChoice: number | null;
  lastResult: { isCorrect: boolean; points: number } | null;
};

export const SCORE_BASE_DEFAULT = 500;
export const SCORE_TIME_BONUS_DEFAULT = 500;

export const START_ZOOM_DEFAULT = 10;
export const START_ZOOM_MIN = 4;
export const START_ZOOM_MAX = 20;

export const START_SPEED_DEFAULT = 2;
export const START_SPEED_MIN = 1.25;
export const START_SPEED_MAX = 3;

export const GAME_TYPE_LABEL: Record<GameType, string> = {
  TRIVIA: "Trivia",
  IMAGE_ZOOM: "Image Zoom",
  AUDIO_SPEED: "Guess the Song",
  PICTURE_FINISH: "Picture Finish",
  AUDIO_REVERSE: "Backwards Song",
  UNSCRAMBLE: "Unscramble",
  FINISH_LINE: "Finish the Line",
  SILHOUETTE: "Silhouette",
};

export function isGameType(value: unknown): value is GameType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(GAME_TYPE_LABEL, value)
  );
}

export function questionTypeOf(
  question: { gameType?: string | null } | null | undefined,
  fallback: GameType = "TRIVIA"
): GameType {
  return question?.gameType && isGameType(question.gameType)
    ? question.gameType
    : fallback;
}

export function gameTypeUsesImage(type: GameType): boolean {
  return (
    type === "IMAGE_ZOOM" ||
    type === "PICTURE_FINISH" ||
    type === "SILHOUETTE"
  );
}

export function gameTypeUsesRevealText(type: GameType): boolean {
  return type === "UNSCRAMBLE" || type === "FINISH_LINE";
}

export function gameTypeUsesAudio(type: GameType): boolean {
  return type === "AUDIO_SPEED" || type === "AUDIO_REVERSE";
}

export const DISPLAY_NAME_KEY = "trivia-display-name";
