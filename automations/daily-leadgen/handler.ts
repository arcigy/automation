import { sql } from "../../core/db";
import { getActiveNiche, logNicheStats } from "../niche-manager/handler";
import { handler as discoveryHandler } from "../lead-discovery/handler";
import { handler as enrichmentHandler } from "../lead-enricher/handler";
import { injectToSmartlead } from "../smartlead-injector/handler";
import type { AutomationResult } from "../../core/types";
import { randomUUID } from "crypto";
import { logRun } from "../../core/logger";

export async function handler(rawInput: unknown): Promise<AutomationResult<any>> {
  const ctx = {
    automationName: "daily-leadgen",
    runId: randomUUID(),
    startTime: Date.now(),
  };

  try {
    // 1. Vyber aktívny niche a región
    const niche = await getActiveNiche();
    if (!niche) {
      throw new Error("Žiadny aktívny niche nenájdený v databáze.");
    }

    console.log(`🚀 SPUŠTÁM DENNÝ LEAD GEN PRE: ${niche.name} (${niche.activeRegion})`);

    // 2. Discovery — nájdi kandidátov (~195 pre rezervu)
    const discoveryRes = await discoveryHandler({
      niche_slug: niche.slug,
      keywords: niche.keywords,
      region: niche.activeRegion,
      target_count: 195
    });

    if (!discoveryRes.success || !discoveryRes.data) {
      throw new Error(`Discovery zlyhalo: ${discoveryRes.error}`);
    }

    const rawLeads = discoveryRes.data.leads;
    if (rawLeads.length === 0) {
      console.log("⚠️ Žiadne nové firmy nenájdené. Končím.");
      return { success: true, data: { status: "no_new_leads" }, durationMs: Date.now() - ctx.startTime };
    }

    await logNicheStats(niche.id, { discovered: rawLeads.length });

    // 3. Enrichment — obohať každého (toto trvá najdlhšie)
    console.log(`⚙️ Obohacujem ${rawLeads.length} leadov...`);
    const enrichmentRes = await enrichmentHandler({
      leads: rawLeads.map(l => ({ name: l.name, website: l.website })),
      aggressive_scraping: true,
      campaign_tag: `auto_${niche.slug}`
    });

    if (!enrichmentRes.success || !enrichmentRes.data) {
      throw new Error(`Enrichment zlyhalo: ${enrichmentRes.error}`);
    }

    const enrichedLeads = enrichmentRes.data.leads || [];
    await logNicheStats(niche.id, { enriched: enrichedLeads.length });

    // 4. Update niche_id for ALL found leads (so they show up in Slack report if stuck)
    const allWebsites = enrichedLeads.map(l => l.website).filter(Boolean);
    if (allWebsites.length > 0) {
      await sql`
        UPDATE leads 
        SET niche_id = ${niche.id}
        WHERE website = ANY(${sql.array(allWebsites)})
        AND niche_id IS NULL
      `;
    }

    // 5. Quality Filter — email + (meno ALEBO phone)
    console.log("⚖️ Filtrujem kvalifikované leady...");
    const qualified = enrichedLeads.filter(l => {
      const hasEmail = !!l.email;
      const hasMeno = !!l.decision_maker_name;
      // Phone môžeme mať z Discovery (Google Maps) ak ho Enrichment nenašiel
      const originalLead = rawLeads.find(rl => rl.website === l.website);
      const phone = (l as any).phone || originalLead?.phone;
      const hasPhone = !!phone;

      // Update phone v objekte pre injector
      if (phone) (l as any).phone = phone;

      return hasEmail && (hasMeno || hasPhone);
    });

    console.log(`✅ Kvalifikovaných: ${qualified.length} / ${enrichedLeads.length}`);
    await logNicheStats(niche.id, { qualified: qualified.length });

    // Ostrihaj na daily target (zvyčajne 130)
    const toInject = qualified.slice(0, niche.daily_target);
    
    // 5. Smartlead Injector
    let sentCount = 0;
    if (toInject.length > 0) {
      const injectRes = await injectToSmartlead(toInject, niche);
      sentCount = injectRes.sent;
    }

    // 6. Update last_worked_at & Check for "Squeezed" (90% exhausted) logic
    await sql`UPDATE niches SET last_worked_at = NOW() WHERE id = ${niche.id}`;
    
    // Ak sme našli menej ako 10% cieľa a prešli sme už všetky regióny (current_region_index sa v manageri inkrementuje pred týmto),
    // pravdepodobne je niche vyčerpaný.
    const finalCheck = await sql`SELECT current_region_index, regions FROM niches WHERE id = ${niche.id}`;
    if (rawLeads.length < (niche.daily_target * 0.1) && finalCheck[0].current_region_index >= finalCheck[0].regions.length) {
      await sql`UPDATE niches SET status = 'completed' WHERE id = ${niche.id}`;
      console.log(`🏁 NICHE EXHAUSTED: "${niche.name}" bol označený ako dokončený.`);
    }

    const result = {
      success: true,
      data: {
        niche: niche.slug,
        region: niche.activeRegion,
        total_discovered: rawLeads.length,
        qualified: qualified.length,
        sent: sentCount
      },
      durationMs: Date.now() - ctx.startTime
    };

    await logRun(ctx, result, {});
    return result;

  } catch (error: any) {
    const result = {
      success: false,
      error: error.message,
      durationMs: Date.now() - ctx.startTime
    };
    await logRun(ctx, result, {});
    throw error;
  }
}
