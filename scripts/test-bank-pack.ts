import assert from "node:assert/strict";
import {
  bankToPack,
  parseBankFile,
  parseBankJson,
} from "../src/lib/bank-pack";

const source = {
  title: "Movies",
  questions: [
    {
      prompt: "Who directed Jaws?",
      options: ["Spielberg", "Scorsese", "Nolan"],
      correctIndex: 0,
      timeLimitSec: 30,
      basePoints: 500,
      timeBonus: 500,
      bonus: "NONE",
    },
  ],
};

const pack = bankToPack(source);
assert.equal(pack.version, 1);
assert.equal(pack.title, "Movies");
assert.equal(pack.questions[0].correctIndex, 0);

const roundTrip = parseBankFile(Buffer.from(JSON.stringify(pack)), "movies.json");
assert.equal(roundTrip.title, "Movies");
assert.equal(roundTrip.questions[0].prompt, "Who directed Jaws?");

const stripped = parseBankJson(
  {
    ...pack,
    code: "HACK",
    hostToken: "secret",
    ownerId: "user-1",
  },
  "movies.json"
);
assert.equal("code" in stripped, false);
assert.equal("hostToken" in stripped, false);
assert.equal(stripped.questions.length, 1);

const fromList = parseBankJson(
  [
    {
      prompt: "Capital of France?",
      options: ["Paris", "Lyon"],
      correctIndex: 1,
    },
  ],
  "europe.csv"
);
assert.equal(fromList.title, "europe");
assert.equal(fromList.questions[0].correctIndex, 1);
assert.equal(fromList.questions[0].timeLimitSec, 30);

assert.throws(
  () =>
    parseBankJson({
      version: 1,
      title: "Night",
      gameType: "TRIVIA",
      questions: source.questions,
    }),
  { message: "This is a game pack. Import it from Games." }
);

assert.throws(() => parseBankFile(Buffer.from("{"), "bad.json"), {
  message: "Not a valid question bank",
});

const csv = [
  "prompt,A,B,C,D,correct,time,bonus",
  '"What has a comma, really?",Paris,Lyon,Marseille,Nice,A,20,double',
  "Capital of France?,Paris,Lyon,Marseille,Nice,Paris,,",
  "How many strings?,4,5,6,7,3,30,lightning",
].join("\n");
const fromCsv = parseBankFile(Buffer.from(csv), "music_night.csv");
assert.equal(fromCsv.title, "music night");
assert.equal(fromCsv.questions[0].prompt, "What has a comma, really?");
assert.equal(fromCsv.questions[0].correctIndex, 0);
assert.equal(fromCsv.questions[0].timeLimitSec, 20);
assert.equal(fromCsv.questions[0].bonus, "DOUBLE");
assert.equal(fromCsv.questions[1].correctIndex, 0);
assert.equal(fromCsv.questions[2].correctIndex, 2);
assert.equal(fromCsv.questions[2].bonus, "LIGHTNING");

const semi = "prompt;A;B;correct\nCapital?;Paris;Lyon;B\n";
const fromSemi = parseBankFile(Buffer.from(semi), "places.csv");
assert.equal(fromSemi.questions[0].correctIndex, 1);

assert.throws(
  () => parseBankFile(Buffer.from("prompt,A,B\nQ?,Yes,No\n"), "x.csv"),
  { message: "CSV needs a correct column" }
);

console.log("bank-pack tests passed");
