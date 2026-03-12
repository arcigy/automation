import axios from "axios";
import { env } from "../core/env";
import * as fs from "fs";

async function bruteForceAuth() {
    const key = (process.env.SMARTLEAD_API_KEY || "").trim();
    const url = "https://server.smartlead.ai/api/v1/campaigns";
    
    let report = `🚀 Skúšam všetky spôsoby autorizácie pre kľúč: ${key}\n`;

    const tests = [
        { name: "Query Param (api_key)", config: { params: { api_key: key } } },
        { name: "Query Param (apiKey)", config: { params: { apiKey: key } } },
        { name: "Header (x-api-key)", config: { headers: { "x-api-key": key } } },
        { name: "Header (Authorization Bearer)", config: { headers: { "Authorization": `Bearer ${key}` } } },
    ];

    for (const test of tests) {
        try {
            const res = await axios.get(url, test.config);
            report += `✅ ÚSPECH: Metóda "${test.name}" FUNGUJE! Počet: ${res.data.length}\n`;
        } catch (e: any) {
            report += `❌ ZLYHALO: "${test.name}" -> ${e.response?.status} ${JSON.stringify(e.response?.data || e.message)}\n`;
        }
    }
    
    fs.writeFileSync("brute-auth-report.txt", report);
    console.log("✅ Report v 'brute-auth-report.txt'");
}

bruteForceAuth();
