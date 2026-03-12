import { sql } from "../core/db";

async function checkStats() {
  try {
    const successCount = await sql`
      SELECT COUNT(*) as count 
      FROM leads 
      WHERE verification_status != 'failed' 
      AND updated_at >= CURRENT_DATE
    `;

    const failedCount = await sql`
      SELECT COUNT(*) as count 
      FROM leads 
      WHERE verification_status = 'failed' 
      AND updated_at >= CURRENT_DATE
    `;

    const orsrVerifiedCount = await sql`
      SELECT COUNT(*) as count 
      FROM leads 
      WHERE orsr_verified IS TRUE
      AND updated_at >= CURRENT_DATE
    `;

    const remainingCount = await sql`
      SELECT COUNT(*) as remaining 
      FROM leads 
      WHERE (orsr_verified IS NOT TRUE) 
      AND (verification_status IS NULL OR verification_status != 'failed' OR updated_at < NOW() - INTERVAL '1 day')
    `;

    const startingCount = 195; // Pôvodný počiatočný stav z predošlého výpisu
    const currentRemaining = remainingCount[0].remaining;
    const processed = startingCount - currentRemaining;

    console.log(`=========================================`);
    console.log(`📊 Štatistika dnešného automatického chodu`);
    console.log(`=========================================`);
    console.log(`Spolu prejdených v tejto dávke: ${processed} / ${startingCount}`);
    console.log(`✅ Úspešne spracované a preverené (scraped): ${successCount[0].count}`);
    console.log(`   z toho ORSR našlo IČO a Meno: ${orsrVerifiedCount[0].count}`);
    console.log(`❌ Zlyhalo / Nekompletný web (failed): ${failedCount[0].count}`);
    console.log(`-----------------------------------------`);
    console.log(`⏳ Ešte ZOSTÁVA NA SPRACOVANIE: ${currentRemaining}`);
    console.log(`=========================================`);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkStats();
