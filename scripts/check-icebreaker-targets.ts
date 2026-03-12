import { sql } from "../core/db";

async function checkIcebreakerStats() {
  const nicheId = "67f96b96-6de3-4abf-a5dc-ebadbf547704"; // Auto Servis
  
  const stats = await sql`
    SELECT 
      COUNT(*) as total_with_email,
      COUNT(*) FILTER (WHERE icebreaker_sentence IS NULL OR icebreaker_sentence = '') as missing_icebreaker
    FROM leads 
    WHERE niche_id = ${nicheId}
    AND primary_email IS NOT NULL 
    AND primary_email != ''
  `;

  console.log("Icebreaker generation targets:");
  console.log(JSON.stringify(stats[0], null, 2));
  process.exit(0);
}

checkIcebreakerStats();
