import { randomBytes } from "crypto";

/** Unguessable token for host links and player sessions. */
export function secretToken(): string {
  return randomBytes(18).toString("hex");
}
