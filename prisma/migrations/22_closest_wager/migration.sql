-- Closest number is scored when the question locks.
-- Wager is the points a player bet on this answer.
ALTER TABLE "Question" ADD COLUMN "closest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Question" ADD COLUMN "wager" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Answer" ADD COLUMN "wager" INTEGER NOT NULL DEFAULT 0;
