import { sql } from "../core/db";
async function check() {
  const res = await sql`SELECT smartlead_campaign_id FROM niches WHERE smartlead_campaign_id IS NOT NULL`;
  console.log("Found campaigns:", res);
  process.exit(0);
}
check().catch(console.error);
