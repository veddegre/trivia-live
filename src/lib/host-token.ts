const storageKey = (code: string) => `trivia-host:${code.toUpperCase()}`;

/** Persist host capability token in sessionStorage (tab-scoped, not in the URL). */
export function storeHostToken(code: string, token: string) {
  try {
    sessionStorage.setItem(storageKey(code), token);
  } catch {
    /* private mode / quota */
  }
}

export function readHostToken(code: string): string {
  try {
    return sessionStorage.getItem(storageKey(code)) || "";
  } catch {
    return "";
  }
}

export function clearHostToken(code: string) {
  try {
    sessionStorage.removeItem(storageKey(code));
  } catch {
    /* ignore */
  }
}
