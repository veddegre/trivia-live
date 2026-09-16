import assert from "node:assert/strict";
import {
  STARTER_BANK_QUESTIONS,
  STARTER_BANK_TITLE,
  bankWriteSchema,
  draftQuestionFromBank,
  padDraftOptions,
} from "../src/lib/question-bank";
import { assertCorrectIndexes } from "../src/lib/question-schema";

assert.equal(STARTER_BANK_TITLE, "Starter pack");
assert.equal(STARTER_BANK_QUESTIONS.length >= 6, true);
assert.equal(assertCorrectIndexes(STARTER_BANK_QUESTIONS), null);

const parsed = bankWriteSchema.parse({
  title: "Movies",
  questions: STARTER_BANK_QUESTIONS,
});
assert.equal(parsed.title, "Movies");

const draft = draftQuestionFromBank(STARTER_BANK_QUESTIONS[0], "Science");
assert.equal(draft.roundTitle, "Science");
assert.equal(draft.imageKey, null);
assert.equal(draft.prompt, STARTER_BANK_QUESTIONS[0].prompt);
assert.deepEqual(padDraftOptions(["Yes", "No"]), ["Yes", "No", "", ""]);

assert.throws(() =>
  bankWriteSchema.parse({ title: "", questions: STARTER_BANK_QUESTIONS })
);

console.log("question-bank tests passed");
