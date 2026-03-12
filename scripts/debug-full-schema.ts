import { sql } from "../core/db";
async function check() {
  const r = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'niches'`;
  r.forEach(col => console.log(`${col.column_name}: ${col.data_type}`));
  process.exit(0);
}
check();
