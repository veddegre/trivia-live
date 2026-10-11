import { Prisma, type Game, type Question, type Player } from "@prisma/client";
import { resolveBrand } from "@/lib/branding";
import { generateJoinCode } from "@/lib/codes";
import { prisma } from "@/lib/db";
import {
  hottestStreak,
  isQuestionBonus,
  joinWinnerNames,
  scoreAnswer,
  tiedForFirst,
  trailingCorrectStreak,
} from "@/lib/scoring";
import { buildNightRecap } from "@/lib/night-recap";
import { isNameBanned, withBannedName } from "@/lib/bans";
import {
  isEndOfNamedRound,
  roundForQuestion,
  roundSummaries,
  roundViewAt,
} from "@/lib/rounds";
import { mediaPublicUrl } from "@/lib/zoom";
import type {
  GamePhase,
  GamePublicState,
  LeaderboardEntry,
  PlayerView,
  PublicQuestion,
} from "@/lib/types";
import { choiceCountsFor } from "@/lib/choice-counts";
import {
  nextExtraMs,
  QUESTION_EXTRA_CAP_MS,
  questionRemainingMs,
  resumedOpenedAt,
} from "@/lib/question-clock";
import { questionRecoveryPlan } from "@/lib/question-recovery";
import { secretToken } from "@/lib/secret-token";
import { matchTypedAnswer } from "@/lib/fuzzy-answer";
import { playerRoster, teamLeaderboard, teamNameKey } from "@/lib/teams";
import {
  gameTypeUsesAudio,
  gameTypeUsesImage,
  gameTypeUsesRevealText,
} from "@/lib/types";

type GamePlayer = Player & { team: { id: string; name: string } | null };

type GameWithRelations = Game & {
  questions: Question[];
  players: GamePlayer[];
  teams: { id: string; name: string }[];
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
  scheduleQuestionAutoLockMs(code, timeLimitSec * 1000, onExpire);
}

/** Schedule auto-lock after a millisecond delay (used to re-arm remaining time). */
export function scheduleQuestionAutoLockMs(
  code: string,
  delayMs: number,
  onExpire: () => void
) {
  const key = code.toUpperCase();
  clearQuestionTimer(key);
  const rt = getRuntime(key);
  rt.autoLockTimer = setTimeout(() => {
    rt.autoLockTimer = undefined;
    onExpire();
  }, Math.max(0, delayMs));
}

/**
 * Re-arm or lock questions that were open when the process died.
 * The auto-lock timer only lives in memory, so a restart otherwise leaves them stuck.
 */
export async function recoverOpenQuestions(
  arm: (code: string, remainingMs: number) => void,
  now = Date.now()
) {
  const games = await prisma.game.findMany({
    where: { status: "QUESTION" },
    include: {
      questions: { orderBy: { order: "asc" }, select: { timeLimitSec: true } },
    },
  });

  let locked = 0;
  let armed = 0;
  let waiting = 0;
  let paused = 0;

  for (const game of games) {
    const limit = game.questions[game.currentQuestionIndex]?.timeLimitSec ?? 0;
    const plan = questionRecoveryPlan(
      game.questionOpenedAt,
      limit,
      now,
      game.questionExtraMs,
      game.questionPausedAt
    );
    if (plan.action === "wait") {
      waiting += 1;
      continue;
    }
    if (plan.action === "paused") {
      paused += 1;
      continue;
    }
    if (plan.action === "lock") {
      try {
        const result = await lockQuestion(game.code);
        if (result.locked) locked += 1;
      } catch {
        /* a live host locked it first */
      }
      continue;
    }
    arm(game.code, plan.remainingMs);
    armed += 1;
  }

  return { locked, armed, waiting, paused };
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
      players: { orderBy: { totalScore: "desc" }, include: { team: true } },
      teams: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
  });
}

function scorerRows(players: GamePlayer[]) {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    teamId: player.teamId,
    teamName: player.team?.name ?? null,
    totalScore: player.totalScore,
  }));
}

function toLeaderboard(
  players: GamePlayer[],
  lastPoints?: Map<string, number>,
  teamMode = false
): LeaderboardEntry[] {
  if (teamMode) return teamLeaderboard(scorerRows(players), lastPoints);
  return [...players]
    .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name))
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      totalScore: p.totalScore,
      lastPoints: lastPoints?.get(p.id),
    }));
}

function questionBonus(q: { bonus?: string | null }) {
  return isQuestionBonus(q.bonus) ? q.bonus : "NONE";
}

async function hotStreakThrough(
  game: GameWithRelations,
  lastCompletedIndex: number
): Promise<{ name: string; count: number } | null> {
  if (lastCompletedIndex < 0) return null;
  const completed = game.questions.slice(0, lastCompletedIndex + 1);
  const answers = await prisma.answer.findMany({
    where: { questionId: { in: completed.map((q) => q.id) } },
    select: { playerId: true, questionId: true, isCorrect: true },
  });
  const byPlayer = new Map<string, Map<string, boolean>>();
  for (const a of answers) {
    let row = byPlayer.get(a.playerId);
    if (!row) {
      row = new Map();
      byPlayer.set(a.playerId, row);
    }
    row.set(a.questionId, a.isCorrect);
  }
  if (game.teamMode) {
    const byTeam = new Map<string, { name: string; answers: Map<string, boolean> }>();
    for (const player of game.players) {
      if (!player.teamId || !player.team) continue;
      let team = byTeam.get(player.teamId);
      if (!team) {
        team = { name: player.team.name, answers: new Map() };
        byTeam.set(player.teamId, team);
      }
      const row = byPlayer.get(player.id);
      if (!row) continue;
      for (const [questionId, correct] of row) {
        if (!team.answers.has(questionId)) team.answers.set(questionId, correct);
      }
    }
    return hottestStreak(
      [...byTeam.values()].map((team) => ({
        name: team.name,
        streak: trailingCorrectStreak(
          completed.map((q) => team.answers.get(q.id) ?? null)
        ),
      }))
    );
  }
  return hottestStreak(
    game.players.map((p) => {
      const row = byPlayer.get(p.id);
      const results = completed.map((q) => row?.get(q.id) ?? null);
      return { name: p.name, streak: trailingCorrectStreak(results) };
    })
  );
}

async function roundLeaderboardFor(
  game: GameWithRelations,
  startIndex: number,
  endIndex: number
): Promise<LeaderboardEntry[]> {
  const ids = game.questions.slice(startIndex, endIndex + 1).map((q) => q.id);
  if (ids.length === 0) return [];
  const answers = await prisma.answer.findMany({
    where: { questionId: { in: ids } },
    select: { playerId: true, points: true },
  });
  if (game.teamMode) {
    const totals = new Map<string, number>();
    for (const answer of answers) {
      const player = game.players.find((p) => p.id === answer.playerId);
      if (!player?.teamId) continue;
      totals.set(player.teamId, (totals.get(player.teamId) ?? 0) + answer.points);
    }
    return teamLeaderboard(
      scorerRows(game.players).map((player) => ({
        ...player,
        totalScore: player.teamId ? totals.get(player.teamId) ?? 0 : 0,
      }))
    );
  }
  const totals = new Map<string, number>();
  for (const a of answers) {
    totals.set(a.playerId, (totals.get(a.playerId) ?? 0) + a.points);
  }
  return [...game.players]
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      totalScore: totals.get(p.id) ?? 0,
    }))
    .sort(
      (a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name)
    );
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

  let choiceCounts: number[] | undefined;
  if (q && (phase === "reveal" || phase === "finished")) {
    const picks = await prisma.answer.findMany({
      where: { questionId: q.id },
      select: { choiceIndex: true },
    });
    choiceCounts = choiceCountsFor(q.options.length, picks);
    if (phase === "reveal") rt.answerCount = picks.length;
  }

  let question: PublicQuestion | null = null;
  if (q && (phase === "question" || phase === "reveal" || phase === "finished")) {
    question = {
      id: q.id,
      order: q.order,
      prompt: q.prompt,
      options: q.typed && phase === "question" ? [] : q.options,
      timeLimitSec: q.timeLimitSec,
      ...(q.typed ? { typed: true } : {}),
      imageUrl: gameTypeUsesImage(game.gameType)
        ? mediaPublicUrl(q.imageKey)
        : null,
      startZoom: gameTypeUsesImage(game.gameType) ? q.startZoom : undefined,
      audioUrl: gameTypeUsesAudio(game.gameType)
        ? mediaPublicUrl(q.audioKey)
        : null,
      startSpeed: game.gameType === "AUDIO_SPEED" ? q.startSpeed : undefined,
      revealText: gameTypeUsesRevealText(game.gameType)
        ? q.revealText
        : undefined,
      bonus: questionBonus(q) === "NONE" ? undefined : questionBonus(q),
      ...(reveal ? { correctIndex: q.correctIndex, choiceCounts } : {}),
    };
  }

  if (q && phase === "question") {
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

  const leaderboard = toLeaderboard(game.players, lastPoints, game.teamMode);
  const tied = phase === "finished" ? tiedForFirst(leaderboard) : [];
  const winner =
    phase === "finished" && leaderboard.length > 0 ? leaderboard[0] : null;
  const tiedWinners = tied.length > 1 ? tied : null;
  const leader = leaderboard.length > 0 ? leaderboard[0] : null;

  let lastCompleted = -1;
  if (phase === "reveal") lastCompleted = game.currentQuestionIndex;
  else if (phase === "between") lastCompleted = game.currentQuestionIndex - 1;
  else if (phase === "finished") lastCompleted = game.questions.length - 1;
  const hotStreak =
    lastCompleted >= 2 ? await hotStreakThrough(game, lastCompleted) : null;

  const titles = game.questions.map((q) => q.roundTitle);
  const round = roundViewAt(titles, game.currentQuestionIndex);
  let endedRound: GamePublicState["endedRound"] = null;
  if (phase === "between") {
    const completed = game.currentQuestionIndex - 1;
    if (isEndOfNamedRound(titles, completed)) {
      const group = roundForQuestion(titles, completed);
      if (group) {
        endedRound = {
          title: group.title,
          leaderboard: await roundLeaderboardFor(
            game,
            group.startIndex,
            group.endIndex
          ),
        };
      }
    }
  }

  const brand = resolveBrand();

  return {
    code: game.code,
    title: game.title,
    gameType: game.gameType,
    phase,
    status: game.status,
    playerCount: game.players.length,
    answerCount: rt.answerCount,
    teamMode: game.teamMode,
    teamCount: game.teams.length,
    roster: playerRoster(scorerRows(game.players)),
    questionIndex: game.currentQuestionIndex,
    questionTotal: game.questions.length,
    question,
    questionOpenedAt: game.questionOpenedAt?.toISOString() ?? null,
    questionPausedAt: game.questionPausedAt?.toISOString() ?? null,
    questionExtraMs: game.questionExtraMs,
    serverNow: new Date().toISOString(),
    timeLimitSec: q?.timeLimitSec ?? null,
    leaderboard,
    leader:
      phase === "reveal" || phase === "between" || phase === "finished"
        ? leader
        : null,
    winner,
    tiedWinners,
    hotStreak,
    allowLateJoin: game.allowLateJoin,
    allowAnswerChange: game.allowAnswerChange,
    round,
    rounds: roundSummaries(titles),
    endedRound,
    brand,
  };
}

/** Player phones never get media URLs — photos/audio live on the host screen. */
export function withoutQuestionMedia(state: GamePublicState): GamePublicState {
  if (!state.question) return state;
  if (
    !state.question.imageUrl &&
    state.question.startZoom == null &&
    !state.question.audioUrl &&
    state.question.startSpeed == null &&
    !state.question.revealText
  ) {
    return state;
  }
  return {
    ...state,
    question: {
      ...state.question,
      imageUrl: null,
      startZoom: undefined,
      audioUrl: null,
      startSpeed: undefined,
      revealText: undefined,
    },
  };
}

/**
 * One game load and one answer load, then a view per player.
 * Phase changes used to query once per phone.
 */
export async function buildPlayerViews(code: string): Promise<Map<string, PlayerView>> {
  const game = await prisma.game.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      questions: { orderBy: { order: "asc" } },
      players: { include: { team: true } },
    },
  });
  if (!game) return new Map();

  const status = game.status;
  const q = game.questions[game.currentQuestionIndex];
  const resultQuestion =
    status === "BETWEEN" ? game.questions[game.currentQuestionIndex - 1] : q;
  const answerQuestion = status === "QUESTION" ? q : resultQuestion;
  const showResult =
    status === "REVEAL" || status === "BETWEEN" || status === "FINISHED";

  const answers = answerQuestion
    ? await prisma.answer.findMany({
        where: { questionId: answerQuestion.id },
        select: {
          playerId: true,
          choiceIndex: true,
          text: true,
          isCorrect: true,
          points: true,
        },
      })
    : [];
  const byPlayer = new Map(answers.map((answer) => [answer.playerId, answer]));
  const byTeam = new Map<string, (typeof answers)[number]>();
  if (game.teamMode) {
    for (const player of game.players) {
      if (!player.teamId || byTeam.has(player.teamId)) continue;
      const answer = byPlayer.get(player.id);
      if (answer) byTeam.set(player.teamId, answer);
    }
  }

  const views = new Map<string, PlayerView>();
  for (const player of game.players) {
    const answer =
      game.teamMode && player.teamId
        ? byTeam.get(player.teamId)
        : byPlayer.get(player.id);
    const hasAnswered = !!answer;
    views.set(player.id, {
      playerId: player.id,
      name: player.name,
      token: player.token,
      teamId: player.teamId,
      teamName: player.team?.name ?? null,
      totalScore: player.totalScore,
      answerText: answer?.text ? answer.text : null,
      hasAnswered,
      selectedChoice: answer ? answer.choiceIndex : null,
      lastResult:
        answer && showResult
          ? { isCorrect: answer.isCorrect, points: answer.points }
          : null,
    });
  }
  return views;
}

export async function buildPlayerView(
  code: string,
  playerId: string
): Promise<PlayerView | null> {
  const views = await buildPlayerViews(code);
  return views.get(playerId) ?? null;
}

export async function openLobby(code: string) {
  await prisma.game.update({
    where: { code: code.toUpperCase() },
    data: {
      status: "LOBBY",
      currentQuestionIndex: 0,
      questionOpenedAt: null,
      questionPausedAt: null,
      questionExtraMs: 0,
    },
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
  const deferClock = gameTypeUsesAudio(game.gameType);
  const openedAt = deferClock ? null : new Date();
  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: "QUESTION",
      currentQuestionIndex: nextIndex,
      questionOpenedAt: openedAt,
      questionPausedAt: null,
      questionExtraMs: 0,
    },
  });
  const rt = getRuntime(game.code);
  rt.answerCount = 0;
  return {
    openedAt,
    timeLimitSec: q.timeLimitSec,
    questionIndex: nextIndex,
    deferClock,
  };
}

/** Arm the question timer (host taps Play on a song round). */
export async function startQuestionClock(code: string) {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");
  if (game.status !== "QUESTION") throw new Error("Question is not open");

  const q = game.questions[game.currentQuestionIndex];
  if (!q) throw new Error("No active question");

  if (game.questionOpenedAt) {
    return {
      openedAt: game.questionOpenedAt,
      timeLimitSec: q.timeLimitSec,
      alreadyStarted: true,
    };
  }

  const openedAt = new Date();
  await prisma.game.update({
    where: { id: game.id },
    data: { questionOpenedAt: openedAt },
  });
  return {
    openedAt,
    timeLimitSec: q.timeLimitSec,
    alreadyStarted: false,
  };
}

function activeQuestion(game: GameWithRelations) {
  const q = game.questions[game.currentQuestionIndex];
  if (!q) throw new Error("No active question");
  if (game.status !== "QUESTION" || !game.questionOpenedAt) {
    throw new Error(
      game.status === "QUESTION" ? "The clock has not started" : "Question is not open"
    );
  }
  return q;
}

/** Freeze the open question. The auto-lock timer is cleared by the socket caller. */
export async function pauseQuestion(code: string) {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");
  activeQuestion(game);
  if (game.questionPausedAt) return { alreadyPaused: true as const };

  const pausedAt = new Date();
  const alreadyPaused = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ status: string; questionOpenedAt: Date | null; questionPausedAt: Date | null }>
    >`
      SELECT CAST(status AS text) AS status, "questionOpenedAt", "questionPausedAt"
      FROM "Game"
      WHERE id = ${game.id}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row || row.status !== "QUESTION" || !row.questionOpenedAt) {
      throw new Error("Question is not open");
    }
    if (row.questionPausedAt) return true;
    await tx.game.update({
      where: { id: game.id },
      data: { questionPausedAt: pausedAt },
    });
    return false;
  });
  return { alreadyPaused, pausedAt };
}

/** Continue a paused question with the time that was left, plus any extra seconds. */
export async function resumeQuestion(code: string) {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");
  const q = activeQuestion(game);
  if (!game.questionPausedAt || !game.questionOpenedAt) {
    throw new Error("The question is not paused");
  }

  const now = new Date();
  const clock = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        status: string;
        questionOpenedAt: Date | null;
        questionPausedAt: Date | null;
        questionExtraMs: number;
      }>
    >`
      SELECT CAST(status AS text) AS status, "questionOpenedAt", "questionPausedAt", "questionExtraMs"
      FROM "Game"
      WHERE id = ${game.id}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row?.questionPausedAt || !row.questionOpenedAt || row.status !== "QUESTION") {
      throw new Error("The question is not paused");
    }
    const shifted = resumedOpenedAt(row.questionOpenedAt, row.questionPausedAt, now);
    await tx.game.update({
      where: { id: game.id },
      data: { questionOpenedAt: shifted, questionPausedAt: null },
    });
    return { openedAt: shifted, extraMs: row.questionExtraMs ?? 0 };
  });

  const remainingMs = questionRemainingMs({
    openedAt: clock.openedAt,
    timeLimitSec: q.timeLimitSec,
    extraMs: clock.extraMs,
    now: now.getTime(),
  });
  return { remainingMs: Math.max(0, remainingMs ?? 0) };
}

/** Add 10 seconds to the open question, whether or not it is paused. */
export async function extendQuestion(code: string) {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");
  const q = activeQuestion(game);
  if (game.questionExtraMs >= QUESTION_EXTRA_CAP_MS) {
    throw new Error("This question already has the maximum extra time");
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        status: string;
        questionOpenedAt: Date | null;
        questionPausedAt: Date | null;
        questionExtraMs: number;
      }>
    >`
      SELECT CAST(status AS text) AS status, "questionOpenedAt", "questionPausedAt", "questionExtraMs"
      FROM "Game"
      WHERE id = ${game.id}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row || row.status !== "QUESTION" || !row.questionOpenedAt) {
      throw new Error("Question is not open");
    }
    const currentExtra = row.questionExtraMs ?? 0;
    if (currentExtra >= QUESTION_EXTRA_CAP_MS) {
      throw new Error("This question already has the maximum extra time");
    }
    const extraMs = nextExtraMs(currentExtra);
    await tx.game.update({
      where: { id: game.id },
      data: { questionExtraMs: extraMs },
    });
    const remainingMs = questionRemainingMs({
      openedAt: row.questionOpenedAt,
      timeLimitSec: q.timeLimitSec,
      extraMs,
      pausedAt: row.questionPausedAt,
      now: now.getTime(),
    });
    return {
      remainingMs: Math.max(0, remainingMs ?? 0),
      paused: !!row.questionPausedAt,
      extraMs,
    };
  });
}

function closedQuestionMessage(status: string | undefined, questionOpenedAt: Date | null) {
  return status === "QUESTION" && !questionOpenedAt
    ? "Wait for the music to start"
    : "Question is not open";
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Match an existing team by name, or create it. Same spelling with different case joins the first team. */
export async function findOrCreateTeam(gameId: string, teamName: string) {
  const nameKey = teamNameKey(teamName);
  const existing = await prisma.team.findUnique({
    where: { gameId_nameKey: { gameId, nameKey } },
  });
  if (existing) return existing;
  try {
    return await prisma.team.create({
      data: { gameId, name: teamName, nameKey },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const again = await prisma.team.findUnique({
      where: { gameId_nameKey: { gameId, nameKey } },
    });
    if (!again) throw err;
    return again;
  }
}

/**
 * Set every player's total to the sum of their answer points.
 * Safe to run more than once; a second lock cannot add the round again.
 */
async function recomputeTotals(tx: Prisma.TransactionClient, gameId: string) {
  const game = await tx.game.findUnique({
    where: { id: gameId },
    select: { teamMode: true },
  });
  if (game?.teamMode) {
    await tx.$executeRaw`
      UPDATE "Player" AS p
      SET "totalScore" = CAST(s.points AS INTEGER)
      FROM (
        SELECT p2.id, COALESCE(SUM(a.points), 0) AS points
        FROM "Player" p2
        LEFT JOIN "Player" mate
          ON mate."teamId" = p2."teamId"
         AND p2."teamId" IS NOT NULL
        LEFT JOIN "Answer" a ON a."playerId" = mate.id
        WHERE p2."gameId" = ${gameId}
        GROUP BY p2.id
      ) AS s
      WHERE p.id = s.id
    `;
    return;
  }
  await tx.$executeRaw`
    UPDATE "Player" AS p
    SET "totalScore" = CAST(s.points AS INTEGER)
    FROM (
      SELECT p2.id, COALESCE(SUM(a.points), 0) AS points
      FROM "Player" p2
      LEFT JOIN "Answer" a ON a."playerId" = p2.id
      WHERE p2."gameId" = ${gameId}
      GROUP BY p2.id
    ) AS s
    WHERE p.id = s.id
  `;
}

export async function submitAnswer(opts: {
  code: string;
  playerToken: string;
  choiceIndex?: number;
  text?: string;
}) {
  const game = await loadGame(opts.code);
  if (!game) throw new Error("Game not found");

  const player = game.players.find((p) => p.token === opts.playerToken);
  if (!player) throw new Error("Player not found");

  const q = game.questions[game.currentQuestionIndex];
  if (!q) throw new Error("No active question");

  let pick = -1;
  let answerText = "";
  if (q.typed) {
    answerText = (opts.text ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!answerText) throw new Error("Type an answer");
    pick = matchTypedAnswer(answerText, q.options);
  } else if (
    opts.choiceIndex == null ||
    opts.choiceIndex < 0 ||
    opts.choiceIndex >= q.options.length
  ) {
    throw new Error("Invalid choice");
  } else {
    pick = opts.choiceIndex;
  }

  if (game.status !== "QUESTION" || !game.questionOpenedAt) {
    throw new Error(closedQuestionMessage(game.status, game.questionOpenedAt));
  }

  const scored = (elapsedMs: number, limitMs: number) => {
    const isCorrect = q.typed ? pick >= 0 : pick === q.correctIndex;
    const points = scoreAnswer({
      isCorrect,
      elapsedMs,
      timeLimitSec: limitMs / 1000,
      basePoints: q.basePoints,
      timeBonus: q.timeBonus,
      bonus: questionBonus(q),
    });
    return { isCorrect, points };
  };

  // Hold the game row so this write cannot land after lock has summed the answers.
  const outcome = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        status: string;
        questionOpenedAt: Date | null;
        questionPausedAt: Date | null;
        questionExtraMs: number;
      }>
    >`
      SELECT CAST(status AS text) AS status, "questionOpenedAt", "questionPausedAt", "questionExtraMs"
      FROM "Game"
      WHERE id = ${game.id}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row || row.status !== "QUESTION" || !row.questionOpenedAt) {
      throw new Error(closedQuestionMessage(row?.status, row?.questionOpenedAt ?? null));
    }
    if (row.questionPausedAt) throw new Error("The host paused this question");

    const stillPlaying = await tx.player.findUnique({
      where: { id: player.id },
      select: { id: true, teamId: true },
    });
    if (!stillPlaying) throw new Error("Player not found");
    if (game.teamMode && !stillPlaying.teamId) {
      throw new Error("Join a team first");
    }

    const answeredAt = new Date();
    const elapsedMs = answeredAt.getTime() - new Date(row.questionOpenedAt).getTime();
    const limitMs = q.timeLimitSec * 1000 + (row.questionExtraMs ?? 0);
    if (elapsedMs > limitMs) {
      throw new Error("Time is up");
    }
    const { isCorrect, points } = scored(elapsedMs, limitMs);
    const data = {
      choiceIndex: pick,
      text: answerText,
      answeredAt,
      isCorrect,
      points,
    };

    const existing = await tx.answer.findFirst({
      where:
        game.teamMode && stillPlaying.teamId
          ? { questionId: q.id, player: { teamId: stillPlaying.teamId } }
          : { playerId: player.id, questionId: q.id },
    });
    const closedMessage = game.teamMode
      ? "Your team already answered"
      : "Already answered";
    if (existing) {
      if (!game.allowAnswerChange) throw new Error(closedMessage);
      if (q.typed ? existing.text === answerText : existing.choiceIndex === pick) {
        return "unchanged" as const;
      }
      await tx.answer.update({ where: { id: existing.id }, data });
      return "updated" as const;
    }

    try {
      await tx.answer.create({
        data: {
          playerId: player.id,
          questionId: q.id,
          ...data,
        },
      });
      return "created" as const;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      if (!game.allowAnswerChange) throw new Error(closedMessage);
      await tx.answer.update({
        where: {
          playerId_questionId: { playerId: player.id, questionId: q.id },
        },
        data,
      });
      return "updated" as const;
    }
  }, { maxWait: 30_000, timeout: 30_000 });

  if (outcome === "created") {
    const rt = getRuntime(game.code);
    rt.answerCount += 1;
    rt.dirtyLeaderboard = true;
  } else if (outcome === "updated") {
    getRuntime(game.code).dirtyLeaderboard = true;
  }

  // Don't return points/isCorrect — that would spoil the round on the phone
  return { playerId: player.id, team: game.teamMode };
}

/**
 * Claim QUESTION → next status. Only the call that wins the row adds scores.
 * Totals are replaced with SUM(answer points), so a second winner cannot double them.
 */
async function claimQuestionAndScore(
  gameId: string,
  next: "REVEAL" | "FINISHED"
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.game.updateMany({
      where: { id: gameId, status: "QUESTION" },
      data: {
        status: next,
        questionPausedAt: null,
        questionExtraMs: 0,
        ...(next === "FINISHED" ? { questionOpenedAt: null } : {}),
      },
    });
    if (claimed.count !== 1) return false;
    await recomputeTotals(tx, gameId);
    return true;
  }, { maxWait: 30_000, timeout: 30_000 });
}

/**
 * Lock the open question.
 * auto: only when the clock has actually run out. Pause and +10 hold the same row,
 * so a timer that already fired cannot close a question that still has time.
 */
export async function lockQuestion(
  code: string,
  opts?: { auto?: boolean }
): Promise<{ locked: boolean }> {
  const game = await loadGame(code);
  if (!game) {
    if (opts?.auto) return { locked: false };
    throw new Error("Game not found");
  }
  if (game.status !== "QUESTION") {
    if (game.status === "REVEAL" || game.status === "FINISHED" || opts?.auto) {
      return { locked: false };
    }
    throw new Error("No open question");
  }

  if (opts?.auto) {
    const locked = await claimExpiredQuestion(game);
    if (locked) clearQuestionTimer(game.code);
    return { locked };
  }

  clearQuestionTimer(game.code);
  const locked = await claimQuestionAndScore(game.id, "REVEAL");
  return { locked };
}

async function claimExpiredQuestion(game: GameWithRelations): Promise<boolean> {
  const q = game.questions[game.currentQuestionIndex];
  if (!q) return false;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        status: string;
        questionOpenedAt: Date | null;
        questionPausedAt: Date | null;
        questionExtraMs: number;
      }>
    >`
      SELECT CAST(status AS text) AS status, "questionOpenedAt", "questionPausedAt", "questionExtraMs"
      FROM "Game"
      WHERE id = ${game.id}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row || row.status !== "QUESTION" || !row.questionOpenedAt || row.questionPausedAt) {
      return false;
    }
    const left = questionRemainingMs({
      openedAt: row.questionOpenedAt,
      timeLimitSec: q.timeLimitSec,
      extraMs: row.questionExtraMs ?? 0,
      now: Date.now(),
    });
    if (left == null || left > 500) return false;
    await tx.game.update({
      where: { id: game.id },
      data: { status: "REVEAL", questionPausedAt: null, questionExtraMs: 0 },
    });
    await recomputeTotals(tx, game.id);
    return true;
  }, { maxWait: 30_000, timeout: 30_000 });
}

/**
 * Replace this question's points, then rebuild totals from the sum.
 * Zero drops the round. Credit gives every player a correct answer at base points.
 */
export async function voidQuestion(code: string, mode: "zero" | "credit") {
  const game = await loadGame(code);
  if (!game) throw new Error("Game not found");
  const q = game.questions[game.currentQuestionIndex];
  if (!q) throw new Error("No active question");
  if (game.status !== "QUESTION" && game.status !== "REVEAL") {
    throw new Error("No question to void");
  }
  clearQuestionTimer(game.code);

  const credited = scoreAnswer({
    isCorrect: true,
    elapsedMs: q.timeLimitSec * 1000,
    timeLimitSec: q.timeLimitSec,
    basePoints: q.basePoints,
    timeBonus: q.timeBonus,
    bonus: questionBonus(q),
  });

  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT CAST(status AS text) AS status
      FROM "Game"
      WHERE id = ${game.id}
      FOR UPDATE
    `;
    const status = rows[0]?.status;
    if (status !== "QUESTION" && status !== "REVEAL") {
      throw new Error("No question to void");
    }
    if (status === "QUESTION") {
      await tx.game.update({
        where: { id: game.id },
        data: { status: "REVEAL", questionPausedAt: null, questionExtraMs: 0 },
      });
    }
    if (mode === "zero") {
      await tx.answer.updateMany({
        where: { questionId: q.id },
        data: { points: 0, isCorrect: false },
      });
    } else {
      const players = await tx.player.findMany({
        where: { gameId: game.id },
        select: { id: true, teamId: true },
      });
      const creditedPlayers = new Set<string>();
      for (const player of players) {
        const key = game.teamMode ? player.teamId ?? player.id : player.id;
        if (creditedPlayers.has(key)) continue;
        creditedPlayers.add(key);
        const existing =
          game.teamMode && player.teamId
            ? await tx.answer.findFirst({
                where: { questionId: q.id, player: { teamId: player.teamId } },
              })
            : null;
        if (existing) {
          await tx.answer.update({
            where: { id: existing.id },
            data: {
              choiceIndex: q.correctIndex,
              text: q.typed ? q.options[q.correctIndex] ?? "" : "",
              isCorrect: true,
              points: credited,
            },
          });
          continue;
        }
        await tx.answer.upsert({
          where: {
            playerId_questionId: { playerId: player.id, questionId: q.id },
          },
          create: {
            playerId: player.id,
            questionId: q.id,
            choiceIndex: q.correctIndex,
            text: q.typed ? q.options[q.correctIndex] ?? "" : "",
            answeredAt: new Date(),
            isCorrect: true,
            points: credited,
          },
          update: {
            choiceIndex: q.correctIndex,
            text: q.typed ? q.options[q.correctIndex] ?? "" : "",
            isCorrect: true,
            points: credited,
          },
        });
      }
    }
    await recomputeTotals(tx, game.id);
  }, { maxWait: 30_000, timeout: 30_000 });
}

/** Drop this question's points and move on. */
export async function skipQuestion(code: string) {
  await voidQuestion(code, "zero");
  return nextQuestion(code);
}

/**
 * Snapshot the podium when a night ends. Survives Play again (players are wiped).
 * Idempotent per gameId + join code so double-finish doesn’t duplicate.
 */
export async function recordGameResult(code: string) {
  const game = await loadGame(code);
  if (!game || game.players.length === 0) return null;

  const board = toLeaderboard(game.players, undefined, game.teamMode);
  const tied = tiedForFirst(board);
  const winner = tied[0];
  if (!winner) return null;
  const winnerName =
    tied.length > 1 ? joinWinnerNames(tied.map((p) => p.name)) : winner.name;

  const podium = board.slice(0, 3).map((p) => ({
    name: p.name,
    totalScore: p.totalScore,
  }));

  const answers = await prisma.answer.findMany({
    where: { player: { gameId: game.id } },
    select: {
      playerId: true,
      questionId: true,
      choiceIndex: true,
      text: true,
      isCorrect: true,
      points: true,
    },
  });
  const recapPlayers = game.teamMode
    ? game.teams.map((team) => ({
        id: team.id,
        name: team.name,
        totalScore:
          game.players.find((player) => player.teamId === team.id)?.totalScore ?? 0,
      }))
    : game.players;
  const recapAnswers = game.teamMode
    ? answers.map((answer) => ({
        ...answer,
        playerId:
          game.players.find((player) => player.id === answer.playerId)?.teamId ??
          answer.playerId,
      }))
    : answers;
  const recap = buildNightRecap({
    gameType: game.gameType,
    questions: game.questions,
    players: recapPlayers,
    answers: recapAnswers,
  });

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
        winnerName,
        winnerScore: winner.totalScore,
        playerCount: game.players.length,
        podium,
        recap,
      },
      update: {
        ownerId: game.ownerId,
        gameTitle: game.title,
        winnerName,
        winnerScore: winner.totalScore,
        playerCount: game.players.length,
        podium,
        recap,
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
      data: {
        status: "FINISHED",
        questionOpenedAt: null,
        questionPausedAt: null,
        questionExtraMs: 0,
      },
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
      questionPausedAt: null,
      questionExtraMs: 0,
    },
  });
  return { finished: false as const, between: true as const, index: next };
}

export async function finishGame(code: string) {
  const key = code.toUpperCase();
  clearQuestionTimer(key);
  const game = await loadGame(key);
  if (!game) throw new Error("Game not found");

  const claimed = await claimQuestionAndScore(game.id, "FINISHED");
  if (!claimed) {
    await prisma.$transaction(
      async (tx) => {
        await tx.game.updateMany({
          where: { id: game.id, status: { not: "FINISHED" } },
          data: {
            status: "FINISHED",
            questionOpenedAt: null,
            questionPausedAt: null,
            questionExtraMs: 0,
          },
        });
        await recomputeTotals(tx, game.id);
      },
      { maxWait: 30_000, timeout: 30_000 }
    );
  }

  await recordGameResult(key);
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

/** Remove one player (and their answers) and block that name until Play again. */
export async function kickPlayer(code: string, playerId: string) {
  const player = await prisma.player.findFirst({
    where: { id: playerId, game: { code: code.toUpperCase() } },
    select: {
      id: true,
      name: true,
      gameId: true,
      teamId: true,
      game: { select: { bannedNames: true, teamMode: true } },
    },
  });
  if (!player) throw new Error("Player not found");
  const bannedNames = withBannedName(player.game.bannedNames, player.name);
  await prisma.$transaction(async (tx) => {
    if (player.teamId) {
      const mate = await tx.player.findFirst({
        where: { teamId: player.teamId, id: { not: player.id } },
        select: { id: true },
      });
      if (mate) {
        const answers = await tx.answer.findMany({ where: { playerId: player.id } });
        for (const answer of answers) {
          const clash = await tx.answer.findUnique({
            where: {
              playerId_questionId: {
                playerId: mate.id,
                questionId: answer.questionId,
              },
            },
          });
          if (clash) await tx.answer.delete({ where: { id: answer.id } });
          else {
            await tx.answer.update({
              where: { id: answer.id },
              data: { playerId: mate.id },
            });
          }
        }
      }
    }
    await tx.game.update({
      where: { id: player.gameId },
      data: { bannedNames },
    });
    await tx.player.delete({ where: { id: player.id } });
    if (player.teamId) {
      const left = await tx.player.count({ where: { teamId: player.teamId } });
      if (left === 0) await tx.team.delete({ where: { id: player.teamId } });
    }
    if (player.game.teamMode) await recomputeTotals(tx, player.gameId);
  });
  return { playerId: player.id, name: player.name };
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
  const hostToken = secretToken();

  await prisma.$transaction([
    prisma.answer.deleteMany({
      where: { player: { gameId: game.id } },
    }),
    prisma.player.deleteMany({ where: { gameId: game.id } }),
    prisma.team.deleteMany({ where: { gameId: game.id } }),
    prisma.game.update({
      where: { id: game.id },
      data: {
        code: nextCode,
        hostToken,
        status: "LOBBY",
        currentQuestionIndex: 0,
        questionOpenedAt: null,
        questionPausedAt: null,
        questionExtraMs: 0,
        bannedNames: [],
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
