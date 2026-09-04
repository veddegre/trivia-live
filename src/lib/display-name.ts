/** Shared reject copy — do not echo the blocked word. */
export const DISPLAY_NAME_REJECTED = "Pick another display name.";

export const DISPLAY_NAME_MAX = 24;

/** Letters, numbers, spaces, hyphen, apostrophe (José, O’Brien, Anne-Marie). */
const ALLOWED =
  /^[\p{L}\p{N}]+(?:[ '\u2019\-][\p{L}\p{N}]+)*$/u;

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

/**
 * Obvious projector-unsafe terms. Short tokens are exact-match only so
 * "Bass" / "Cass" / "Dickens" are not blocked.
 */
const BLOCKED_EXACT = new Set([
  "anal",
  "anus",
  "asshole",
  "bastard",
  "bitch",
  "blowjob",
  "boob",
  "boobs",
  "clit",
  "clitoris",
  "cock",
  "cocks",
  "coon",
  "cunt",
  "cum",
  "dick",
  "dicks",
  "dildo",
  "dyke",
  "fag",
  "faggot",
  "fags",
  "fuck",
  "fucker",
  "fucking",
  "handjob",
  "jizz",
  "kike",
  "nazi",
  "nigga",
  "nigger",
  "penis",
  "piss",
  "porn",
  "pussy",
  "rape",
  "rapist",
  "retard",
  "retarded",
  "semen",
  "shit",
  "slut",
  "sluts",
  "spastic",
  "tits",
  "twat",
  "vagina",
  "wank",
  "wanker",
  "whore",
]);

/**
 * Longer slurs also matched inside a collapsed name (f u c k, shithead).
 * Kept off short/name-like tokens (dick → Dickens, anal → analysis).
 */
const BLOCKED_CONTAINED = [
  "asshole",
  "blowjob",
  "dildo",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "handjob",
  "nigger",
  "penis",
  "pussy",
  "rapist",
  "retard",
  "retarded",
  "semen",
  "shit",
  "vagina",
  "whore",
];

function foldLeet(s: string): string {
  let out = "";
  for (const ch of s) {
    out += LEET[ch] ?? ch;
  }
  return out;
}

/** Lowercase, strip marks, map leetspeak, keep letters only. */
export function normalizeForMatch(name: string): string {
  const folded = foldLeet(name.normalize("NFKC").toLowerCase());
  return folded.replace(/[^\p{L}]+/gu, "");
}

function tokens(name: string): string[] {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .split(/[\s'\u2019\-]+/)
    .map((t) => foldLeet(t).replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter(Boolean);
}

export function assertDisplayName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Name is required");
  if (name.length > DISPLAY_NAME_MAX) {
    throw new Error(`Name must be ${DISPLAY_NAME_MAX} characters or fewer`);
  }
  if (!ALLOWED.test(name)) {
    throw new Error(DISPLAY_NAME_REJECTED);
  }

  const collapsed = normalizeForMatch(name);
  if (BLOCKED_EXACT.has(collapsed)) {
    throw new Error(DISPLAY_NAME_REJECTED);
  }
  for (const token of tokens(name)) {
    if (BLOCKED_EXACT.has(token)) {
      throw new Error(DISPLAY_NAME_REJECTED);
    }
  }
  for (const word of BLOCKED_CONTAINED) {
    if (collapsed.includes(word)) {
      throw new Error(DISPLAY_NAME_REJECTED);
    }
  }

  return name;
}
