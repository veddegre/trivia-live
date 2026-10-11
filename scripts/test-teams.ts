import assert from "node:assert/strict";
import { teamLeaderboard, teamNameKey } from "../src/lib/teams";

assert.equal(teamNameKey("  The Dogs "), "the dogs");
assert.equal(teamNameKey("The Dogs"), teamNameKey("the dogs"));

const players = [
  { id: "a", name: "Ada", teamId: "t1", teamName: "Dogs", totalScore: 800 },
  { id: "b", name: "Bea", teamId: "t1", teamName: "Dogs", totalScore: 800 },
  { id: "c", name: "Cam", teamId: "t2", teamName: "Cats", totalScore: 500 },
];

const board = teamLeaderboard(
  players,
  new Map([
    ["a", 300],
  ])
);

assert.equal(board.length, 2);
assert.equal(board[0].name, "Dogs");
assert.equal(board[0].playerId, "t1");
assert.equal(board[0].totalScore, 800);
assert.equal(board[0].members, 2);
assert.equal(board[0].lastPoints, 300);
assert.equal(board[1].name, "Cats");
assert.equal(board[1].members, 1);
assert.equal(board[1].lastPoints, undefined);

console.log("team tests passed");
