import { sql } from "../core/db";
import { env } from "../core/env";
import { createSpreadsheet, updateSheet, clearSheet } from "../tools/google/sheets.tool";
import { readFileSync, writeFileSync } from "fs";

/**
 * Priebeh:
 * 1. Vytvorí nový Google Sheet (ak nemáme GOOGLE_SHEET_ID).
 * 2. Uloží ID do .env.
 * 3. Zosynchronizuje všetkých 223 leadov.
 */

async function initSheet() {
    try {
        console.log("🚀 Spúšťam inicializáciu Google Sheets...");

        // 1. Vytvorenie Sheetu
        const title = `Lead Enrichment - Autoservisy SK (${new Date().toLocaleDateString()})`;
        const sheetId = await createSpreadsheet(title);
        console.log(`✅ Nový Google Sheet vytvorený s ID: ${sheetId}`);

        // 2. Uloženie ID do .env (fyzicky prepíšeme súbor)
        let envContent = readFileSync(".env", "utf8");
        envContent = envContent.replace(/GOOGLE_SHEET_ID=.*/, `GOOGLE_SHEET_ID=${sheetId}`);
        writeFileSync(".env", envContent);
        console.log("✅ GOOGLE_SHEET_ID bol uložený do .env");

        // 3. Získanie dát z DB
        const leads = await sql`
            SELECT verification_status, website, decision_maker_last_name, icebreaker_sentence, 
                   decision_maker_name, company_name_short, primary_email, original_name, 
                   verification_notes, campaign_tag
            FROM leads
            ORDER BY created_at DESC
        `;

        // 4. Formátovanie
        const headers = [
            "Status", "Linka", "Priebeh (Oslovenie)", "Pochvala (Icebreaker)", 
            "Meno (Full)", "Doména-Skratka", "Email", "Pôvodný Názov", 
            "Poznámka AI", "Kampaň-Tag"
        ];
        
        const rows = leads.map(l => [
            l.verification_status,
            l.website,
            l.decision_maker_last_name || "",
            l.icebreaker_sentence || "",
            l.decision_maker_name || "",
            l.company_name_short || "",
            l.primary_email || "",
            l.original_name || "",
            l.verification_notes || "",
            l.campaign_tag || ""
        ]);

        const allData = [headers, ...rows];

        // 5. Nahranie dát
        await updateSheet(sheetId, "Sheet1!A1", allData);
        
        console.log("\n------------------------------------------------");
        console.log(`🎉 HOTOVO! Synchronizovaných ${leads.length} leadov.`);
        console.log(`URL: https://docs.google.com/spreadsheets/d/${sheetId}`);
        console.log("------------------------------------------------\n");

    } catch (e: any) {
        console.error("❌ Chyba pri inicializácii:", e.message);
    } finally {
        await sql.end();
    }
}

initSheet();
