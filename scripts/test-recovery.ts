import assert from "node:assert/strict";
import {
  nextExtraMs,
  questionRemainingMs,
  QUESTION_EXTRA_CAP_MS,
  resumedOpenedAt,
} from "../src/lib/question-clock";
import { questionRecoveryPlan } from "../src/lib/question-recovery";
import { clockOffsetMs } from "../src/lib/server-clock";

const opened = new Date("2026-10-10T12:00:00.000Z");
const openedMs = opened.getTime();

assert.deepEqual(questionRecoveryPlan(null, 30, openedMs), { action: "wait" });

assert.deepEqual(questionRecoveryPlan(opened, 30, openedMs + 10_000), {
  action: "arm",
  remainingMs: 20_000,
});

assert.deepEqual(questionRecoveryPlan(opened, 30, openedMs + 30_000), {
  action: "lock",
});

assert.deepEqual(questionRecoveryPlan(opened, 30, openedMs + 45_000), {
  action: "lock",
});

assert.deepEqual(
  questionRecoveryPlan(opened, 30, openedMs + 45_000, 20_000),
  { action: "arm", remainingMs: 5_000 }
);

const pausedAt = new Date(openedMs + 10_000);
assert.deepEqual(questionRecoveryPlan(opened, 30, openedMs + 60_000, 0, pausedAt), {
  action: "paused",
});

assert.equal(
  questionRemainingMs({
    openedAt: opened,
    timeLimitSec: 30,
    extraMs: 10_000,
    pausedAt,
    now: openedMs + 60_000,
  }),
  30_000
);

const resumed = resumedOpenedAt(opened, pausedAt, new Date(openedMs + 25_000));
assert.equal(resumed.getTime(), openedMs + 15_000);
assert.equal(
  questionRemainingMs({
    openedAt: resumed,
    timeLimitSec: 30,
    now: openedMs + 25_000,
  }),
  20_000
);

assert.equal(nextExtraMs(0), 10_000);
assert.equal(nextExtraMs(QUESTION_EXTRA_CAP_MS - 5_000), QUESTION_EXTRA_CAP_MS);
assert.equal(nextExtraMs(QUESTION_EXTRA_CAP_MS), QUESTION_EXTRA_CAP_MS);

assert.equal(clockOffsetMs("2026-10-10T12:00:05.000Z", openedMs + 8_000), 3_000);
assert.equal(clockOffsetMs("2026-10-10T11:59:58.000Z", openedMs), 2_000);
assert.equal(clockOffsetMs("not-a-date", openedMs), null);

console.log("recovery tests passed");
