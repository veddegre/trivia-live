-- Each question can have its own type. Existing nights copy the type
-- they already used for every question.
ALTER TABLE "Question" ADD COLUMN "gameType" "GameType" NOT NULL DEFAULT 'TRIVIA';

UPDATE "Question" AS q
SET "gameType" = g."gameType"
FROM "Game" AS g
WHERE q."gameId" = g.id;
