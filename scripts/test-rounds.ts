import assert from "node:assert/strict";
import {
  groupRounds,
  hasNamedRounds,
  isEndOfNamedRound,
  resolvedRoundTitles,
  roundViewAt,
} from "../src/lib/rounds";

assert.equal(hasNamedRounds(["", "", ""]), false);
assert.deepEqual(resolvedRoundTitles(["Movies", "", "Science", ""]), [
  "Movies",
  "Movies",
  "Science",
  "Science",
]);

const groups = groupRounds(["Movies", "", "Science", ""]);
assert.equal(groups.length, 2);
assert.equal(groups[0].title, "Movies");
assert.equal(groups[0].startIndex, 0);
assert.equal(groups[0].endIndex, 1);
assert.equal(groups[1].title, "Science");
assert.equal(groups[1].startIndex, 2);
assert.equal(groups[1].endIndex, 3);

assert.equal(isEndOfNamedRound(["Movies", "", "Science"], 0), false);
assert.equal(isEndOfNamedRound(["Movies", "", "Science"], 1), true);
assert.equal(isEndOfNamedRound(["Movies", "", "Science"], 2), false);
assert.equal(isEndOfNamedRound(["", ""], 0), false);

const view = roundViewAt(["Movies", "", "Science"], 1);
assert.equal(view?.title, "Movies");
assert.equal(view?.questionInRound, 1);
assert.equal(view?.questionsInRound, 2);
assert.equal(view?.index, 0);
assert.equal(view?.total, 2);

assert.equal(roundViewAt(["", ""], 0), null);

console.log("rounds tests passed");
