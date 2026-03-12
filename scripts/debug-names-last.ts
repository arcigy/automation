import { sql } from "../core/db";

async function c() {
  const r = await sql`SELECT id, decision_maker_name, decision_maker_last_name FROM leads WHERE decision_maker_name IS NOT NULL AND decision_maker_name != '' LIMIT 10`;
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

c();
