import { sql } from "../core/db";

async function findOne() {
  const r = await sql`
    SELECT id, website, primary_email, icebreaker_sentence 
    FROM leads 
    WHERE niche_id = '67f96b96-6de3-4abf-a5dc-ebadbf547704' 
    AND (icebreaker_sentence IS NULL OR icebreaker_sentence = '')
  `;
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

findOne();
