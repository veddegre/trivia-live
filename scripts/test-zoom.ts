import assert from "node:assert/strict";
import { zoomScale } from "../src/lib/zoom";

assert.equal(
  zoomScale({ startZoom: 10, elapsedMs: 0, timeLimitSec: 30 }),
  10
);

assert.equal(
  zoomScale({ startZoom: 10, elapsedMs: 30000, timeLimitSec: 30 }),
  1
);

assert.equal(
  zoomScale({
    startZoom: 10,
    elapsedMs: 0,
    timeLimitSec: 30,
    revealed: true,
  }),
  1
);

const mid = zoomScale({ startZoom: 10, elapsedMs: 15000, timeLimitSec: 30 });
// Ease-in t² at halfway: 10 + (1-10)*0.25 = 7.75
assert.equal(mid, 7.75);

const late = zoomScale({ startZoom: 10, elapsedMs: 29000, timeLimitSec: 30 });
assert.ok(late > 1 && late < 2, `expected near-full at the end, got ${late}`);

console.log("zoom tests passed");
