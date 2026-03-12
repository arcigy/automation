import { sql } from "../core/db";

async function verify() {
  const r = await sql`
    SELECT id, website, icebreaker_sentence 
    FROM leads 
    WHERE niche_id = '67f96b96-6de3-4abf-a5dc-ebadbf547704' 
    AND icebreaker_sentence IS NOT NULL 
    AND icebreaker_sentence != ''
    ORDER BY updated_at DESC
    LIMIT 10
  `;
  console.log(JSON.stringify(r.map(x => ({ web: x.website, ice: x.icebreaker_sentence })), null, 2));
  process.exit(0);
}

verify();
