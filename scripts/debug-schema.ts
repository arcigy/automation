import { sql } from "../core/db";
async function check() {
  const r = await sql`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'niches'`;
  console.log(r);
  process.exit(0);
}
check();
