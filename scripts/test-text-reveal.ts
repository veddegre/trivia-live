import assert from "node:assert/strict";
import { finishLineTokens, unscrambleText } from "../src/lib/text-reveal";
import { silhouetteReveal } from "../src/lib/zoom";

const phrase = "new york";
assert.equal(unscrambleText(phrase, 0, "q1"), unscrambleText(phrase, 0, "q1"));
assert.notEqual(unscrambleText(phrase, 0, "q1"), phrase);
assert.equal(unscrambleText(phrase, 1, "q1"), phrase);
assert.equal(unscrambleText(phrase, 0, "q1").includes(" "), true);

const mid = unscrambleText("trivia", 0.5, "round");
assert.equal([...mid].slice(0, 3).join(""), "tri");

const again = unscrambleText("trivia", 0.5, "round");
assert.equal(again, mid);

const line = finishLineTokens("one two three", 0);
assert.deepEqual(line[0], { text: "one", hidden: false });
assert.equal(line[1].hidden, true);
assert.notEqual(line[1].text, "two");
assert.equal(line[2].text, "·····");

const halfway = finishLineTokens("one two three", 0.5);
assert.equal(halfway[1].hidden, false);
assert.equal(halfway[2].hidden, true);

assert.deepEqual(
  finishLineTokens("one two three", 1).map((token) => token.text),
  ["one", "two", "three"]
);

assert.equal(
  silhouetteReveal({ startZoom: 6, elapsedMs: 0, timeLimitSec: 30 }),
  0
);
assert.equal(
  silhouetteReveal({ startZoom: 16, elapsedMs: 30000, timeLimitSec: 30 }),
  1
);
assert.equal(
  silhouetteReveal({
    startZoom: 16,
    elapsedMs: 0,
    timeLimitSec: 30,
    revealed: true,
  }),
  1
);
const soft = silhouetteReveal({
  startZoom: 6,
  elapsedMs: 15000,
  timeLimitSec: 30,
});
const extreme = silhouetteReveal({
  startZoom: 16,
  elapsedMs: 15000,
  timeLimitSec: 30,
});
assert.ok(extreme < soft, `extreme ${extreme} should trail soft ${soft}`);

console.log("text-reveal tests passed");
