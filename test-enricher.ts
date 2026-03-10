import { handler } from "./automations/lead-enricher/handler";
import * as fs from "fs";

async function run() {
    try {
        const payload = JSON.parse(fs.readFileSync("automations/lead-enricher/payload.json", "utf8"));
        console.log(`Loaded ${payload.leads.length} leads.`);
        // Let's just process the first 2 leads to test it quickly
        payload.leads = payload.leads.slice(0, 2);
        
        console.log("Starting enricher...");
        const res = await handler(payload);
        fs.writeFileSync("out_enrich.json", JSON.stringify(res, null, 2));
        console.log("DONE! Saved to out_enrich.json");
    } catch (e) {
        console.error("FAILED:", e);
    }
}
run();
