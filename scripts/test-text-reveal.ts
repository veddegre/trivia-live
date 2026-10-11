import assert from "node:assert/strict";
import { forSpectator } from "../src/lib/spectator-state";
import { finishLineTokens, unscrambleText, visiblePuzzleText } from "../src/lib/text-reveal";
import type { GamePublicState } from "../src/lib/types";
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

const hiddenLine = visiblePuzzleText({
  text: "one two three",
  mode: "line",
  seed: "q",
  openedAt: null,
  timeLimitSec: 30,
  now: Date.parse("2026-10-10T12:00:00.000Z"),
});
assert.equal(hiddenLine.startsWith("one"), true);
assert.equal(hiddenLine.includes("two"), false);
assert.equal(hiddenLine.includes("three"), false);

const solved = visiblePuzzleText({
  text: "new york",
  mode: "unscramble",
  seed: "q1",
  openedAt: "2026-10-10T12:00:00.000Z",
  timeLimitSec: 30,
  now: Date.parse("2026-10-10T12:00:00.000Z"),
});
assert.notEqual(solved, "new york");

const board = {
  code: "ABC",
  title: "Night",
  gameType: "FINISH_LINE",
  phase: "question",
  status: "QUESTION",
  playerCount: 0,
  answerCount: 0,
  questionIndex: 0,
  questionTotal: 1,
  question: {
    id: "q",
    order: 0,
    prompt: "Finish it",
    options: ["a", "b"],
    timeLimitSec: 30,
    revealText: "one two three",
  },
  questionOpenedAt: null,
  questionPausedAt: null,
  questionExtraMs: 0,
  serverNow: "2026-10-10T12:00:00.000Z",
  timeLimitSec: 30,
  leaderboard: [],
  leader: null,
  winner: null,
  tiedWinners: null,
  hotStreak: null,
  allowLateJoin: true,
  allowAnswerChange: false,
  round: null,
  rounds: null,
  endedRound: null,
  brand: {
    displayName: "Trivia",
    tagline: null,
    logoUrl: null,
    mode: "dark",
    tokens: {
      ink: "#000",
      ink2: "#111",
      panel: "#222",
      line: "#333",
      chalk: "#fff",
      muted: "#999",
      amber: "#f0a820",
      amberHot: "#ffc14d",
    },
  },
} as GamePublicState;

const watching = forSpectator(board);
assert.equal(watching.question?.revealSnapshot, true);
assert.equal(watching.question?.revealText?.includes("two"), false);

const revealed = forSpectator({ ...board, phase: "reveal" });
assert.equal(revealed.question?.revealText, "one two three");
assert.equal(revealed.question?.revealSnapshot, undefined);

console.log("text-reveal tests passed");
