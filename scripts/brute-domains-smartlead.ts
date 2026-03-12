import axios from "axios";
import { env } from "../core/env";
import * as fs from "fs";

async function bruteForceDomains() {
    const key = (process.env.SMARTLEAD_API_KEY || "").trim();
    
    let report = `🚀 Skúšam rôzne domény pre Smartlead API\n`;

    const domains = [
        "https://server.smartlead.ai/api/v1",
        "https://api.smartlead.ai/api/v1",
        "https://app.smartlead.ai/api/v1",
        "https://server.smartlead.ai/v1",
        "https://api.smartlead.ai/v1"
    ];

    for (const dom of domains) {
        const url = `${dom}/campaigns`;
        report += `\n📡 Skúšam: ${url}\n`;
        try {
            const res = await axios.get(url, { params: { api_key: key } });
            report += `✅ ÚSPECH na ${url}! Počet: ${res.data.length}\n`;
        } catch (e: any) {
            report += `❌ ZLYHALO: ${e.response?.status} ${JSON.stringify(e.response?.data || e.message).substring(0, 100)}\n`;
        }
    }
    
    fs.writeFileSync("brute-domain-report.txt", report);
    console.log("✅ Report v 'brute-domain-report.txt'");
}

bruteForceDomains();
