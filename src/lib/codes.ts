/**
 * Unambiguous alphabet — no I/l/1, O/0, J, L, Q (easy to misread aloud or on a TV).
 */
const ALPHABET = "ABCDEFGHKMNPRSTUVWXYZ23456789";

export function generateJoinCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
