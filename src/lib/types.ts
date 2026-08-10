import type { BrandConfig } from "@/lib/branding";

export type GamePhase = "lobby" | "question" | "reveal" | "finished";

export type PublicQuestion = {
  id: string;
  order: number;
  prompt: string;
  options: string[];
  timeLimitSec: number;
  // correctIndex only included after reveal / for host
  correctIndex?: number;
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
  winner: LeaderboardEntry | null;
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
