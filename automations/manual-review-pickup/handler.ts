import { sql } from "../../core/db";
import { injectToSmartlead } from "../smartlead-injector/handler";
import { logNicheStats } from "../niche-manager/handler";
import type { AutomationResult } from "../../core/types";
import { randomUUID } from "crypto";
import { logRun } from "../../core/logger";

export async function handler(): Promise<AutomationResult<any>> {
  const ctx = {
    automationName: "manual-review-pickup",
    runId: randomUUID(),
    startTime: Date.now(),
  };

  try {
    // 1. Získať leady ktoré boli ručne opravené
    const manualLeads = await sql`
      SELECT l.*, n.slug as niche_slug, n.name as niche_name, n.id as niche_id
      FROM leads l
      JOIN niches n ON l.niche_id = n.id
      WHERE l.manually_reviewed = true
      AND l.sent_to_smartlead = false
    `;

    if (manualLeads.length === 0) {
      console.log("✅ Žiadne manuálne opravené leady na pickup.");
      return { success: true, data: { status: "no_manual_leads" }, durationMs: Date.now() - ctx.startTime };
    }

    console.log(`📦 Našiel som ${manualLeads.length} manuálne opravených leadov. Overujem kvalitu...`);

    // 2. Quality Filter (znova pre istotu)
    const qualified = manualLeads.filter(l => {
      return !!l.email && (!!l.decision_maker_name || !!l.phone);
    });

    if (qualified.length === 0) {
      console.log("⚠️ Žiadny z opravených leadov stále nespĺňa podmienky (email + meno/phone).");
      return { success: true, data: { status: "none_qualified" }, durationMs: Date.now() - ctx.startTime };
    }

    // 3. Rozdelíme podľa niches (pre injector)
    const nichesMap = new Map<string, any[]>();
    qualified.forEach(l => {
      const nicheKey = l.niche_id;
      if (!nichesMap.has(nicheKey)) nichesMap.set(nicheKey, []);
      nichesMap.get(nicheKey)!.push(l);
    });

    let totalSent = 0;

    // 4. Inject
    for (const [nicheId, leads] of nichesMap.entries()) {
      const first = leads[0];
      const niche = { id: nicheId, slug: first.niche_slug, name: first.niche_name };
      
      const injectRes = await injectToSmartlead(leads as any, niche);
      totalSent += injectRes.sent;
    }

    const result = { success: true, data: { sent: totalSent }, durationMs: Date.now() - ctx.startTime };
    await logRun(ctx, result, {});
    return result;

  } catch (error: any) {
    const result = { success: false, error: error.message, durationMs: Date.now() - ctx.startTime };
    await logRun(ctx, result, {});
    throw error;
  }
}
