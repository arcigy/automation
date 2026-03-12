import { sql } from "../core/db";

async function c() {
  const r = await sql`SELECT id, website FROM leads WHERE (icebreaker_sentence IS NULL OR icebreaker_sentence = '' OR icebreaker_sentence = '...') AND primary_email IS NOT NULL AND primary_email != ''`;
  r.forEach(x => console.log(`${x.id} | ${x.website}`));
  process.exit(0);
}

c();
