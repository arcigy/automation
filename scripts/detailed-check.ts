import { sql } from "../core/db";

async function detailedCheck() {
  const nicheId = "67f96b96-6de3-4abf-a5dc-ebadbf547704";
  
  const results = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE decision_maker_name IS NULL OR decision_maker_name = '') as missing_name,
      COUNT(*) FILTER (WHERE primary_email IS NULL OR primary_email = '') as missing_email,
      COUNT(*) FILTER (WHERE icebreaker_sentence IS NULL OR icebreaker_sentence = '') as missing_icebreaker,
      COUNT(*) FILTER (WHERE ico IS NULL OR ico = '') as missing_ico
    FROM leads
    WHERE niche_id = ${nicheId}
  `;

  console.log(JSON.stringify(results[0], null, 2));
  process.exit(0);
}

detailedCheck();
