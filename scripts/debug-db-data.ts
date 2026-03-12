import { sql } from "../core/db";

async function checkDataInDb() {
  const nicheId = "67f96b96-6de3-4abf-a5dc-ebadbf547704"; // Auto Servis
  
  const leads = await sql`
    SELECT id, website, official_company_name, ico 
    FROM leads 
    WHERE niche_id = ${nicheId}
    LIMIT 20
  `;

  console.log("Database Content (First 20 leads):");
  console.log(JSON.stringify(leads, null, 2));
  process.exit(0);
}

checkDataInDb();
