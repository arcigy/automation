import { handler } from "./automations/lead-enricher/handler";

async function run() {
    try {
        const payload = {
            leads: [
                {
                    name: "Š – AUTOSERVIS Bardejov, s.r.o.",
                    website: "https://www.s-autoservis.sk/"
                }
            ],
            aggressive_scraping: true
        };
        
        const res = await handler(payload);
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("FAILED:", e);
    }
}
run();
