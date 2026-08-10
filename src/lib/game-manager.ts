import type { Game, Question, Player } from "@prisma/client";
import { resolveBrand } from "@/lib/branding";
import { getSiteBrand } from "@/lib/site-brand";
import { prisma } from "@/lib/db";
import { scoreAnswer } from "@/lib/scoring";
import type {
  GamePhase,
  GamePublicState,
  LeaderboardEntry,
  PlayerView,
  PublicQuestion,
} from "@/lib/types";

type GameWithRelations = Game & {
  questions: Question[];
  players: Player[];
};

type Runtime = {
  answerCount: number;
  dirtyLeaderboard: boolean;
  lastBroadcastAt: number;
  autoLockTimer?: ReturnType<typeof setTimeout>;
};

const runtime = new Map<string, Runtime>();

export function clearQuestionTimer(code: string) {
  const rt = runtime.get(code.toUpperCase());
  if (rt?.autoLockTimer) {
    clearTimeout(rt.autoLockTimer);
    rt.autoLockTimer = undefined;
  }
}

/** Schedule auto-lock when the question timer hits zero. */
export function scheduleQuestionAutoLock(
  code: string,
  timeLimitSec: number,
  onExpire: () => void
) {
  const key = code.toUpperCase();
  clearQuestionTimer(key);
  const rt = getRuntime(key);
  rt.autoLockTimer = setTimeout(() => {
    rt.autoLockTimer = undefined;
    onExpire();
  }, Math.max(0, timeLimitSec) * 1000);
}

function phaseFromStatus(status: Game["status"]): GamePhase {
  switch (status) {
    case "QUESTION":
      return "question";
    case "REVEAL":
      return "reveal";
    case "FINISHED":
      return "finished";
    case "LOBBY":
    case "DRAFT":
    default:
      return "lobby";
  }
}

function getRuntime(code: string): Runtime {
  let r = runtime.get(code);
  if (!r) {
    r = { answerCount: 0, dirtyLeaderboard: false, lastBroadcastAt: 0 };
    runtime.set(code, r);
  }
  return r;
}

async function loadGame(code: string): Promise<GameWithRelations | null> {
  return prisma.game.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      questions: { orderBy: { order: "asc" } },
      players: { orderBy: { totalScore: "desc" } },
    },
  });
}

function toLeaderboard(players: Player[], lastPoints?: Map<string, number>): LeaderboardEntry[] {
  return [...players]
    .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name))
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      totalScore: p.totalScore,
      lastPoints: lastPoints?.get(p.id),
    }));
}

export async function buildPublicState(
  code: string,
  opts?: { revealCorrect?: boolean }
): Promise<GamePublicState | null> {
  const game = await loadGame(code);
  if (!game) return null;

  const rt = getRuntime(game.code);
  const phase = phaseFromStatus(game.status);
  const q = game.questions[game.currentQuestionIndex] ?? null;
  const reveal =
    opts?.revealCorrect || phase === "reveal" || phase === "finished";

  let question: PublicQuestion | null = null;
  if (q && (phase === "question" || phase === "reveal" || phase === "finished")) {
    question = {
      id: q.id,
      order: q.order,
      prompt: q.prompt,
      options: q.options,
      timeLimitSec: q.timeLimitSec,
      ...(reveal ? { correctIndex: q.correctIndex } : {}),
    };
  }

  const leaderboard = toLeaderboard(game.players);
  const winner =
    phase === "finished" && leaderboard.length > 0 ? leaderboard[0] : null;

  // Refresh answer count from DB when in question/reveal
  if (q && (phase === "question" || phase === "reveal")) {
    rt.answerCount = await prisma.answer.count({ where: { questionId: q.id } });
  }

  const site = await getSiteBrand();
  const brand = resolveBrand(site, game);

  return {
    code: game.code,
    title: game.title,
    phase,
    status: game.status,
    playerCount: game.players.length,
    answerCount: rt.answerCount,
    questionIndex: game.currentQuestionIndex,
    questionTotal: game.questions.length,
    question,
    questionOpenedAt: game.questionOpenedAt?.toISOString() ?? null,
    timeLimitSec: q?.timeLimitSec ?? null,
    leaderboard,
    winner,
    brand,
  };
}

export async function buildPlayerView(
  code: string,
  playerId: string
): Promise<PlayerView | null> {
  const player = await prisma.player.findFirst({
    where: { id: playerId, game: { code: code.toUpperCase() } },
    include: {
      game: {
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!player) return null;

  const q = player.game.questions[player.game.currentQuestionIndex];
  let hasAnswered = false;
  let lastResult: PlayerView["lastResult"] = null;

  let selectedChoice: number | null = null;
  if (q) {
    const answer = await prisma.answer.findUnique({
      where: {
        playerId_questionId: { playerId: player.id, questionId: q.id },
      },
    });
    if (answer) {
      hasAnswered = true;
      selectedChoice = answer.choiceIndex;
      if (player.game.status === "REVEAL" || player.game.status === "FINISHED") {
        lastResult = { isCorrect: answer.isCorrect, points: answer.points };
      }
    }
  }

  return {
    playerId: player.id,
    name: player.name,
    token: player.token,
    totalScore: player.totalScore,
    hasAnswered,
    selectedChoice,
    lastResult,
  };
}

export async function openLobby(code: string) {
  await prisma.game.update({
    where: { code: code.toUpperCase() },
    data: { status: "LOBBY", currentQuestionIndex: 0, questionOpenedAt: null },
  });
  getRuntime(code.toUpperCase()).answerCount = 0;
}

export async function openQuestion(code: string, index?: number) {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");
  if (game.questions.length === 0) throw new Error("Game has no questions");

  const nextIndex = index ?? game.currentQuestionIndex;
  if (nextIndex < 0 || nextIndex >= game.questions.length) {
    throw new Error("Question index out of range");
  }

  const q = game.questions[nextIndex];
  const openedAt = new Date();
  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: "QUESTION",
      currentQuestionIndex: nextIndex,
      questionOpenedAt: openedAt,
    },
  });
  const rt = getRuntime(game.code);
  rt.answerCount = 0;
  return { openedAt, timeLimitSec: q.timeLimitSec, questionIndex: nextIndex };
}

export async function submitAnswer(opts: {
  code: string;
  playerToken: string;
  choiceIndex: number;
}) {
  const game = await loadGame(opts.code);
  if (!game) throw new Error("Game not found");
  if (game.status !== "QUESTION" || !game.questionOpenedAt) {
    throw new Error("Question is not open");
  }

  const player = game.players.find((p) => p.token === opts.playerToken);
  if (!player) throw new Error("Player not found");

  const q = game.questions[game.currentQuestionIndex];
  if (!q) throw new Error("No active question");

  if (opts.choiceIndex < 0 || opts.choiceIndex >= q.options.length) {
    throw new Error("Invalid choice");
  }

  const existing = await prisma.answer.findUnique({
    where: {
      playerId_questionId: { playerId: player.id, questionId: q.id },
    },
  });
  if (existing) throw new Error("Already answered");

  const answeredAt = new Date();
  const elapsedMs = answeredAt.getTime() - game.questionOpenedAt.getTime();
  if (elapsedMs > q.timeLimitSec * 1000) {
    throw new Error("Time is up");
  }
  const isCorrect = opts.choiceIndex === q.correctIndex;
  const points = scoreAnswer({
    isCorrect,
    elapsedMs,
    timeLimitSec: q.timeLimitSec,
    basePoints: q.basePoints,
    timeBonus: q.timeBonus,
  });

  await prisma.$transaction([
    prisma.answer.create({
      data: {
        playerId: player.id,
        questionId: q.id,
        choiceIndex: opts.choiceIndex,
        answeredAt,
        isCorrect,
        points,
      },
    }),
    prisma.player.update({
      where: { id: player.id },
      data: { totalScore: { increment: points } },
    }),
  ]);

  const rt = getRuntime(game.code);
  rt.answerCount += 1;
  rt.dirtyLeaderboard = true;

  return { points, isCorrect, playerId: player.id };
}

export async function lockQuestion(code: string) {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");
  if (game.status !== "QUESTION") throw new Error("No open question");

  clearQuestionTimer(game.code);
  await prisma.game.update({
    where: { id: game.id },
    data: { status: "REVEAL" },
  });
}

export async function nextQuestion(code: string) {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");

  const next = game.currentQuestionIndex + 1;
  if (next >= game.questions.length) {
    await prisma.game.update({
      where: { id: game.id },
      data: { status: "FINISHED", questionOpenedAt: null },
    });
    return { finished: true as const };
  }

  const opened = await openQuestion(game.code, next);
  return {
    finished: false as const,
    index: next,
    timeLimitSec: opened.timeLimitSec,
  };
}

export async function finishGame(code: string) {
  clearQuestionTimer(code);
  await prisma.game.update({
    where: { code: code.toUpperCase() },
    data: { status: "FINISHED", questionOpenedAt: null },
  });
}

/**
 * Clear players/answers and return the game to lobby.
 * Keeps questions, join code, host token, and branding.
 */
export async function resetGame(gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");

  clearQuestionTimer(game.code);

  await prisma.$transaction([
    prisma.answer.deleteMany({
      where: { player: { gameId: game.id } },
    }),
    prisma.player.deleteMany({ where: { gameId: game.id } }),
    prisma.game.update({
      where: { id: game.id },
      data: {
        status: "LOBBY",
        currentQuestionIndex: 0,
        questionOpenedAt: null,
      },
    }),
  ]);

  const rt = getRuntime(game.code);
  rt.answerCount = 0;
  rt.dirtyLeaderboard = false;

  return prisma.game.findUnique({
    where: { id: game.id },
    include: {
      questions: { orderBy: { order: "asc" } },
      _count: { select: { questions: true, players: true } },
    },
  });
}

export function shouldThrottleBroadcast(code: string, minMs = 250): boolean {
  const rt = getRuntime(code.toUpperCase());
  const now = Date.now();
  if (now - rt.lastBroadcastAt < minMs) return true;
  rt.lastBroadcastAt = now;
  return false;
}

export function markBroadcast(code: string) {
  getRuntime(code.toUpperCase()).lastBroadcastAt = Date.now();
}
