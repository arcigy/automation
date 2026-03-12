import { handler } from "../automations/lead-enricher/handler";
import { sql } from "../core/db";

async function run() {
    const campaignTag = `autoservisy_sk_batch_${new Date().toISOString().split('T')[0]}`;
    console.log(`Starting bulk enrichment for tag: ${campaignTag}`);

    // Basic list for now, we can expand it
    const leads = [
        { name: "S-Autoservis", website: "https://www.s-autoservis.sk/" },
        { name: "AUTOCENTRUM Petržalka s.r.o.", website: "http://autocentrumpetrzalka.sk/" },
        { name: "MM autocentrum, s.r.o.", website: "http://www.mmautocentrum.sk/" },
        { name: "Homola", website: "https://homola.sk/" },
        { name: "Tvojautoservis", website: "https://tvojautoservis.sk/" },
        { name: "PneuPlus", website: "https://www.pneuplus.sk/" },
        { name: "Mikona", website: "https://www.mikona.sk/" },
        { name: "BestDrive", website: "https://www.bestdrive.sk/" },
        { name: "Q-Service", website: "https://www.q-service.sk/" },
        { name: "Auto Kelly", website: "https://www.autokelly.sk/" }
    ];

    try {
        const payload = {
            leads,
            aggressive_scraping: true,
            campaign_tag: campaignTag
        };
        
        console.log(`Enriching ${leads.length} leads...`);
        const res = await handler(payload);
        
        console.log("\n--- BULK ENRICHMENT COMPLETED ---");
        console.log(`Total processed: ${res.data?.leads.length}`);
    } catch (e) {
        console.error("BULK RUN FAILED:", e);
    } finally {
        await sql.end();
    }
}
run();
