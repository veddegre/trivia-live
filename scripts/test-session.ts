import assert from "node:assert/strict";
import { secretToken } from "../src/lib/secret-token";

process.env.DATABASE_URL ||= "postgresql://trivia:trivia@127.0.0.1:5432/trivia";

async function main() {
  const { makeSessionToken, parseSessionToken } = await import("../src/lib/auth");

  const token = makeSessionToken("user_1", 4);
  const parsed = parseSessionToken(token);
  assert.equal(parsed?.userId, "user_1");
  assert.equal(parsed?.sessionVersion, 4);

  const dot = token.lastIndexOf(".");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const tampered = `${payload.replace(":4:", ":5:")}.${sig}`;
  assert.equal(parseSessionToken(tampered), null);
  assert.equal(parseSessionToken("user_1:123.abcd"), null);
  assert.equal(parseSessionToken(undefined), null);

  const fresh = secretToken();
  assert.equal(fresh.length, 36);
  assert.notEqual(fresh, secretToken());

  console.log("session tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
