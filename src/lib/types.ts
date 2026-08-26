import type { BrandConfig } from "@/lib/branding";

export type GamePhase = "lobby" | "question" | "reveal" | "between" | "finished";

export type GameType = "TRIVIA" | "IMAGE_ZOOM";

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

export const GAME_TYPE_LABEL: Record<GameType, string> = {
  TRIVIA: "Trivia",
  IMAGE_ZOOM: "Image Zoom",
};

export const DISPLAY_NAME_KEY = "trivia-display-name";
