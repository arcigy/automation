import axios from "axios";
import { env } from "../core/env";
import * as fs from "fs";

async function diagnostic() {
    const rawKey = (process.env.SMARTLEAD_API_KEY || "").trim();
    let report = `🔍 Diagnostika kľúča (dĺžka: ${rawKey.length})\n`;
    report += `🔹 Hex dump: ${Buffer.from(rawKey).toString('hex')}\n`;

    const urls = [
        "https://server.smartlead.ai/api/v1/campaigns",
        "https://api.smartlead.ai/v1/campaigns"
    ];

    for (const url of urls) {
        report += `\n📡 Skúšam URL: ${url}\n`;
        try {
            const res = await axios.get(url, { params: { api_key: rawKey } });
            report += `✅ ÚSPECH na ${url}! Počet kampaní: ${res.data.length}\n`;
        } catch (e: any) {
            report += `❌ CHYBA na ${url}: ${e.response?.status} - ${JSON.stringify(e.response?.data)}\n`;
        }
    }
    
    // Skúsime aj Header (pre istotu)
    report += `\n📡 Skúšam URL s Headerom: https://server.smartlead.ai/api/v1/campaigns\n`;
    try {
        const res = await axios.get("https://server.smartlead.ai/api/v1/campaigns", { 
            headers: { "Authorization": `Bearer ${rawKey}` } 
        });
        report += `✅ ÚSPECH cez Header!\n`;
    } catch (e: any) {
        report += `❌ CHYBA cez Header: ${e.response?.status} - ${JSON.stringify(e.response?.data)}\n`;
    }

    fs.writeFileSync("smartlead-diagnostic-report.txt", report);
    console.log("✅ Report vygenerovaný do 'smartlead-diagnostic-report.txt'");
}

diagnostic();
