export type LogLevel = "info" | "warn" | "error";

const RESERVED = new Set(["time", "level", "msg"]);

/** One JSON object per line. Extra fields cannot replace time, level, or msg. */
export function formatLog(
  level: LogLevel,
  msg: string,
  fields?: Record<string, unknown>
): string {
  const extra: Record<string, unknown> = {};
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      if (RESERVED.has(key)) continue;
      extra[key] = value;
    }
  }
  return JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg,
    ...extra,
  });
}

function write(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
  const line = `${formatLog(level, msg, fields)}\n`;
  if (level === "error" || level === "warn") process.stderr.write(line);
  else process.stdout.write(line);
}

export const log = {
  info(msg: string, fields?: Record<string, unknown>) {
    write("info", msg, fields);
  },
  warn(msg: string, fields?: Record<string, unknown>) {
    write("warn", msg, fields);
  },
  error(msg: string, fields?: Record<string, unknown>) {
    write("error", msg, fields);
  },
};

export function healthBody(checks: { db: boolean; uploads: boolean }) {
  const ok = checks.db && checks.uploads;
  return {
    status: ok ? 200 : 503,
    body: { ok, db: checks.db, uploads: checks.uploads },
  };
}
