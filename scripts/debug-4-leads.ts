import { sql } from "../core/db";

async function c() {
  const r = await sql`SELECT id, website, primary_email, icebreaker_sentence FROM leads WHERE primary_email IS NOT NULL AND primary_email != '' AND (icebreaker_sentence IS NULL OR icebreaker_sentence = '' OR icebreaker_sentence = '...')`;
  console.log(JSON.stringify(r.map(x => ({id: x.id, web: x.website, email: x.primary_email, ice: x.icebreaker_sentence})), null, 2));
  process.exit(0);
}

c();
