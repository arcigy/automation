import { sql } from "../core/db";
import { injectToSmartlead } from "../automations/smartlead-injector/handler";

async function createTestCampaign() {
  console.log("🚀 Spúšťam vytvorenie testovacej kampane...");

  try {
    const nicheName = "Realitky TEST " + new Date().toLocaleTimeString();
    const nicheSlug = "realitky-test-" + Date.now();
    
    // Explicitly providing all fields that might be required
    const [niche] = await sql`
      INSERT INTO niches (
        name, 
        slug, 
        tier, 
        status, 
        keywords, 
        regions, 
        last_worked_at,
        daily_target,
        current_region_index
      ) 
      VALUES (
        ${nicheName}, 
        ${nicheSlug}, 
        1, 
        'active', 
        ${['test']}, 
        ${['Bratislava']}, 
        now(),
        130,
        0
      ) 
      RETURNING *
    `;
    console.log(`✅ Niche vytvorená v DB: ${niche.name} (ID: ${niche.id})`);

    const testLeads = [
      {
        email: "branislav.l+test1@arcigy.com",
        decision_maker_name: "Branislav Test",
        company_name_short: "Arcigy Test",
        official_company_name: "Arcigy s.r.o.",
        website: "https://arcigy.com",
        ico: "12345678",
        icebreaker_sentence: "Tento email bol vygenerovaný automaticky pri teste systému."
      }
    ];

    console.log("📡 Odosielam dáta do Smartleadu...");
    const result = await injectToSmartlead(testLeads as any, niche as any);

    console.log(`\n🎉 HOTOVO!`);
    console.log(`Kampaň bola úspešne vytvorená, nastavená a spustená (LIVE).`);
    
    process.exit(0);
  } catch (error: any) {
    console.error("❌ CHYBA:", error.message || error);
    if (error.detail) console.error("DETAIL:", error.detail);
    process.exit(1);
  }
}

createTestCampaign();
