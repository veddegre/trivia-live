ALTER TABLE "Game" ADD COLUMN "teamMode" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_gameId_nameKey_key" ON "Team"("gameId", "nameKey");
CREATE INDEX "Team_gameId_idx" ON "Team"("gameId");

ALTER TABLE "Team" ADD CONSTRAINT "Team_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Player" ADD COLUMN "teamId" TEXT;

CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
