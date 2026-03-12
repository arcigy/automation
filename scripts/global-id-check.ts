import { sql } from "../core/db";

async function c() {
  const r = await sql`
    SELECT id, website, primary_email, icebreaker_sentence, niche_id 
    FROM leads 
    WHERE primary_email IS NOT NULL 
    AND primary_email != ''
    AND (icebreaker_sentence IS NULL OR icebreaker_sentence = '' OR icebreaker_sentence = '...')
  `;
  console.log(`Global missing: ${r.length}`);
  r.forEach(x => console.log(`${x.id} | ${x.website} | Niche: ${x.niche_id}`));
  process.exit(0);
}

c();
