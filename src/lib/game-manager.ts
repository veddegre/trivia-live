import { randomBytes } from "crypto";
import type { Game, Question, Player } from "@prisma/client";
import { resolveBrand } from "@/lib/branding";
import { generateJoinCode } from "@/lib/codes";
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
    case "BETWEEN":
      return "between";
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

  // Refresh answer count from DB when in question/reveal
  if (q && (phase === "question" || phase === "reveal")) {
    rt.answerCount = await prisma.answer.count({ where: { questionId: q.id } });
  }

  // Round points stay off the board until reveal (applied in lockQuestion)
  let lastPoints: Map<string, number> | undefined;
  const scoredQuestion =
    phase === "reveal" || phase === "finished"
      ? q
      : phase === "between"
        ? game.questions[game.currentQuestionIndex - 1] ?? null
        : null;
  if (scoredQuestion) {
    const answers = await prisma.answer.findMany({
      where: { questionId: scoredQuestion.id },
      select: { playerId: true, points: true },
    });
    lastPoints = new Map(answers.map((a) => [a.playerId, a.points]));
  }

  const leaderboard = toLeaderboard(game.players, lastPoints);
  const winner =
    phase === "finished" && leaderboard.length > 0 ? leaderboard[0] : null;
  const leader = leaderboard.length > 0 ? leaderboard[0] : null;

  const brand = resolveBrand();

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
    leader:
      phase === "reveal" || phase === "between" || phase === "finished"
        ? leader
        : null,
    winner,
    allowLateJoin: game.allowLateJoin,
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

  const status = player.game.status;
  const q = player.game.questions[player.game.currentQuestionIndex];
  const resultQuestion =
    status === "BETWEEN"
      ? player.game.questions[player.game.currentQuestionIndex - 1]
      : q;
  let hasAnswered = false;
  let lastResult: PlayerView["lastResult"] = null;

  let selectedChoice: number | null = null;
  if (q && status === "QUESTION") {
    const answer = await prisma.answer.findUnique({
      where: {
        playerId_questionId: { playerId: player.id, questionId: q.id },
      },
    });
    if (answer) {
      hasAnswered = true;
      selectedChoice = answer.choiceIndex;
    }
  } else if (resultQuestion) {
    const answer = await prisma.answer.findUnique({
      where: {
        playerId_questionId: {
          playerId: player.id,
          questionId: resultQuestion.id,
        },
      },
    });
    if (answer) {
      hasAnswered = true;
      selectedChoice = answer.choiceIndex;
      if (status === "REVEAL" || status === "BETWEEN" || status === "FINISHED") {
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
  if (game.status === "QUESTION") throw new Error("A question is already open");
  if (game.status === "REVEAL") {
    throw new Error("Finish the reveal first — hit Continue");
  }
  if (game.status === "FINISHED") throw new Error("Game is finished");

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

  // Store points on the answer, but do not add to totals until the round locks
  await prisma.answer.create({
    data: {
      playerId: player.id,
      questionId: q.id,
      choiceIndex: opts.choiceIndex,
      answeredAt,
      isCorrect,
      points,
    },
  });

  const rt = getRuntime(game.code);
  rt.answerCount += 1;
  rt.dirtyLeaderboard = true;

  // Don't return points/isCorrect — that would spoil the round on the phone
  return { playerId: player.id };
}

/** Apply pending answer points for the current question onto player totals. */
async function applyRoundScores(game: GameWithRelations) {
  const q = game.questions[game.currentQuestionIndex];
  if (!q) return;

  const answers = await prisma.answer.findMany({
    where: { questionId: q.id },
  });

  if (answers.length === 0) return;

  await prisma.$transaction(
    answers.map((a) =>
      prisma.player.update({
        where: { id: a.playerId },
        data: { totalScore: { increment: a.points } },
      })
    )
  );
}

export async function lockQuestion(code: string) {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");
  if (game.status !== "QUESTION") throw new Error("No open question");

  clearQuestionTimer(game.code);
  await applyRoundScores(game);
  await prisma.game.update({
    where: { id: game.id },
    data: { status: "REVEAL" },
  });
}

/**
 * Snapshot the podium when a night ends. Survives Play again (players are wiped).
 * Idempotent per gameId + join code so double-finish doesn’t duplicate.
 */
export async function recordGameResult(code: string) {
  const game = await loadGame(code);
  if (!game || game.players.length === 0) return null;

  const board = toLeaderboard(game.players);
  const winner = board[0];
  if (!winner) return null;

  const podium = board.slice(0, 3).map((p) => ({
    name: p.name,
    totalScore: p.totalScore,
  }));

  try {
    return await prisma.gameResult.upsert({
      where: {
        gameId_joinCode: { gameId: game.id, joinCode: game.code },
      },
      create: {
        gameId: game.id,
        ownerId: game.ownerId,
        gameTitle: game.title,
        joinCode: game.code,
        winnerName: winner.name,
        winnerScore: winner.totalScore,
        playerCount: game.players.length,
        podium,
      },
      update: {
        ownerId: game.ownerId,
        gameTitle: game.title,
        winnerName: winner.name,
        winnerScore: winner.totalScore,
        playerCount: game.players.length,
        podium,
      },
    });
  } catch {
    // gameId may be null uniqueness edge — fall through
    return null;
  }
}

/**
 * After reveal: finish the game, or pause on BETWEEN standings before the next question.
 */
export async function nextQuestion(code: string) {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");
  if (game.status !== "REVEAL") throw new Error("Not revealing a question");

  const next = game.currentQuestionIndex + 1;
  if (next >= game.questions.length) {
    await prisma.game.update({
      where: { id: game.id },
      data: { status: "FINISHED", questionOpenedAt: null },
    });
    await recordGameResult(game.code);
    return { finished: true as const, between: false as const };
  }

  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: "BETWEEN",
      currentQuestionIndex: next,
      questionOpenedAt: null,
    },
  });
  return { finished: false as const, between: true as const, index: next };
}

export async function finishGame(code: string) {
  clearQuestionTimer(code);
  const game = await loadGame(code);
  if (game?.status === "QUESTION") {
    await applyRoundScores(game);
  }
  await prisma.game.update({
    where: { code: code.toUpperCase() },
    data: { status: "FINISHED", questionOpenedAt: null },
  });
  await recordGameResult(code);
}

async function uniqueJoinCode(): Promise<string> {
  let code = generateJoinCode();
  for (let i = 0; i < 8; i++) {
    const clash = await prisma.game.findUnique({ where: { code } });
    if (!clash) return code;
    code = generateJoinCode();
  }
  return generateJoinCode(7);
}

/**
 * Clear players/answers and return the game to lobby.
 * Issues a new join code + host token; keeps questions.
 */
export async function resetGame(gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");

  const previousCode = game.code;
  clearQuestionTimer(previousCode);

  const nextCode = await uniqueJoinCode();
  const hostToken = randomBytes(18).toString("hex");

  await prisma.$transaction([
    prisma.answer.deleteMany({
      where: { player: { gameId: game.id } },
    }),
    prisma.player.deleteMany({ where: { gameId: game.id } }),
    prisma.game.update({
      where: { id: game.id },
      data: {
        code: nextCode,
        hostToken,
        status: "LOBBY",
        currentQuestionIndex: 0,
        questionOpenedAt: null,
      },
    }),
  ]);

  runtime.delete(previousCode.toUpperCase());
  const rt = getRuntime(nextCode);
  rt.answerCount = 0;
  rt.dirtyLeaderboard = false;

  const updated = await prisma.game.findUnique({
    where: { id: game.id },
    include: {
      questions: { orderBy: { order: "asc" } },
      _count: { select: { questions: true, players: true } },
    },
  });

  return { game: updated, previousCode };
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
