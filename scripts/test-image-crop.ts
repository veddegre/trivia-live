import assert from "node:assert/strict";
import {
  centeredCrop,
  clampCrop,
  cropSideForZoom,
} from "../src/lib/image-crop";

assert.equal(cropSideForZoom(1000, 800, 1), 800);
assert.equal(cropSideForZoom(1000, 800, 2), 400);

const center = centeredCrop(1100, 734, 1);
assert.equal(center.size, 734);
assert.equal(center.x, (1100 - 734) / 2);
assert.equal(center.y, 0);

const portrait = centeredCrop(800, 1200, 1);
assert.equal(portrait.size, 800);
assert.equal(portrait.x, 0);
assert.equal(portrait.y, (1200 - 800) / 2);

const clamped = clampCrop(1000, 800, { x: -50, y: 999, size: 800 });
assert.equal(clamped.x, 0);
assert.equal(clamped.y, 0);
assert.equal(clamped.size, 800);

console.log("image-crop tests passed");
