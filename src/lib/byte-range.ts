export type ByteRange = { start: number; end: number };

/**
 * Parse a single `Range: bytes=` header.
 * Returns null when the range is absent, malformed, or outside the file.
 */
export function parseByteRange(
  header: string | null,
  size: number
): ByteRange | "all" | null {
  if (!header) return "all";
  if (size < 0) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bytes=")) return null;
  const spec = trimmed.slice(trimmed.indexOf("=") + 1).trim();
  if (!spec || spec.includes(",")) return null;

  const match = /^(\d*)-(\d*)$/.exec(spec);
  if (!match) return null;
  const startText = match[1];
  const endText = match[2];
  if (!startText && !endText) return null;
  if (size === 0) return null;

  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(startText);
  if (!Number.isInteger(start) || start < 0 || start >= size) return null;
  let end = endText === "" ? size - 1 : Number(endText);
  if (!Number.isInteger(end) || end < start) return null;
  if (end >= size) end = size - 1;
  return { start, end };
}
