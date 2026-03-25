#!/usr/bin/env bun
/**
 * scripts/inject.ts
 * Inject enrichnutých leadov do Smartlead. Automaticky validuje skóre pred uploadom.
 *
 * Použitie:
 *   bun scripts/inject.ts --niche "stavebniny"
 *   bun scripts/inject.ts --niche "stavebniny" --min-score 70
 *   bun scripts/inject.ts --niche "stavebniny" --create-campaign --use-ai-sequences
 *   bun scripts/inject.ts --niche "stavebniny" --campaign-id 12345 --dry-run
 */

import { getConfig } from "../config";
import postgres from "postgres";
import { parseArgs } from "util";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync } from "fs";

const { values: args } = parseArgs({
  args: (typeof Bun !== "undefined" ? Bun.argv : process.argv).slice(2),
  options: {
    niche:              { type: "string" },
    "min-score":        { type: "string", default: "0" },
    "campaign-id":      { type: "string" },
    "create-campaign":  { type: "boolean", default: false },
    "use-ai-sequences": { type: "boolean", default: true },
    "sequences-file":   { type: "string" },   // Claude-generated sequences JSON file
    "dry-run":          { type: "boolean", default: false },
    verbose:            { type: "boolean", default: false },
    quiet:              { type: "boolean", default: false },
    force:              { type: "boolean", default: false },
  },
  strict: false,
});


if (!args.niche) {
  console.error("❌ Chýba --niche parameter."); process.exit(1);
}

type LogLevel = "info" | "ok" | "warn" | "err" | "skip" | "data";
function log(level: LogLevel, msg: string) {
  if (args.quiet && level !== "err" && level !== "data") return;
  const icons: Record<LogLevel, string> = { info: "🔍", ok: "✅", warn: "⚠️ ", err: "❌", skip: "⏭️ ", data: "📊" };
  console.log(`${icons[level]} ${msg}`);
}

// ─── Scoring (zrkadlí validate.ts) ───────────────────────────────────────────
function scoreLead(lead: { primary_email?: string | null; website?: string | null; decision_maker_name?: string | null; verification_status?: string | null; icebreaker_sentence?: string | null }): number {
  let score = 0;
  if (lead.primary_email) {
    score += /^(info|kontakt|office|admin|mail|hello)@/i.test(lead.primary_email) ? -20 : 30;
  } else { score -= 10; }
  if (lead.website) { score += 20; if (lead.website.includes(".sk")) score += 10; }
  if (lead.decision_maker_name) score += 25;
  if (lead.verification_status === "verified") score += 15;
  else if (lead.verification_status === "flagged") score -= 15;
  else if (lead.verification_status === "failed") score -= 30;
  if (lead.icebreaker_sentence) score += 10;
  return Math.max(0, Math.min(100, score));
}

const BASE_URL = "https://server.smartlead.ai/api/v1";

async function main() {
  const cfg = getConfig();
  const sql = postgres(cfg.DATABASE_URL);
  const minScore = parseInt(args["min-score"] as string, 10);
  const isDryRun = args["dry-run"] as boolean;
  const isForce = args["force"] as boolean;
  const niche = args.niche as string;

  log("info", `[INJECT] Niche: ${niche} | MinScore: ${minScore} | DryRun: ${isDryRun} | Force: ${isForce}`);

  // ─── Načítaj leady ────────────────────────────────────────────────────────
  let whereConditions = [`campaign_tag = '${niche.replace(/'/g, "''")}'`, "primary_email IS NOT NULL"];
  if (!isForce) {
    whereConditions.push("sent_to_smartlead = false");
  }

  const leads = await sql.unsafe<Array<{
    id: string; website: string; primary_email: string | null;
    official_company_name: string | null; company_name_short: string | null;
    decision_maker_name: string | null; decision_maker_last_name: string | null;
    icebreaker_sentence: string | null; ico: string | null;
    verification_status: string | null;
  }>>(`
    SELECT id, website, primary_email, official_company_name, company_name_short,
           decision_maker_name, decision_maker_last_name, icebreaker_sentence, ico, verification_status
    FROM leads
    WHERE ${whereConditions.join(" AND ")}
  `);

  log("info", `${leads.length} leadov načítaných z DB (s emailom, neodoslaných)`);

  // ─── Filter podľa skóre ───────────────────────────────────────────────────
  const qualified = leads.filter(l => scoreLead(l) >= minScore);
  const filtered = leads.length - qualified.length;
  log("data", `Po skórovaní: ${qualified.length} prejde | ${filtered} pod prahom`);

  if (qualified.length === 0) {
    log("warn", "Žiadne leady nespĺňajú min-score. Koniec.");
    await sql.end(); return;
  }

  // ─── Získaj campaign ID ───────────────────────────────────────────────────
  let campaignId: number | null = null;

  if (args["campaign-id"]) {
    campaignId = parseInt(args["campaign-id"] as string, 10);
    log("info", `Používam existujúcu kampaň ID: ${campaignId}`);
  } else {
    // Skus nájsť existujúcu kampaň v DB
    const rows = await sql<{ smartlead_campaign_id: string | null }[]>`
      SELECT smartlead_campaign_id FROM niches WHERE slug = ${niche}
    `;
    if (rows.length > 0 && rows[0].smartlead_campaign_id) {
      campaignId = parseInt(rows[0].smartlead_campaign_id, 10);
      log("info", `Kampaň zo DB: ID ${campaignId}`);
    } else if (args["create-campaign"]) {
      // Deleguj na smartlead-create-campaign handler
      if (!isDryRun) {
        const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
        const handlerPath = pathToFileURL(join(PROJECT_ROOT, "automations", "smartlead-create-campaign", "handler.ts")).href;
        const { handler } = await import(handlerPath);
        let sequences = undefined;
        let generateAiSequences = args["use-ai-sequences"] as boolean;
        
        if (args["sequences-file"]) {
          const raw = readFileSync(args["sequences-file"] as string, "utf8");
          const parsed = JSON.parse(raw);
          // Map sequences-file format to handler's simple sequences format
          sequences = parsed.sequences.map((s: any) => ({
            subject: s.seq_variants[0].subject,
            body: s.seq_variants[0].email_body,
            delay_in_days: s.seq_delay_details.delay_in_days
          }));
          generateAiSequences = false; // Override if file provided
          log("info", `Používam sekvencie z ${args["sequences-file"]}`);
        }

        const r = await handler({
          name: `${niche.toUpperCase()}_SK`,
          generateAiSequences,
          sequences,
          nicheDescription: `Niche: ${niche} — automaticky vytvorená cez niche-leadgen-skill`,
          email_account_ids: [14382544, 14382530, 14382508, 14382300], // Slovakia verified accounts
          daily_limit: 30,
        });
        campaignId = r?.data?.campaign_id ?? null;
        if (campaignId) log("ok", `Kampaň vytvorená: ID ${campaignId}`);
        else { log("err", "Vytvorenie kampane zlyhalo."); await sql.end(); return; }
      } else {
        log("info", "[DRY-RUN] Vytvorenie kampane by sa spustilo.");
        campaignId = 99999; // fake
      }
    } else {
      log("err", "Kampaň nenájdená. Použi --campaign-id alebo --create-campaign.");
      await sql.end(); return;
    }
  }

  // ─── Upload leadov v batchoch po 50 ──────────────────────────────────────
  const BATCH_SIZE = 50;
  let uploaded = 0;

  for (let i = 0; i < qualified.length; i += BATCH_SIZE) {
    const batch = qualified.slice(i, i + BATCH_SIZE);
    const payload = batch.map(lead => {
      const firstName = (lead.decision_maker_name || "").split(/\s+/)[0] || lead.company_name_short || "";
      const lastWithSalutation = (lead.decision_maker_last_name || "").trim();
      
      // We prepend a space to the salutation for the custom field, 
      // so 'Dobrý deň{{last_name_with_salutation}},' works perfectly.
      const formattedSalutation = lastWithSalutation ? ` ${lastWithSalutation}` : "";

      return {
        email: lead.primary_email!,
        first_name: firstName,
        last_name: lastWithSalutation || "",
        company_name: lead.official_company_name || lead.company_name_short || "",
        website: lead.website,
        custom_fields: {
          personalized_intro: lead.icebreaker_sentence ?? "",
          ico: lead.ico ?? "",
          last_name_with_salutation: formattedSalutation, // Fixed: includes space only if exists
        },
      };
    });

    if (isDryRun) {
      log("info", `[DRY-RUN] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} leadov by sa odoslalo`);
      uploaded += batch.length;
      continue;
    }

    try {
      const res = await fetch(`${BASE_URL}/campaigns/${campaignId}/leads?api_key=${cfg.SMARTLEAD_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_list: payload, settings: { ignore_global_block_list: false, ignore_unsubscribe_list: false } }),
      });
      const data = await res.json() as { upload_count?: number; message?: string };

      if (res.ok) {
        const count = data.upload_count ?? batch.length;
        uploaded += count;
        log("ok", `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${count} uploadnutých`);

        // Mark as sent in DB
        const websites = batch.map(l => l.website);
        await sql`UPDATE leads SET sent_to_smartlead = true, updated_at = now() WHERE website = ANY(${websites})`;
      } else {
        log("err", `Batch ${Math.floor(i / BATCH_SIZE) + 1} zlyhalo: ${data.message ?? res.status}`);
      }
      await new Promise(r => setTimeout(r, 2500));
    } catch (e: any) {
      log("err", `Batch error: ${e.message}`);
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  log("data", `INJECT HOTOVO`);
  log("data", `  Kampaň ID  : ${campaignId}`);
  log("data", `  Uploadnutých: ${uploaded} / ${qualified.length}`);
  log("data", `  DryRun      : ${isDryRun ? "ÁNO" : "NIE"}`);
  console.log(`${"═".repeat(50)}\n`);

  await sql.end();
}

main().catch(e => {
  console.error("❌ Kritická chyba:", e.message);
  process.exit(1);
});
