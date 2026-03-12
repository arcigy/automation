import { sql } from "../core/db";

async function check() {
  const niches = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'niches'`;
  const leads = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'leads'`;
  
  console.log("NICHES COLUMNS:", niches.map(c => c.column_name).join(", "));
  console.log("LEADS COLUMNS:", leads.map(c => c.column_name).join(", "));
  process.exit(0);
}
check();
