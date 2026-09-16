import assert from "node:assert/strict";
import {
  hottestStreak,
  joinWinnerNames,
  questionBonusLabel,
  scoreAnswer,
  tiedForFirst,
  trailingCorrectStreak,
} from "../src/lib/scoring";

assert.equal(
  scoreAnswer({
    isCorrect: false,
    elapsedMs: 100,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
  }),
  0
);

assert.equal(
  scoreAnswer({
    isCorrect: true,
    elapsedMs: 0,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
  }),
  1000
);

assert.equal(
  scoreAnswer({
    isCorrect: true,
    elapsedMs: 15000,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
  }),
  750
);

assert.equal(
  scoreAnswer({
    isCorrect: true,
    elapsedMs: 30000,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
  }),
  500
);

assert.equal(
  scoreAnswer({
    isCorrect: true,
    elapsedMs: 60000,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
  }),
  500
);

// Answer (or last change) at 2s.
assert.equal(
  scoreAnswer({
    isCorrect: true,
    elapsedMs: 2000,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
  }),
  967
);

// A late change is scored at the later time, not the first tap.
assert.equal(
  scoreAnswer({
    isCorrect: true,
    elapsedMs: 28000,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
  }),
  533
);

assert.equal(
  scoreAnswer({
    isCorrect: true,
    elapsedMs: 0,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
    bonus: "DOUBLE",
  }),
  2000
);

assert.equal(
  scoreAnswer({
    isCorrect: true,
    elapsedMs: 0,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
    bonus: "LIGHTNING",
  }),
  500
);

assert.equal(
  scoreAnswer({
    isCorrect: true,
    elapsedMs: 15000,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
    bonus: "LIGHTNING",
  }),
  500
);

assert.equal(
  scoreAnswer({
    isCorrect: false,
    elapsedMs: 0,
    timeLimitSec: 30,
    basePoints: 500,
    timeBonus: 500,
    bonus: "DOUBLE",
  }),
  0
);

assert.equal(trailingCorrectStreak([true, true, false, true, true, true]), 3);
assert.equal(trailingCorrectStreak([true, false]), 0);
assert.equal(trailingCorrectStreak([true, true]), 2);

assert.deepEqual(
  hottestStreak([
    { name: "Ada", streak: 2 },
    { name: "Ben", streak: 4 },
    { name: "Cal", streak: 4 },
  ]),
  { name: "Ben", count: 4 }
);
assert.equal(hottestStreak([{ name: "Ada", streak: 2 }]), null);

assert.equal(
  tiedForFirst([
    { totalScore: 10 },
    { totalScore: 10 },
    { totalScore: 5 },
  ]).length,
  2
);
assert.equal(joinWinnerNames(["Ada", "Ben"]), "Ada & Ben");
assert.equal(questionBonusLabel("NONE"), null);
assert.equal(questionBonusLabel("DOUBLE"), "Double points");
assert.equal(questionBonusLabel("LIGHTNING"), "Lightning");

console.log("scoring tests passed");
