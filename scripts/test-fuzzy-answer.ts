import assert from "node:assert/strict";
import { matchTypedAnswer, normalizeAnswer } from "../src/lib/fuzzy-answer";

assert.equal(normalizeAnswer("  The Beatles! "), "beatles");
assert.equal(normalizeAnswer("José"), "jose");
assert.equal(normalizeAnswer("A Team"), "team");

const accepted = ["The Beatles", "John Lennon"];
assert.equal(matchTypedAnswer("beatles", accepted), 0);
assert.equal(matchTypedAnswer("The Beatles", accepted), 0);
assert.equal(matchTypedAnswer("Beetles", accepted), 0);
assert.equal(matchTypedAnswer("john lenon", accepted), 1);
assert.equal(matchTypedAnswer("U2", ["Up"]), -1);
assert.equal(matchTypedAnswer("cat", ["category"]), -1);
assert.equal(matchTypedAnswer("Paris", ["Parma"]), -1);
assert.equal(matchTypedAnswer("   ", ["Beatles"]), -1);
assert.equal(matchTypedAnswer("New York", ["new york"]), 0);

console.log("fuzzy answer tests passed");
