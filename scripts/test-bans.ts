import assert from "node:assert/strict";
import { banKey, isNameBanned, withBannedName } from "../src/lib/bans";

assert.equal(banKey("  Alice  "), "alice");
assert.equal(isNameBanned(["Alice"], "alice"), true);
assert.equal(isNameBanned(["Alice"], "ALICE"), true);
assert.equal(isNameBanned(["Alice"], "Bob"), false);
assert.equal(isNameBanned([], "Alice"), false);

assert.deepEqual(withBannedName(["Alice"], "alice"), ["Alice"]);
assert.deepEqual(withBannedName(["Alice"], "Bob"), ["Alice", "Bob"]);
assert.deepEqual(withBannedName([], "  "), []);

console.log("bans tests passed");
