import { sql } from "../core/db";

async function checkNullStats() {
  const nicheId = "67f96b96-6de3-4abf-a5dc-ebadbf547704";
  
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE ico IS NOT NULL AND ico != '') as has_ico,
      COUNT(*) FILTER (WHERE official_company_name IS NOT NULL AND official_company_name != '') as has_company_name
    FROM leads 
    WHERE niche_id = ${nicheId}
  `;

  console.log("Stats for niche:", nicheId);
  console.log(JSON.stringify(stats[0], null, 2));
  process.exit(0);
}

checkNullStats();
