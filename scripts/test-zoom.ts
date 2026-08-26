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
assert.ok(Math.abs(mid - Math.sqrt(10)) < 1e-9, `expected ~3.16 at halfway, got ${mid}`);

const late = zoomScale({ startZoom: 10, elapsedMs: 29000, timeLimitSec: 30 });
assert.ok(late > 1 && late < 1.2, `expected a gentle finish, got ${late}`);

console.log("zoom tests passed");
