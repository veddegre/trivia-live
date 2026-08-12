import "dotenv/config";
import { ensureSuperAdmin } from "../src/lib/seed-admin";

ensureSuperAdmin()
  .then(() => {
    console.log("Super-admin ready");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
