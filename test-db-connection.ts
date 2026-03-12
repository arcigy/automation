import { sql } from "./core/db";

async function test() {
    try {
        const res = await sql`SELECT 1 as connected`;
        console.log("Database connection successful:", res);
    } catch (e) {
        console.error("Database connection failed:", e);
    } finally {
        await sql.end();
    }
}
test();
