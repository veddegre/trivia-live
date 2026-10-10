/** Milliseconds the device clock is ahead of the server stamp. Subtract from Date.now(). */
export function clockOffsetMs(serverNow: string, clientNow: number): number | null {
  const serverMs = new Date(serverNow).getTime();
  if (Number.isNaN(serverMs)) return null;
  return clientNow - serverMs;
}
