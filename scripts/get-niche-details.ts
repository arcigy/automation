import { sql } from "../core/db";

async function c() {
  const r = await sql`SELECT id, name, keywords, regions FROM niches WHERE name = 'Auto Servis'`;
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

c();
