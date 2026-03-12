import { sql } from "../core/db";

async function globalStats() {
  const stats = await sql`
    SELECT 
      niche_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE ico IS NOT NULL AND ico != '') as with_ico,
      COUNT(*) FILTER (WHERE official_company_name IS NOT NULL AND official_company_name != '') as with_company
    FROM leads
    GROUP BY niche_id
  `;

  console.log(JSON.stringify(stats, null, 2));
  process.exit(0);
}

globalStats();
