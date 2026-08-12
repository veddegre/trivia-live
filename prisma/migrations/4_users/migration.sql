-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HOST', 'SUPERADMIN');

-- CreateTable
CREATE TABLE "User" (
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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "ownerId" TEXT;

-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Game_ownerId_idx" ON "Game"("ownerId");

-- CreateIndex
CREATE INDEX "GameResult_ownerId_idx" ON "GameResult"("ownerId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
