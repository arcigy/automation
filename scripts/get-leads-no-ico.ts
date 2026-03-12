import { sql } from "../core/db";

async function getLeads() {
  const leads = await sql`
    SELECT website, original_name, ico 
    FROM leads 
    WHERE (ico IS NULL OR ico = '') 
    LIMIT 10
  `;
  console.log(JSON.stringify(leads, null, 2));
  process.exit(0);
}

getLeads().catch(err => {
  console.error(err);
  process.exit(1);
});
