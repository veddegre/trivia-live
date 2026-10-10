import assert from "node:assert/strict";
import { choiceCountsFor } from "../src/lib/choice-counts";

assert.deepEqual(
  choiceCountsFor(4, [
    { choiceIndex: 0 },
    { choiceIndex: 0 },
    { choiceIndex: 2 },
    { choiceIndex: 1 },
    { choiceIndex: 1 },
    { choiceIndex: 1 },
  ]),
  [2, 3, 1, 0]
);
assert.deepEqual(choiceCountsFor(2, [{ choiceIndex: -1 }, { choiceIndex: 9 }]), [0, 0]);
assert.deepEqual(choiceCountsFor(0, [{ choiceIndex: 0 }]), []);

console.log("choice-count tests passed");
