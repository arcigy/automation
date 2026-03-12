import { handler } from "../automations/lead-enricher/handler";
import { sql } from "../core/db";
import * as fs from "fs";
import * as path from "path";

async function runTest() {
  const payloadPath = path.join(__dirname, "../tmp/test_payload.json");
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf-8"));

  console.log(`🚀 Spúšťam TEST ENRICHER na ${payload.length} leadov...`);

  for (const item of payload) {
    console.log(`\n---------------------------------------------------------`);
    console.log(`📡 SPRACÚVAM: ${item.website} (${item.original_name})`);
    console.log(`---------------------------------------------------------`);
    
    try {
      // Handler expects { leads: [...] }
      const res = await handler({ 
        leads: [{
          name: item.original_name,
          website: item.website
        }],
        aggressive_scraping: true
      });
      
      const result = { success: res.success, error: res.error, data: res.data?.leads[0] };
      
      if (result.success) {
        console.log(`✅ ÚSPECH:`);
        console.log(`   Názov: ${result.data?.official_company_name}`);
        console.log(`   IČO:   ${result.data?.ico}`);
        console.log(`   Email: ${result.data?.email}`);
        console.log(`   Konatelia: ${result.data?.decision_maker_name}`);
        console.log(`   Adresa: ${result.data?.address}`);
        console.log(`   Overené: ${result.data?.orsr_verified ? "ANO (ORSR/ZRSR) ✅" : "NIE ❌"}`);
      } else {
        console.error(`❌ CHYBA: ${result.error}`);
      }
    } catch (e: any) {
      console.error(`💥 CRASH: ${e.message}`);
    }
  }

  console.log(`\n✅ Hotovo. Všetky testy dobehli.`);
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
