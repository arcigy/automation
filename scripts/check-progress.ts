import { sql } from "../core/db";

async function checkProgress() {
  try {
    const res = await sql`
      SELECT COUNT(*) as remaining 
      FROM leads 
      WHERE (orsr_verified IS NOT TRUE) 
      AND (verification_status IS NULL OR verification_status != 'failed' OR updated_at < NOW() - INTERVAL '1 day')
    `;
    console.log(`Zostávajúci počet na spracovanie: ${res[0].remaining}`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkProgress();
