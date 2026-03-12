import { sql } from "../core/db";
import { env } from "../core/env";
import { clearSheet, updateSheet } from "../tools/google/sheets.tool";

/**
 * Pusti tento script pre kompletnú synchronizáciu DB -> Google Sheets.
 * Všetky leady sa nahrajú do Tabuľky.
 */

export async function syncLeadsToGoogleSheets() {
    if (!env.GOOGLE_SHEET_ID) {
        console.error("❌ GOOGLE_SHEET_ID nie je v .env.");
        return;
    }

    try {
        console.log("🚀 Synchronizujem DB -> Google Sheets...");

        const leads = await sql`
            SELECT original_name, website, company_name_short, decision_maker_name, decision_maker_last_name, 
                   primary_email, icebreaker_sentence, ico, official_company_name, 
                   address, stakeholders,
                   verification_status, verification_notes, campaign_tag
            FROM leads
            ORDER BY created_at DESC
        `;

        if (leads.length === 0) {
            console.log("Databáza je prázdna.");
            return;
        }

        const headers = [
            "Status", "Web", "Oficiálny Názov", "IČO", "Adresa", 
            "Meno (Decision Maker)", "Priezvisko/Oslovenie", "Konatelia/Spoločníci",
            "Email", "Icebreaker", "Pôvodný Názov", "Poznámka", "Kampaň"
        ];
        
        const rows = leads.map(l => {
            const stakeholders = (l.stakeholders as any) || {};
            const execs = stakeholders.executives || [];
            const partners = stakeholders.partners || [];
            const allStakeholders = [...new Set([...execs, ...partners])].join(", ");

            // Ak nemáme meno decision makera, skúsime vziať prvého konateľa
            let dmName = l.decision_maker_name || "";
            if (!dmName && execs.length > 0) dmName = execs[0];

            return [
                l.verification_status,
                l.website,
                l.official_company_name || "",
                l.ico || "",
                l.address || "",
                dmName,
                l.decision_maker_last_name || "",
                allStakeholders,
                l.primary_email || "",
                l.icebreaker_sentence || "",
                l.original_name || "",
                l.verification_notes || "",
                l.campaign_tag || ""
            ];
        });

        const allData = [headers, ...rows];
        const sheetName = "Sheet1";
        
        // Prepíšeme A1:M1000 (pre istotu širší range)
        await clearSheet(env.GOOGLE_SHEET_ID, `${sheetName}!A1:M1000`);
        await updateSheet(env.GOOGLE_SHEET_ID, `${sheetName}!A1`, allData);

        console.log(`✅ Synchronizovaných ${leads.length} leadov.`);
    } catch (e) {
        console.error("❌ Synchronizácia zlyhala:", e);
    }
}

// Ak sa spúšťa priamo ako script
if (require.main === module) {
    syncLeadsToGoogleSheets().then(() => sql.end());
}

