import { handler } from "../automations/lead-discovery/handler";

async function run() {
    console.log("🚀 STARTING BULK DISCOVERY OF 300 AUTOSERVICES IN SLOVAKIA");
    
    const cities = [
        "Bratislava", "Košice", "Prešov", "Žilina", "Nitra", "Banská Bystrica", "Trnava", "Martin", "Trenčín", "Poprad",
        "Prievidza", "Zvolen", "Považská Bystrica", "Michalovce", "Nové Zámky", "Spišská Nová Ves", "Komárno", "Levice", "Humenné", "Bardejov",
        "Liptovský Mikuláš", "Piešťany", "Ružomberok", "Topoľčany", "Lučenec", "Čadca", "Dubnica nad Váhom", "Rimavská Sobota", "Partizánske", "Šaľa",
        "Dunajská Streda", "Trebisov", "Vranov nad Topľou", "Púchov", "Brezno", "Snina", "Rožňava", "Senica", "Pezinok", "Bánovce nad Bebravou"
    ];

    const queries = cities.map(city => `autoservis ${city}`);
    const campaignTag = `autoservisy_sk_FULL_300_${new Date().toISOString().split('T')[0]}`;

    const payload = {
        query: queries,
        num_leads: 300,
        campaign_tag: campaignTag
    };

    try {
        const result = await handler(payload);
        if (result.success) {
            console.log("\n✅ BULK DISCOVERY COMPLETED");
            console.log(`Total Leads Discovered & Processed: ${result.data?.total_found}`);
            console.log(`Campaign Tag: ${campaignTag}`);
        } else {
            console.error("❌ FAILED:", result.error);
        }
    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
}

run();
