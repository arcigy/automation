import { handler } from "../automations/gmail-ai-reply/handler";
import { runMigrations } from "../core/db";

async function run() {
  console.log("🛠️ Running DB Migrations first...");
  await runMigrations();
  console.log("\n🚀 Running Gmail AI Reply Dry-Run...");
  await handler({ dry_run: true });
  console.log("\n✅ Done");
  process.exit(0);
}

run().catch(console.error);
