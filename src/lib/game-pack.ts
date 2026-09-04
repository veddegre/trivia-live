import fs from "fs/promises";
import JSZip from "jszip";
import {
  SCORE_BASE_DEFAULT,
  SCORE_TIME_BONUS_DEFAULT,
  START_SPEED_DEFAULT,
  START_SPEED_MAX,
  START_SPEED_MIN,
  START_ZOOM_DEFAULT,
  START_ZOOM_MAX,
  START_ZOOM_MIN,
  type GameType,
} from "@/lib/types";
import { resolveUploadPath } from "@/lib/media";
import { gameTypeSchema, type QuestionInput } from "@/lib/question-schema";
import { z } from "zod";

export const GAME_PACK_VERSION = 1;
export const MAX_PACK_BYTES = 80 * 1024 * 1024;

const packQuestionSchema = z.object({
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  timeLimitSec: z.number().int().min(5).max(300).optional(),
  basePoints: z.number().int().min(0).max(10000).optional(),
  timeBonus: z.number().int().min(0).max(10000).optional(),
  startZoom: z
    .number()
    .int()
    .min(START_ZOOM_MIN)
    .max(START_ZOOM_MAX)
    .optional(),
  startSpeed: z
    .number()
    .min(START_SPEED_MIN)
    .max(START_SPEED_MAX)
    .optional(),
  media: z.string().min(1).max(80).optional(),
});

export const gamePackSchema = z.object({
  version: z.literal(GAME_PACK_VERSION),
  title: z.string().min(1).max(120),
  gameType: gameTypeSchema,
  allowLateJoin: z.boolean().optional().default(true),
  questions: z.array(packQuestionSchema).min(1).max(100),
});

export type GamePack = z.infer<typeof gamePackSchema>;

export type PackMediaFile = { zipName: string; key: string };

export type SourceGame = {
  title: string;
  gameType: GameType;
  allowLateJoin: boolean;
  questions: {
    prompt: string;
    options: string[];
    correctIndex: number;
    timeLimitSec: number;
    basePoints: number;
    timeBonus: number;
    startZoom: number;
    startSpeed: number;
    imageKey: string | null;
    audioKey: string | null;
  }[];
};

const SAFE_MEDIA_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,78}$/;
const ZIP_MEDIA_ENTRY = /^media\/([A-Za-z0-9][A-Za-z0-9._-]{0,78})$/;

export function isSafePackMediaName(name: string): boolean {
  return SAFE_MEDIA_NAME.test(name) && !name.includes("..");
}

export function copyTitle(title: string): string {
  const suffix = " (copy)";
  const base = title.endsWith(suffix)
    ? title.slice(0, -suffix.length).trimEnd()
    : title;
  const room = 120 - suffix.length;
  const trimmed = base.length <= room ? base : base.slice(0, room).trimEnd();
  return `${trimmed}${suffix}`;
}

export function packFilename(title: string, ext: "json" | "zip"): string {
  const slug =
    title
      .normalize("NFKD")
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "game";
  return `${slug}.${ext}`;
}

export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\w.\-]+/g, "_");
  return `attachment; filename="${ascii}"`;
}

export function mediaKeyForQuestion(
  gameType: GameType,
  q: SourceGame["questions"][number]
): string | null {
  if (gameType === "IMAGE_ZOOM") return q.imageKey;
  if (gameType === "AUDIO_SPEED") return q.audioKey;
  return null;
}

function zipNameForKey(order: number, key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() || "bin";
  return `q-${String(order).padStart(2, "0")}.${ext}`;
}

export function gameToPack(game: SourceGame): {
  pack: GamePack;
  files: PackMediaFile[];
} {
  const files: PackMediaFile[] = [];
  const questions = game.questions.map((q, order) => {
    const key = mediaKeyForQuestion(game.gameType, q);
    const zipName = key ? zipNameForKey(order, key) : undefined;
    if (key && zipName) files.push({ zipName, key });
    return {
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      timeLimitSec: q.timeLimitSec,
      basePoints: q.basePoints,
      timeBonus: q.timeBonus,
      startZoom: q.startZoom,
      startSpeed: q.startSpeed,
      ...(zipName ? { media: zipName } : {}),
    };
  });
  return {
    pack: {
      version: GAME_PACK_VERSION,
      title: game.title,
      gameType: game.gameType,
      allowLateJoin: game.allowLateJoin,
      questions,
    },
    files,
  };
}

export function parsePackJson(raw: unknown): GamePack {
  const parsed = gamePackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Not a valid Trivia Live game pack");
  }
  return parsed.data;
}

function looksLikeZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

export async function parseImportBytes(
  buf: Buffer,
  filename = ""
): Promise<{ pack: GamePack; media: Map<string, Buffer> }> {
  const asZip =
    looksLikeZip(buf) || filename.toLowerCase().endsWith(".zip");
  if (!asZip) {
    let json: unknown;
    try {
      json = JSON.parse(buf.toString("utf8"));
    } catch {
      throw new Error("Not a valid Trivia Live game pack");
    }
    return { pack: parsePackJson(json), media: new Map() };
  }

  const zip = await JSZip.loadAsync(buf);
  const manifest = zip.file("game.json");
  if (!manifest) {
    throw new Error("Zip is missing game.json");
  }
  let json: unknown;
  try {
    json = JSON.parse(await manifest.async("string"));
  } catch {
    throw new Error("game.json is not valid JSON");
  }
  const pack = parsePackJson(json);
  const media = new Map<string, Buffer>();
  for (const [entryName, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const match = entryName.match(ZIP_MEDIA_ENTRY);
    if (!match) continue;
    const name = match[1];
    media.set(name, Buffer.from(await file.async("uint8array")));
  }
  return { pack, media };
}

export function questionsFromPack(
  pack: GamePack,
  mediaKeys: (string | null)[]
): QuestionInput[] {
  return pack.questions.map((q, i) => ({
    prompt: q.prompt,
    options: q.options,
    correctIndex: q.correctIndex,
    timeLimitSec: q.timeLimitSec ?? 30,
    basePoints: q.basePoints ?? SCORE_BASE_DEFAULT,
    timeBonus: q.timeBonus ?? SCORE_TIME_BONUS_DEFAULT,
    startZoom: q.startZoom ?? START_ZOOM_DEFAULT,
    startSpeed: q.startSpeed ?? START_SPEED_DEFAULT,
    imageKey:
      pack.gameType === "IMAGE_ZOOM" ? mediaKeys[i] ?? null : null,
    audioKey:
      pack.gameType === "AUDIO_SPEED" ? mediaKeys[i] ?? null : null,
  }));
}

export async function buildExportBytes(game: SourceGame): Promise<{
  bytes: Buffer;
  filename: string;
  contentType: string;
}> {
  const { pack, files } = gameToPack(game);
  const json = JSON.stringify(pack, null, 2);

  if (game.gameType === "TRIVIA" && files.length === 0) {
    return {
      bytes: Buffer.from(json, "utf8"),
      filename: packFilename(game.title, "json"),
      contentType: "application/json; charset=utf-8",
    };
  }

  const zip = new JSZip();
  zip.file("game.json", json);
  for (const file of files) {
    const full = resolveUploadPath(file.key);
    if (!full) {
      throw new Error("A media file is missing — cannot export this game");
    }
    const data = await fs.readFile(full);
    zip.file(`media/${file.zipName}`, data);
  }

  const bytes = Buffer.from(
    await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    })
  );
  return {
    bytes,
    filename: packFilename(game.title, "zip"),
    contentType: "application/zip",
  };
}
