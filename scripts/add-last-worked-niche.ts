import { sql } from "../core/db";

async function addColumn() {
  await sql`ALTER TABLE niches ADD COLUMN IF NOT EXISTS last_worked_at timestamptz`;
  console.log("✅ Pridaný stĺpec 'last_worked_at' do tabuľky 'niches'");
  process.exit(0);
}

addColumn().catch(console.error);
