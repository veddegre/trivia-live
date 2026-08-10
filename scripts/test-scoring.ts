import assert from "node:assert/strict";
import { scoreAnswer } from "../src/lib/scoring";

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

console.log("scoring tests passed");
