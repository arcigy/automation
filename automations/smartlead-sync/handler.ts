import { sql } from "../../core/db";
import { fetchTool } from "../../tools/http/fetch.tool";
import { env } from "../../core/env";
import type { AutomationResult } from "../../core/types";

export async function handler(): Promise<AutomationResult<any>> {
  const BASE_URL = "https://server.smartlead.ai/api/v1";
  const KEY = `api_key=${env.SMARTLEAD_API_KEY}`;
  
  console.log("🔄 Spúšťam synchronizáciu leadov zo Smartleadu...");

  try {
    // 1. Získaj všetky kampane
    const camRes = await fetchTool({ url: `${BASE_URL}/campaigns?${KEY}` });
    const campaigns = (camRes.data as any[]) || [];

    let updatedCount = 0;

    for (const campaign of campaigns) {
      // 2. Pre každú kampaň stiahni leadov (limit 100 pre demo, v reále by sme točili offsety)
      const leadsRes = await fetchTool({ 
        url: `${BASE_URL}/campaigns/${campaign.id}/leads?${KEY}&limit=200` 
      });
      const smartLeads = (leadsRes.data as any[]) || [];

      for (const sl of smartLeads) {
        // 3. Aktualizuj našu DB podľa emailu
        const result = await sql`
          UPDATE leads
          SET 
            sent_to_smartlead = true,
            smartlead_contact_id = ${String(sl.id)},
            reply_status = ${sl.status},
            reply_sentiment = ${sl.category_name || null},
            updated_at = now()
          WHERE primary_email = ${sl.email}
          RETURNING id
        `;
        if (result.length > 0) updatedCount++;
      }
    }

    console.log(`✅ Synchronizácia hotová: ${updatedCount} leadov aktualizovaných.`);
    return { success: true, data: { updatedCount }, durationMs: 0 };

  } catch (error: any) {
    console.error("❌ Synchronizácia zlyhala:", error.message);
    return { success: false, error: error.message, durationMs: 0 };
  }
}
