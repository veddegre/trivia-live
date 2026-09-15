import assert from "node:assert/strict";
import { pictureFinishPixelSize, zoomScale } from "../src/lib/zoom";

assert.equal(
  pictureFinishPixelSize({ startZoom: 10, elapsedMs: 0, timeLimitSec: 45 }),
  40
);

assert.equal(
  pictureFinishPixelSize({
    startZoom: 10,
    elapsedMs: 45000,
    timeLimitSec: 45,
  }),
  1
);

assert.equal(
  pictureFinishPixelSize({
    startZoom: 10,
    elapsedMs: 0,
    timeLimitSec: 45,
    revealed: true,
  }),
  1
);

const mid = pictureFinishPixelSize({
  startZoom: 10,
  elapsedMs: 22500,
  timeLimitSec: 45,
});
const expected = zoomScale({
  startZoom: 10,
  elapsedMs: 22500,
  timeLimitSec: 45,
}) * 4;
assert.ok(Math.abs(mid - expected) < 1e-9, `expected ${expected}, got ${mid}`);

console.log("picture-finish tests passed");
