-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT,
    "gameTitle" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "winnerName" TEXT NOT NULL,
    "winnerScore" INTEGER NOT NULL,
    "playerCount" INTEGER NOT NULL,
    "podium" JSONB,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_gameId_joinCode_key" ON "GameResult"("gameId", "joinCode");

-- CreateIndex
CREATE INDEX "GameResult_finishedAt_idx" ON "GameResult"("finishedAt");

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
