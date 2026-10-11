import assert from "node:assert/strict";
import { formatLog, healthBody } from "../src/lib/log";

const line = JSON.parse(
  formatLog("info", "ready", { port: 3000, msg: "nope", time: "nope" })
);
assert.equal(line.level, "info");
assert.equal(line.msg, "ready");
assert.equal(line.port, 3000);
assert.notEqual(line.time, "nope");
assert.equal(typeof line.time, "string");

assert.deepEqual(healthBody({ db: true, uploads: true }), {
  status: 200,
  body: { ok: true, db: true, uploads: true },
});
assert.equal(healthBody({ db: false, uploads: true }).status, 503);
assert.equal(healthBody({ db: true, uploads: false }).body.ok, false);

console.log("ops tests passed");
