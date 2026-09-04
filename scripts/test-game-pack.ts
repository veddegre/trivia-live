import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  copyTitle,
  gameToPack,
  isSafePackMediaName,
  packFilename,
  parseImportBytes,
  parsePackJson,
  type SourceGame,
} from "../src/lib/game-pack";

const trivia: SourceGame = {
  title: "Friday Night",
  gameType: "TRIVIA",
  allowLateJoin: true,
  questions: [
    {
      prompt: "Capital of France?",
      options: ["Paris", "Lyon"],
      correctIndex: 0,
      timeLimitSec: 30,
      basePoints: 500,
      timeBonus: 500,
      startZoom: 10,
      startSpeed: 2,
      imageKey: null,
      audioKey: null,
    },
  ],
};

const { pack } = gameToPack(trivia);
assert.equal(pack.version, 1);
assert.equal(pack.gameType, "TRIVIA");
assert.equal(pack.questions[0].media, undefined);
assert.deepEqual(parsePackJson(pack), pack);

const withSecrets = {
  ...pack,
  code: "HACKME",
  hostToken: "secret",
  ownerId: "user-1",
};
const stripped = parsePackJson(withSecrets);
assert.equal("code" in stripped, false);
assert.equal("hostToken" in stripped, false);

assert.throws(() => parsePackJson({ ...pack, version: 2 }), {
  message: "Not a valid Trivia Live game pack",
});

assert.equal(copyTitle("Friday Night"), "Friday Night (copy)");
assert.equal(copyTitle("Friday Night (copy)"), "Friday Night (copy)");
assert.equal(copyTitle("a".repeat(120)).length, 120);
assert.equal(packFilename("Friday Night!", "json"), "Friday-Night.json");
assert.equal(packFilename("***", "zip"), "game.zip");

assert.equal(isSafePackMediaName("q-00.jpg"), true);
assert.equal(isSafePackMediaName("../etc/passwd"), false);
assert.equal(isSafePackMediaName("q-00.jpg/../../x"), false);

async function main() {
  const jsonBytes = Buffer.from(JSON.stringify(pack), "utf8");
  const parsedJson = await parseImportBytes(jsonBytes, "friday.json");
  assert.equal(parsedJson.pack.title, "Friday Night");
  assert.equal(parsedJson.media.size, 0);

  const zoomPack = {
    version: 1 as const,
    title: "Zoom night",
    gameType: "IMAGE_ZOOM" as const,
    allowLateJoin: true,
    questions: [
      {
        prompt: "What is this?",
        options: ["Cat", "Dog"],
        correctIndex: 0,
        media: "q-00.jpg",
      },
    ],
  };

  const zip = new JSZip();
  zip.file("game.json", JSON.stringify(zoomPack));
  zip.file("media/q-00.jpg", Buffer.from("fake-image"));
  zip.file("media/../evil.txt", Buffer.from("nope"));
  zip.file("__MACOSX/._game.json", Buffer.from("junk"));
  const zipBytes = Buffer.from(
    await zip.generateAsync({ type: "uint8array" })
  );
  const parsedZip = await parseImportBytes(zipBytes, "zoom.zip");
  assert.equal(parsedZip.pack.gameType, "IMAGE_ZOOM");
  assert.equal(parsedZip.media.has("q-00.jpg"), true);
  assert.equal(parsedZip.media.has("evil.txt"), false);
  assert.deepEqual([...parsedZip.media.keys()], ["q-00.jpg"]);

  assert.equal(copyTitle("Bass"), "Bass (copy)");

  console.log("game-pack tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
