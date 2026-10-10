import assert from "node:assert/strict";
import { reverseChannelData } from "../src/lib/audio-reverse";

const input = new Float32Array([1, 2, 3, 4]);
const reversed = reverseChannelData(input);
assert.deepEqual([...reversed], [4, 3, 2, 1]);
assert.deepEqual([...input], [1, 2, 3, 4]);

assert.deepEqual([...reverseChannelData(new Float32Array([7]))], [7]);
assert.equal(reverseChannelData(new Float32Array()).length, 0);

console.log("audio-reverse tests passed");
