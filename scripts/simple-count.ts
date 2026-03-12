import { sql } from "../core/db";

async function c() {
  const r = await sql`SELECT COUNT(*) FROM leads WHERE primary_email IS NOT NULL AND primary_email != '' AND (icebreaker_sentence IS NULL OR icebreaker_sentence = '' OR icebreaker_sentence = '...')`;
  console.log(r);
  process.exit(0);
}

c();
