/**
 * Production env checks that are safe to import from the custom Node server
 * (must not pull in `next/headers` / AsyncLocalStorage).
 */
export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;

  const secret = process.env.SESSION_SECRET?.trim() || "";
  const weak = new Set([
    "",
    "trivia-dev-secret",
    "trivia-admin",
    "change-me",
    "change-me-too",
    "change-me-to-a-long-random-string",
    "secret",
    "password",
    "trivia-session-secret",
    "trivia-local-session-secret-change-me",
  ]);
  if (secret.length < 24 || weak.has(secret)) {
    console.error(
      "[trivia-live] WARNING: SESSION_SECRET is missing or weak. " +
        "Using an ephemeral secret for this process — set SESSION_SECRET " +
        "(24+ random chars) and restart so sessions survive restarts."
    );
  }
  if (
    !(process.env.SETUP_TOKEN || "").trim() &&
    process.env.SUPERADMIN_BOOTSTRAP !== "1"
  ) {
    console.error(
      "[trivia-live] WARNING: SETUP_TOKEN is not set. First-time /admin setup " +
        "will fail until you set SETUP_TOKEN (or SUPERADMIN_BOOTSTRAP=1)."
    );
  }
}
