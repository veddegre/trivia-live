import assert from "node:assert/strict";
import { playbackRate } from "../src/lib/audio-speed";

assert.equal(
  playbackRate({ startSpeed: 2, elapsedMs: 0, timeLimitSec: 30 }),
  2
);

assert.equal(
  playbackRate({ startSpeed: 2, elapsedMs: 30000, timeLimitSec: 30 }),
  1
);

assert.equal(
  playbackRate({
    startSpeed: 2,
    elapsedMs: 0,
    timeLimitSec: 30,
    revealed: true,
  }),
  1
);

const mid = playbackRate({
  startSpeed: 2,
  elapsedMs: 15000,
  timeLimitSec: 30,
});
assert.ok(
  Math.abs(mid - Math.SQRT2) < 1e-9,
  `expected ~1.414 at halfway, got ${mid}`
);

console.log("audio-speed tests passed");
