/**
 * Lock, finish, and answer writes must agree on one total.
 * Needs Postgres (DATABASE_URL). Creates throwaway games and deletes them.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { prisma } from "../src/lib/db";
import { finishGame, lockQuestion, submitAnswer } from "../src/lib/game-manager";

if (!process.env.DATABASE_URL) {
  console.error("test:score-race requires DATABASE_URL");
  process.exit(1);
}

const created: string[] = [];

function code() {
  return `R${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function makeGame(players: number, allowAnswerChange = false) {
  const join = code();
  const game = await prisma.game.create({
    data: {
      title: "score race",
      code: join,
      status: "QUESTION",
      questionOpenedAt: new Date(),
      allowAnswerChange,
      hostToken: randomBytes(18).toString("hex"),
      questions: {
        create: [
          {
            order: 0,
            prompt: "One",
            options: ["yes", "no"],
            correctIndex: 0,
            timeLimitSec: 60,
            basePoints: 500,
            timeBonus: 500,
          },
          {
            order: 1,
            prompt: "Two",
            options: ["yes", "no"],
            correctIndex: 0,
            timeLimitSec: 60,
            basePoints: 500,
            timeBonus: 500,
          },
        ],
      },
      players: {
        create: Array.from({ length: players }, (_, i) => ({
          name: `P${i}`,
          token: `${join}-${i}`,
        })),
      },
    },
    include: { players: true },
  });
  created.push(game.id);
  return game;
}

async function assertTotalsMatch(gameId: string) {
  const answers = await prisma.answer.findMany({
    where: { player: { gameId } },
    select: { playerId: true, points: true },
  });
  const expected = new Map<string, number>();
  for (const answer of answers) {
    expected.set(answer.playerId, (expected.get(answer.playerId) ?? 0) + answer.points);
  }
  const players = await prisma.player.findMany({
    where: { gameId },
    select: { id: true, totalScore: true },
  });
  for (const player of players) {
    assert.equal(player.totalScore, expected.get(player.id) ?? 0);
  }
  const sumTotals = players.reduce((sum, player) => sum + player.totalScore, 0);
  const sumPoints = answers.reduce((sum, answer) => sum + answer.points, 0);
  assert.equal(sumTotals, sumPoints);
  return answers.length;
}

function acceptableRejection(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason);
  return message === "Question is not open" || message === "Time is up";
}

async function reopen(gameId: string, index: number) {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: "QUESTION",
      currentQuestionIndex: index,
      questionOpenedAt: new Date(),
    },
  });
}

async function main() {
  const sequential = await makeGame(4);
  await Promise.all(
    sequential.players.map((player) =>
      submitAnswer({
        code: sequential.code,
        playerToken: player.token,
        choiceIndex: 0,
      })
    )
  );
  const firstLock = await lockQuestion(sequential.code);
  const secondLock = await lockQuestion(sequential.code);
  assert.equal(firstLock.locked, true);
  assert.equal(secondLock.locked, false);
  assert.equal(await assertTotalsMatch(sequential.id), 4);
  const afterDouble = await prisma.player.findMany({
    where: { gameId: sequential.id },
    select: { totalScore: true },
  });
  await lockQuestion(sequential.code);
  const afterThird = await prisma.player.findMany({
    where: { gameId: sequential.id },
    select: { totalScore: true },
  });
  assert.deepEqual(
    afterThird.map((player) => player.totalScore),
    afterDouble.map((player) => player.totalScore)
  );

  await reopen(sequential.id, 1);
  await Promise.all(
    sequential.players.slice(0, 2).map((player) =>
      submitAnswer({
        code: sequential.code,
        playerToken: player.token,
        choiceIndex: 0,
      })
    )
  );
  assert.equal((await lockQuestion(sequential.code)).locked, true);
  assert.equal(await assertTotalsMatch(sequential.id), 6);

  const burst = await makeGame(200);
  const burstResults = await Promise.allSettled([
    ...burst.players.map((player) =>
      submitAnswer({
        code: burst.code,
        playerToken: player.token,
        choiceIndex: 0,
      })
    ),
    lockQuestion(burst.code),
    lockQuestion(burst.code),
  ]);
  const burstFailures = burstResults.filter(
    (result) => result.status === "rejected" && !acceptableRejection(result.reason)
  );
  assert.deepEqual(
    burstFailures.map((result) =>
      result.status === "rejected" ? result.reason : null
    ),
    []
  );
  const locks = burstResults.flatMap((result) =>
    result.status === "fulfilled" && "locked" in result.value ? [result.value] : []
  );
  assert.equal(locks.length, 2);
  assert.equal(locks.filter((value) => value.locked).length, 1);
  const burstGame = await prisma.game.findUniqueOrThrow({ where: { id: burst.id } });
  assert.equal(burstGame.status, "REVEAL");
  const stored = await assertTotalsMatch(burst.id);
  assert.ok(stored > 0, "expected some answers to land before lock");

  await assert.rejects(
    () =>
      submitAnswer({
        code: burst.code,
        playerToken: burst.players[0].token,
        choiceIndex: 1,
      }),
    /Question is not open/
  );
  assert.equal(await assertTotalsMatch(burst.id), stored);

  const changes = await makeGame(200, true);
  await Promise.all(
    changes.players.map((player) =>
      submitAnswer({
        code: changes.code,
        playerToken: player.token,
        choiceIndex: 0,
      })
    )
  );
  const changeResults = await Promise.allSettled([
    ...changes.players.map((player) =>
      submitAnswer({
        code: changes.code,
        playerToken: player.token,
        choiceIndex: 1,
      })
    ),
    lockQuestion(changes.code),
    lockQuestion(changes.code),
  ]);
  const changeFailures = changeResults.filter(
    (result) => result.status === "rejected" && !acceptableRejection(result.reason)
  );
  assert.equal(changeFailures.length, 0);
  assert.equal(
    (await prisma.game.findUniqueOrThrow({ where: { id: changes.id } })).status,
    "REVEAL"
  );
  await assertTotalsMatch(changes.id);

  const ending = await makeGame(200);
  const endResults = await Promise.allSettled([
    ...ending.players.map((player) =>
      submitAnswer({
        code: ending.code,
        playerToken: player.token,
        choiceIndex: 0,
      })
    ),
    lockQuestion(ending.code),
    finishGame(ending.code),
  ]);
  const endFailures = endResults.filter(
    (result) => result.status === "rejected" && !acceptableRejection(result.reason)
  );
  assert.equal(endFailures.length, 0);
  assert.equal(
    (await prisma.game.findUniqueOrThrow({ where: { id: ending.id } })).status,
    "FINISHED"
  );
  await assertTotalsMatch(ending.id);
  const finishedTotals = await prisma.player.findMany({
    where: { gameId: ending.id },
    select: { totalScore: true },
    orderBy: { name: "asc" },
  });
  await finishGame(ending.code);
  const finishedAgain = await prisma.player.findMany({
    where: { gameId: ending.id },
    select: { totalScore: true },
    orderBy: { name: "asc" },
  });
  assert.deepEqual(finishedAgain, finishedTotals);

  console.log("score race tests passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (created.length > 0) {
      await prisma.game.deleteMany({ where: { id: { in: created } } });
    }
    await prisma.$disconnect();
  });
