import { sql } from "../core/db";

async function fixNames() {
    await sql`
        UPDATE leads 
        SET decision_maker_name = REPLACE(REPLACE(REPLACE(decision_maker_name, ' P.O. Hviezdoslava', ''), ' J. Murgaša', ''), ' Ílová', '') 
        WHERE website IN ('https://topautoservis.sk/', 'https://www.autoservis-cam.sk/', 'https://www.biga.sk/autoservis/')
    `;
    console.log("Fixed names.");
    process.exit(0);
}
fixNames().catch(console.error);
