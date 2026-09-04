import assert from "node:assert/strict";
import {
  assertDisplayName,
  DISPLAY_NAME_REJECTED,
  normalizeForMatch,
} from "../src/lib/display-name";

assert.equal(assertDisplayName("  José O’Brien  "), "José O’Brien");
assert.equal(assertDisplayName("Anne-Marie"), "Anne-Marie");
assert.equal(assertDisplayName("P12"), "P12");
assert.equal(normalizeForMatch("5h1t"), "shit");

function rejects(name: string) {
  assert.throws(() => assertDisplayName(name), {
    message: DISPLAY_NAME_REJECTED,
  });
}

rejects("fuck");
rejects("f u c k");
rejects("sh1t");
rejects("Shithead");
rejects("xxx_nazi");
rejects("😎");
rejects("hello@world");
assert.throws(() => assertDisplayName("a".repeat(25)), {
  message: "Name must be 24 characters or fewer",
});

assert.equal(assertDisplayName("Bass"), "Bass");
assert.equal(assertDisplayName("Cassandra"), "Cassandra");
assert.equal(assertDisplayName("Dickens"), "Dickens");

console.log("display-name tests passed");
