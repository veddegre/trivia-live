import assert from "node:assert/strict";
import {
  closestAnswerIds,
  parseGuess,
  wagerPoints,
} from "../src/lib/closest-wager";

assert.equal(parseGuess("1000"), 1000);
assert.equal(parseGuess("1,000"), 1000);
assert.equal(parseGuess("$12.50"), 12.5);
assert.equal(parseGuess(" -3 "), -3);
assert.equal(parseGuess("abc"), null);
assert.equal(parseGuess(""), null);
assert.equal(parseGuess("1e3"), null);
assert.equal(parseGuess("12."), null);

const guesses = [
  { id: "near-low", text: "90" },
  { id: "near-high", text: "110" },
  { id: "far", text: "50" },
  { id: "junk", text: "lots" },
];
assert.deepEqual(closestAnswerIds(100, guesses).sort(), ["near-high", "near-low"]);
assert.deepEqual(closestAnswerIds(100, [{ id: "exact", text: "100" }, ...guesses]), [
  "exact",
]);
assert.deepEqual(closestAnswerIds(10, [{ id: "bad", text: "nope" }]), []);

assert.equal(wagerPoints(true, 200), 200);
assert.equal(wagerPoints(false, 200), -200);
assert.equal(wagerPoints(true, 0), 0);
assert.equal(wagerPoints(false, -5), 0);

console.log("closest and wager tests passed");
