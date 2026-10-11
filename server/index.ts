import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { log } from "@/lib/log";
import { assertProductionSecrets } from "../src/lib/production-secrets";
import { createSocketServer } from "./socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

async function main() {
  assertProductionSecrets();

  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    void handle(req, res);
  });

  createSocketServer(httpServer);

  httpServer.listen(port, hostname, () => {
    log.info("ready", { host: hostname, port });
  });
}

main().catch((err) => {
  log.error("server failed", {
    err: err instanceof Error ? err.message : "startup failed",
  });
  process.exit(1);
});
