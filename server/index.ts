import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { createSocketServer } from "./socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    void handle(req, res);
  });

  createSocketServer(httpServer);

  httpServer.listen(port, hostname, () => {
    console.log(`> Trivia Live ready on http://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
