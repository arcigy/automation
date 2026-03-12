import { sql } from "../core/db";
import { writeFileSync } from "fs";

async function exportCSV() {
    try {
        // Vyberieme všetky flagged leady
        const leads = await sql`
            SELECT id, website, original_name, company_name_short, decision_maker_name, decision_maker_last_name, icebreaker_sentence, verification_notes
            FROM leads 
            WHERE verification_status = 'flagged'
            ORDER BY created_at DESC
        `;

        if (leads.length === 0) {
            console.log("Žiadne leady so statusom 'flagged' sa v databáze nenachádzajú.");
            return;
        }

        // Hlavičky pre CSV
        const headers = ["ID", "Webová stránka", "Pôvodný názov firmy", "Skrátený názov", "Meno Decision Makera", "Priezvisko/Oslovenie (variable)", "AI Pochvala (Icebreaker)", "Poznámka pre kontrolu"];
        
        // Formátovanie riadkov (ošetrenie úvodzoviek pre CSV)
        const rows = leads.map(l => [
            l.id,
            l.website,
            `"${(l.original_name || "").replace(/"/g, '""')}"`,
            `"${(l.company_name_short || "").replace(/"/g, '""')}"`,
            `"${(l.decision_maker_name || "").replace(/"/g, '""')}"`,
            `"${(l.decision_maker_last_name || "").replace(/"/g, '""')}"`,
            `"${(l.icebreaker_sentence || "").replace(/"/g, '""')}"`,
            `"${(l.verification_notes || "").replace(/"/g, '""')}"`
        ]);

        // Spojenie do jedného stringu (pridávame \ufeff pre správne kódovanie v Exceli/Sheets)
        const csvContent = "\ufeff" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        
        const fileName = "flagged_leads_na_kontrolu.csv";
        writeFileSync(fileName, csvContent);
        
        console.log("\n------------------------------------------------");
        console.log(`✅ EXPORT HOTOVÝ: ${leads.length} leadov pripravených na kontrolu.`);
        console.log(`Súbor: ${fileName}`);
        console.log("------------------------------------------------");
        console.log("NÁVOD:");
        console.log("1. Otvor si nový Google Sheet.");
        console.log("2. Choď na Súbor -> Importovať -> Nahrať.");
        console.log(`3. Vyber súbor '${fileName}'.`);
        console.log("4. Teraz môžeš všetky riadky skontrolovať narazočami.");
        console.log("------------------------------------------------\n");

    } catch (error) {
        console.error("Chyba pri exporte:", error);
    } finally {
        await sql.end();
    }
}

exportCSV();
