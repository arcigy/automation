import { sql } from "../core/db";
async function check() {
  const r = await sql`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'niches' 
    AND is_nullable = 'NO' 
    AND column_default IS NULL
  `;
  console.log("Columns that MUST have a value provided (No default, Not Null):", r);
  process.exit(0);
}
check();
