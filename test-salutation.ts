import { handler } from "./automations/lead-enricher/handler";

async function run() {
    console.log("Testing pán/pani salutation...");
    try {
        const payload = {
            leads: [
                { name: "S-Autoservis", website: "https://www.s-autoservis.sk/o-nas/historia-spolocnosti/" }
            ],
            aggressive_scraping: true
        };
        
        const res = await handler(payload);
        const lead = res.data?.leads[0];
        console.log("\n--- RESULT ---");
        console.log(`Priezvisko variable: '${lead?.decision_maker_last_name}'`);
        console.log(`Email test: Dobrý deň${lead?.decision_maker_last_name},`);
    } catch (e) {
        console.error("FAILED:", e);
    }
}
run();
