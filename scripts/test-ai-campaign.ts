import { handler } from "../automations/smartlead-create-campaign/handler";

async function testAiCampaign() {
  console.log("🚀 Testujem tvorbu kampane s AI sekvenciami...");

  const payload = {
    name: "AI Test Niche " + new Date().toLocaleTimeString(),
    generateAiSequences: true,
    nicheDescription: "Majitelia malých autoservisov na Slovensku, ktorí nestíhajú dvíhať telefóny a chcú AI asistentku na objednávky.",
    customAiInstructions: "Použi veľmi priateľský tón, žiadne korporátne reči. Spomeň, že sme zo Slovenska.",
    // Link single account for test
    email_account_ids: [14382544], // Branislav Laubert
    daily_limit: 5,
    // Add one test lead
    leads: [
      {
        email: "branislav.l+aitest@arcigy.group",
        first_name: "Branislav",
        last_name: " Test",
        company_name: "Arcigy Test AI",
        custom_fields: {
            ico: "11223344"
        }
      }
    ]
  };

  try {
    const result = await handler(payload);
    console.log("\n✅ Výsledok:", JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ Test zlyhal:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

testAiCampaign();
