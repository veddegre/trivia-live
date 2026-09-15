import type { BrandConfig } from "@/lib/branding";
import type { RoundView } from "@/lib/rounds";

export type GamePhase = "lobby" | "question" | "reveal" | "between" | "finished";

export type GameType = "TRIVIA" | "IMAGE_ZOOM" | "AUDIO_SPEED" | "PICTURE_FINISH";

export type PublicQuestion = {
  id: string;
  order: number;
  prompt: string;
  options: string[];
  timeLimitSec: number;
  // correctIndex only included after reveal / for host
  correctIndex?: number;
  imageUrl?: string | null;
  startZoom?: number;
  audioUrl?: string | null;
  startSpeed?: number;
};

export type LeaderboardEntry = {
  playerId: string;
  name: string;
  totalScore: number;
  lastPoints?: number;
};

export type GamePublicState = {
  code: string;
  title: string;
  gameType: GameType;
  phase: GamePhase;
  status: string;
  playerCount: number;
  answerCount: number;
  questionIndex: number;
  questionTotal: number;
  question: PublicQuestion | null;
  questionOpenedAt: string | null;
  timeLimitSec: number | null;
  leaderboard: LeaderboardEntry[];
  /** Present after a round ends (reveal / between / finished) */
  leader: LeaderboardEntry | null;
  winner: LeaderboardEntry | null;
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
  totalScore: number;
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
};

export function gameTypeUsesImage(type: GameType): boolean {
  return type === "IMAGE_ZOOM" || type === "PICTURE_FINISH";
}

export function gameTypeUsesAudio(type: GameType): boolean {
  return type === "AUDIO_SPEED";
}

export const DISPLAY_NAME_KEY = "trivia-display-name";
