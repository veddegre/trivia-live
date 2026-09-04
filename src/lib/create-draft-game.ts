import { generateJoinCode } from "@/lib/codes";
import { prisma } from "@/lib/db";
import {
  copyTitle,
  isSafePackMediaName,
  mediaKeyForQuestion,
  questionsFromPack,
  type GamePack,
  type SourceGame,
} from "@/lib/game-pack";
import {
  copyMediaFile,
  deleteMediaFiles,
  saveImportedMedia,
} from "@/lib/media";
import {
  assertQuestionsForGameType,
  questionCreateData,
  type QuestionInput,
} from "@/lib/question-schema";
import type { GameType } from "@/lib/types";

export async function allocateJoinCode(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = generateJoinCode();
    const clash = await prisma.game.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  throw new Error("Could not allocate a join code");
}

async function insertDraftGame(opts: {
  title: string;
  gameType: GameType;
  allowLateJoin: boolean;
  ownerId: string;
  questions: QuestionInput[];
}) {
  const indexErr = assertQuestionsForGameType(opts.gameType, opts.questions);
  if (indexErr) throw new Error(indexErr);

  const code = await allocateJoinCode();
  return prisma.game.create({
    data: {
      title: opts.title,
      code,
      status: "DRAFT",
      gameType: opts.gameType,
      allowLateJoin: opts.allowLateJoin,
      ownerId: opts.ownerId,
      questions: {
        create: opts.questions.map((q, order) =>
          questionCreateData(q, order, opts.gameType)
        ),
      },
    },
    include: {
      questions: { orderBy: { order: "asc" } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createGameFromPack(opts: {
  pack: GamePack;
  media: Map<string, Buffer>;
  ownerId: string;
  title?: string;
}) {
  const written: string[] = [];
  try {
    const mediaKeys: (string | null)[] = [];
    for (const q of opts.pack.questions) {
      const needsMedia =
        opts.pack.gameType === "IMAGE_ZOOM" ||
        opts.pack.gameType === "AUDIO_SPEED";
      if (!needsMedia) {
        mediaKeys.push(null);
        continue;
      }
      if (!q.media || !isSafePackMediaName(q.media)) {
        throw new Error("Pack is missing media for a question");
      }
      const buf = opts.media.get(q.media);
      if (!buf) {
        throw new Error("Pack is missing media for a question");
      }
      const { key } = await saveImportedMedia(buf, q.media);
      written.push(key);
      mediaKeys.push(key);
    }

    return await insertDraftGame({
      title: opts.title ?? opts.pack.title,
      gameType: opts.pack.gameType,
      allowLateJoin: opts.pack.allowLateJoin,
      ownerId: opts.ownerId,
      questions: questionsFromPack(opts.pack, mediaKeys),
    });
  } catch (err) {
    await deleteMediaFiles(written);
    throw err;
  }
}

export async function cloneGame(opts: {
  source: SourceGame;
  ownerId: string;
  title?: string;
}) {
  const written: string[] = [];
  try {
    const questions: QuestionInput[] = [];
    for (const q of opts.source.questions) {
      const key = mediaKeyForQuestion(opts.source.gameType, q);
      let nextKey: string | null = null;
      if (key) {
        nextKey = await copyMediaFile(key);
        written.push(nextKey);
      }
      questions.push({
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        timeLimitSec: q.timeLimitSec,
        basePoints: q.basePoints,
        timeBonus: q.timeBonus,
        startZoom: q.startZoom,
        startSpeed: q.startSpeed,
        imageKey: opts.source.gameType === "IMAGE_ZOOM" ? nextKey : null,
        audioKey: opts.source.gameType === "AUDIO_SPEED" ? nextKey : null,
      });
    }

    return await insertDraftGame({
      title: opts.title ?? copyTitle(opts.source.title),
      gameType: opts.source.gameType,
      allowLateJoin: opts.source.allowLateJoin,
      ownerId: opts.ownerId,
      questions,
    });
  } catch (err) {
    await deleteMediaFiles(written);
    throw err;
  }
}
