import axios from "axios";
import { env } from "../core/env";

async function bruteMissingChar() {
    const raw = (env.SMARTLEAD_API_KEY || "").trim();
    if (!raw.includes('_')) {
        console.log("❌ Kľúč nemá očakávaný formát s '_'");
        return;
    }

    const [uuidPart, suffix] = raw.split('_');
    const hexChars = "0123456789abcdef";
    const url = "https://server.smartlead.ai/api/v1/campaigns";

    console.log(`🕵️ Brute-force: Skúšam doplniť chýbajúci znak do UUID časti...`);

    for (const char of hexChars) {
        const testKey = `${uuidPart}${char}_${suffix}`;
        try {
            const res = await axios.get(url, { params: { api_key: testKey } });
            console.log(`✅ NAŠIEL SOM TO! Správny kľúč končí na "...${char}_${suffix}"`);
            console.log(`Počet kampaní: ${res.data.length}`);
            return;
        } catch (e) {
            // console.log(` - ${char} nefunguje`);
        }
    }

    // Skúsme ešte doplniť pred podčiarkovník (ak chýba tam)
    console.log("🕵️ Skúšam doplniť znak na koniec celého kľúča...");
    for (const char of hexChars) {
        const testKey = `${raw}${char}`;
        try {
            const res = await axios.get(url, { params: { api_key: testKey } });
            console.log(`✅ NAŠIEL SOM TO! Správny kľúč končí na "...${char}"`);
            return;
        } catch (e) {}
    }

    console.log("❌ Ani jedna varianta nefungovala. Skontroluj prosím kľúč vizuálne v Smartleade, či ti fakt nechýba nejaké písmenko na konci.");
}

bruteMissingChar();
