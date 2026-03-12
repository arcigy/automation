import { sql } from "../core/db";
async function listAll() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  for (const t of tables) {
    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${t.table_name}`;
    console.log(`\n--- ${t.table_name} ---`);
    cols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
  }
  process.exit(0);
}
listAll();
