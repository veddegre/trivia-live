import assert from "node:assert/strict";
import { buildNightRecap, csvCell, recapToCsv } from "../src/lib/night-recap";

const recap = buildNightRecap({
  gameType: "TRIVIA",
  questions: [
    {
      id: "q1",
      order: 0,
      prompt: "Capital of France?",
      roundTitle: "Geography",
      options: ["Paris", "Lyon"],
      correctIndex: 0,
      timeLimitSec: 30,
    },
    {
      id: "q2",
      order: 1,
      prompt: "2+2?",
      roundTitle: "",
      options: ["3", "4"],
      correctIndex: 1,
      timeLimitSec: 20,
    },
  ],
  players: [
    { id: "p1", name: "Ada", totalScore: 1500 },
    { id: "p2", name: "Ben", totalScore: 500 },
  ],
  answers: [
    {
      playerId: "p1",
      questionId: "q1",
      choiceIndex: 0,
      isCorrect: true,
      points: 1000,
    },
    {
      playerId: "p2",
      questionId: "q1",
      choiceIndex: 1,
      isCorrect: false,
      points: 0,
    },
    {
      playerId: "p1",
      questionId: "q2",
      choiceIndex: 1,
      isCorrect: true,
      points: 500,
    },
  ],
});

assert.equal(recap.standings[0].name, "Ada");
assert.equal(recap.questions[0].roundTitle, "Geography");
assert.equal(recap.questions[1].roundTitle, "Geography");
assert.equal(recap.questions[0].correctCount, 1);
assert.equal(recap.questions[0].answerCount, 2);
assert.equal(recap.questions[1].answerCount, 1);
assert.equal(recap.questions[1].answers[1].choiceIndex, null);
assert.equal(recap.questions[1].answers[1].name, "Ben");

assert.equal(csvCell('Ada "the first"'), '"Ada ""the first"""');
const csv = recapToCsv(recap);
assert.match(csv, /^Standings\nPlace,Name,Score\n1,Ada,1500/m);
assert.match(csv, /Capital of France\?/);
assert.match(csv, /Ben,,/);

console.log("night-recap tests passed");
