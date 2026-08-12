-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('HOST', 'SUPERADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HOST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Game_ownerId_idx" ON "Game"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GameResult_ownerId_idx" ON "GameResult"("ownerId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "Game" ADD CONSTRAINT "Game_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
