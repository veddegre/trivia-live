import assert from "node:assert/strict";
import { parseByteRange } from "../src/lib/byte-range";

assert.equal(parseByteRange(null, 1000), "all");
assert.deepEqual(parseByteRange("bytes=0-99", 1000), { start: 0, end: 99 });
assert.deepEqual(parseByteRange("bytes=0-", 1000), { start: 0, end: 999 });
assert.deepEqual(parseByteRange("bytes=-100", 1000), { start: 900, end: 999 });
assert.deepEqual(parseByteRange("bytes=-5000", 1000), { start: 0, end: 999 });
assert.equal(parseByteRange("bytes=1000-1001", 1000), null);
assert.equal(parseByteRange("bytes=0-1,2-3", 1000), null);
assert.equal(parseByteRange("bytes=5-1", 1000), null);
assert.equal(parseByteRange("bytes=0-10", 0), null);
assert.equal(parseByteRange("items=0-1", 1000), null);

console.log("byte-range tests passed");
