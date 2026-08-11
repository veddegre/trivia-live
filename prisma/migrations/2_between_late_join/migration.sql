-- AlterEnum
ALTER TYPE "GameStatus" ADD VALUE 'BETWEEN';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "allowLateJoin" BOOLEAN NOT NULL DEFAULT true;
