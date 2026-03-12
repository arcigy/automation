import { sql } from "../core/db";
async function l() {
  const r = await sql`SELECT id, name, slug FROM niches`;
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}
l();
