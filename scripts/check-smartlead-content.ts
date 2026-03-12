import axios from "axios";
import { env } from "../core/env";

async function checkContent() {
    const key = (env.SMARTLEAD_API_KEY || "").trim();
    const url = "https://app.smartlead.ai/api/v1/campaigns";
    
    console.log(`📡 Sťahujem reálne dáta z: ${url}`);
    try {
        const res = await axios.get(url, { params: { api_key: key } });
        console.log(`✅ OK. Typ dát: ${typeof res.data}`);
        
        if (Array.isArray(res.data)) {
            console.log(`📊 Nájdených ${res.data.length} záznamov.`);
            console.log("📝 Prvých 5 názvov kampaní:");
            res.data.slice(0, 5).forEach((c: any) => console.log(` - ${c.name || 'BEZ NAZVU'} (ID: ${c.id})`));
        } else {
            console.log("⚠️ Dáta nie sú pole. Ukážka:");
            console.log(JSON.stringify(res.data).substring(0, 500));
        }
    } catch (e: any) {
        console.log(`❌ CHYBA: ${e.response?.status} ${JSON.stringify(e.response?.data).substring(0, 200)}`);
    }
}

checkContent();
