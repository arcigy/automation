import { sql } from "../core/db";
async function list() {
  const res = await sql`SELECT website FROM leads WHERE (ico IS NULL OR ico = '') LIMIT 5`;
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}
list();
