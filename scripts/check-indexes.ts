import { sql } from "../core/db";
async function checkIndexes() {
  const indexes = await sql`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `;
  for (const i of indexes) {
    console.log(`${i.tablename}: ${i.indexname} | ${i.indexdef}`);
  }
  process.exit(0);
}
checkIndexes();
