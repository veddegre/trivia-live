/** Case-insensitive key for night-long kick-bans (display name is the identity). */
export function banKey(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

export function isNameBanned(banned: string[], name: string): boolean {
  const key = banKey(name);
  if (!key) return false;
  return banned.some((entry) => banKey(entry) === key);
}

export function withBannedName(banned: string[], name: string): string[] {
  const trimmed = name.normalize("NFKC").trim();
  if (!trimmed || isNameBanned(banned, trimmed)) return banned;
  return [...banned, trimmed];
}
