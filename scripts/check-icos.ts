import { sql } from "../core/db";

async function checkIcos() {
    try {
        const [totalRes] = await sql`SELECT count(*) FROM leads`;
        const [withIcoRes] = await sql`SELECT count(*) FROM leads WHERE ico IS NOT NULL AND ico != ''`;
        const samples = await sql`SELECT id, website, ico, official_company_name FROM leads WHERE ico IS NOT NULL AND ico != '' LIMIT 10`;


        console.log("-----------------------------------------");
        console.log(`📊 Štatistika IČO v databáze:`);
        console.log(`Celkový počet kontaktov: ${totalRes.count}`);
        console.log(`Kontakty s IČO:         ${withIcoRes.count}`);
        console.log("-----------------------------------------");
        console.log("🔍 Ukážka dát:");
        samples.forEach((s: any) => {
            console.log(`- ${s.website} [IČO: ${s.ico}] -> ${s.official_company_name || '??'}`);
        });
        console.log("-----------------------------------------");
    } catch (error) {
        console.error("Chyba pri kontrole:", error);
    } finally {
        process.exit(0);
    }
}

checkIcos();
