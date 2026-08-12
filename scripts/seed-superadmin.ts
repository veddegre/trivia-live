import "dotenv/config";
import { maybeBootstrapSuperAdmin, needsSetup } from "../src/lib/seed-admin";

async function main() {
  await maybeBootstrapSuperAdmin();
  const setup = await needsSetup();
  if (setup) {
    console.log(
      "No super-admin yet — open /admin to create one (or set SUPERADMIN_BOOTSTRAP=1)."
    );
  } else {
    console.log("Super-admin account(s) present");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
