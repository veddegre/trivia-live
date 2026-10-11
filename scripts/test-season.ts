import assert from "node:assert/strict";
import {
  buildSeasonStandings,
  finishedDay,
  nightCountsInSeason,
  parseSeasonDay,
  seasonNameKey,
  seasonWriteSchema,
  standingsFromStored,
} from "../src/lib/season";

assert.equal(seasonNameKey("  The   Dogs "), "the dogs");
assert.equal(parseSeasonDay("2026-02-31"), null);
assert.equal(parseSeasonDay("2026-10-10"), "2026-10-10");

const late = new Date("2026-10-11T01:00:00.000Z");
assert.equal(finishedDay(late), "2026-10-11");
assert.equal(nightCountsInSeason(late, "2026-10-10", "2026-10-10"), false);
assert.equal(nightCountsInSeason(late, "2026-10-11", "2026-10-11"), true);
assert.equal(nightCountsInSeason(late, null, null), true);

const board = buildSeasonStandings([
  {
    finishedAt: "2026-10-03T23:00:00.000Z",
    standings: [
      { name: "Sam", totalScore: 1000 },
      { name: "Jo", totalScore: 800 },
    ],
  },
  {
    finishedAt: "2026-10-10T23:00:00.000Z",
    standings: [
      { name: "sam", totalScore: 500 },
      { name: "Jo", totalScore: 500 },
    ],
  },
]);
assert.equal(board[0].name, "sam");
assert.equal(board[0].points, 1500);
assert.equal(board[0].nights, 2);
assert.equal(board[0].wins, 2);
assert.equal(board[1].name, "Jo");
assert.equal(board[1].points, 1300);
assert.equal(board[1].wins, 1);

assert.deepEqual(
  standingsFromStored(null, [{ name: "Ada", totalScore: 10 }]),
  [{ name: "Ada", totalScore: 10 }]
);
assert.deepEqual(
  standingsFromStored(
    { standings: [{ name: "Bea", totalScore: 4 }] },
    [{ name: "Ada", totalScore: 10 }]
  ),
  [{ name: "Bea", totalScore: 4 }]
);

assert.equal(seasonWriteSchema.safeParse({ title: "Fall", startsOn: "2026-12-01", endsOn: "2026-01-01" }).success, false);
assert.equal(seasonWriteSchema.safeParse({ title: "Fall", startsOn: null, endsOn: null }).success, true);

console.log("season tests passed");
