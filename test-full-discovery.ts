import { handler } from "./automations/lead-discovery/handler";

async function run() {
    console.log("🚀 STARTING FULL E2E DISCOVERY + ENRICHMENT");
    
    // We'll search for 20 leads first to see how it performs
    const payload = {
        query: "autoservis Slovensko",
        num_leads: 20,
        campaign_tag: `autoservisy_sk_E2E_${new Date().toISOString().split('T')[0]}`
    };

    try {
        const result = await handler(payload);
        if (result.success) {
            console.log("\n✅ FULL SUCCESS");
            console.log(`Total Leads Discovered & Enriched: ${result.data?.total_found}`);
        } else {
            console.error("❌ FAILED:", result.error);
        }
    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
}

run();
