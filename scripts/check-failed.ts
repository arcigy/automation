import { sql } from "../core/db";

async function checkFailed() {
  try {
    const failedLeads = await sql`
      SELECT website, verification_notes, updated_at
      FROM leads 
      WHERE verification_status = 'failed'
      ORDER BY updated_at DESC
      LIMIT 5
    `;
    
    const countRes = await sql`
      SELECT COUNT(*) as failed_count
      FROM leads
      WHERE verification_status = 'failed'
    `;

    console.log(`\nCelkový počet failed záznamov: ${countRes[0].failed_count}`);
    
    if (failedLeads.length > 0) {
      console.log("\nPosledných 5 failed chýb:");
      failedLeads.forEach(lead => {
         console.log(`- Web: ${lead.website}`);
         console.log(`  Chyba: ${lead.verification_notes}`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkFailed();
