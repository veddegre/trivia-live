-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('TRIVIA', 'IMAGE_ZOOM');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "gameType" "GameType" NOT NULL DEFAULT 'TRIVIA';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "imageKey" TEXT;
ALTER TABLE "Question" ADD COLUMN "startZoom" INTEGER NOT NULL DEFAULT 10;
