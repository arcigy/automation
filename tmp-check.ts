import { sql } from './core/db';
async function t() {
    const d = await sql`SELECT website, ico, official_company_name, address FROM leads WHERE address IS NOT NULL ORDER BY updated_at DESC LIMIT 5`;
    console.dir(d);
    process.exit(0);
}
t();
