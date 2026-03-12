import { sql } from "../core/db";

async function checkSpecificNiche() {
  const nicheId = "67f96b96-6de3-4abf-a5dc-ebadbf547704"; // Auto Servis
  
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE decision_maker_name IS NOT NULL AND decision_maker_name != '') as has_name,
      COUNT(*) FILTER (WHERE primary_email IS NOT NULL AND primary_email != '') as has_email,
      COUNT(*) FILTER (WHERE icebreaker_sentence IS NOT NULL AND icebreaker_sentence != '') as has_icebreaker,
      COUNT(*) FILTER (WHERE decision_maker_name IS NOT NULL AND primary_email IS NOT NULL AND icebreaker_sentence IS NOT NULL AND sent_to_smartlead = false) as ready_to_send
    FROM leads
    WHERE niche_id = ${nicheId}
  `;

  console.log(JSON.stringify(stats[0], null, 2));
  process.exit(0);
}

checkSpecificNiche();
