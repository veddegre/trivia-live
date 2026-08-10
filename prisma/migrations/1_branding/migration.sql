-- CreateEnum
CREATE TYPE "BrandPreset" AS ENUM ('default', 'ocean', 'forest', 'sunset', 'slate');

-- CreateEnum
CREATE TYPE "BrandMode" AS ENUM ('dark', 'light');

-- CreateTable
CREATE TABLE "SiteBrand" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "displayName" TEXT NOT NULL DEFAULT 'Trivia Live',
    "tagline" TEXT,
    "logoUrl" TEXT,
    "preset" "BrandPreset" NOT NULL DEFAULT 'default',
    "mode" "BrandMode" NOT NULL DEFAULT 'dark',
    "accent" TEXT,
    "background" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteBrand_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "brandDisplayName" TEXT,
ADD COLUMN "brandTagline" TEXT,
ADD COLUMN "brandLogoUrl" TEXT,
ADD COLUMN "brandPreset" "BrandPreset",
ADD COLUMN "brandMode" "BrandMode",
ADD COLUMN "brandAccent" TEXT,
ADD COLUMN "brandBackground" TEXT;

-- Seed default site brand
INSERT INTO "SiteBrand" ("id", "displayName", "preset", "mode", "updatedAt")
VALUES ('default', 'Trivia Live', 'default', 'dark', CURRENT_TIMESTAMP);
