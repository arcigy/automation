import { sql } from "../core/db";

async function analyzeOrphanLeads() {
  console.log("🔍 Analyzujem leadov bez priradenej niche...");
  
  const orphanStats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE decision_maker_name IS NOT NULL AND decision_maker_name != '') as has_name,
      COUNT(*) FILTER (WHERE primary_email IS NOT NULL AND primary_email != '') as has_email,
      COUNT(*) FILTER (WHERE icebreaker_sentence IS NOT NULL AND icebreaker_sentence != '') as has_icebreaker,
      COUNT(*) FILTER (WHERE decision_maker_name IS NOT NULL AND primary_email IS NOT NULL AND icebreaker_sentence IS NOT NULL AND sent_to_smartlead = false) as ready_to_send
    FROM leads
    WHERE niche_id IS NULL
  `;

  console.log(JSON.stringify(orphanStats[0], null, 2));
  process.exit(0);
}

analyzeOrphanLeads();
