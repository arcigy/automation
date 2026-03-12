import { sql } from "../core/db";

async function c() {
  const r = await sql`
    SELECT COUNT(*) FROM leads 
    WHERE niche_id = '67f96b96-6de3-4abf-a5dc-ebadbf547704' 
    AND (LENGTH(icebreaker_sentence) < 30 OR icebreaker_sentence IS NULL OR icebreaker_sentence = '')
    AND primary_email IS NOT NULL AND primary_email != ''
  `;
  console.log(`Bad icebreakers count: ${r[0].count}`);
  
  const badOne = await sql`
    SELECT id, website, icebreaker_sentence 
    FROM leads 
    WHERE niche_id = '67f96b96-6de3-4abf-a5dc-ebadbf547704' 
    AND (LENGTH(icebreaker_sentence) < 30 OR icebreaker_sentence IS NULL OR icebreaker_sentence = '')
    AND primary_email IS NOT NULL AND primary_email != ''
    LIMIT 5
  `;
  console.log(JSON.stringify(badOne, null, 2));
  process.exit(0);
}

c();
