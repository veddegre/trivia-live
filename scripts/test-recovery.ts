import assert from "node:assert/strict";
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

assert.equal(clockOffsetMs("2026-10-10T12:00:05.000Z", openedMs + 8_000), 3_000);
assert.equal(clockOffsetMs("2026-10-10T11:59:58.000Z", openedMs), 2_000);
assert.equal(clockOffsetMs("not-a-date", openedMs), null);

console.log("recovery tests passed");
