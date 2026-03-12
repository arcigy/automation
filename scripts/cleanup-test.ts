import axios from "axios";
import { env } from "../core/env";
import { sql } from "../core/db";

async function cleanup() {
  const apiKey = env.SMARTLEAD_API_KEY.trim();
  const baseUrl = "https://server.smartlead.ai/api/v1";

  console.log("🧹 Čistím testovacie kampane...");

  try {
    // 1. Získať zoznam kampaní
    const res = await axios.get(`${baseUrl}/campaigns`, { params: { api_key: apiKey } });
    const campaigns = res.data || [];

    // 2. Nájsť testovacie kampane (obsahujú "realitky-test")
    const toDelete = campaigns.filter((c: any) => c.name.toLowerCase().includes("realitky-test"));
    
    console.log(`🗑️ Nájdených ${toDelete.length} kampaní na vymazanie.`);

    for (const c of toDelete) {
      console.log(`  - Mažem kampaň "${c.name}" (ID: ${c.id})...`);
      await axios.delete(`${baseUrl}/campaigns/${c.id}`, { params: { api_key: apiKey } });
    }

    // 3. Zmazať testovacie niches z DB
    console.log("🗄️ Mažem testovacie niches z databázy...");
    await sql`DELETE FROM niches WHERE slug LIKE 'realitky-test-%'`;

    console.log("✅ Cleanup hotovo.");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Chyba pri cleanup-e:", err.response?.data || err.message);
    process.exit(1);
  }
}

cleanup();
