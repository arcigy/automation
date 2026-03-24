#!/usr/bin/env bun
/**
 * scripts/prep-for-ai.ts
 * Exportuje scrapnuté leady do súboru, ktorý Claude Code prečíta a doplní icebreakery.
 * Toto nahrádza volanie Anthropic API — Claude Code generuje obsah SAM.
 *
 * WORKFLOW:
 *   1. bun scripts/prep-for-ai.ts --niche stavebniny --output ./ai-work.md
 *   2. Claude prečíta ai-work.md a vygeneruje icebreakery
 *   3. bun scripts/write-icebreakers.ts --input ./icebreakers.json
 *
 * Použitie:
 *   bun scripts/prep-for-ai.ts --niche "stavebniny"
 *   bun scripts/prep-for-ai.ts --niche "stavebniny" --limit 30 --output ./ai-work.md
 */

import { getConfig } from "../config";
import postgres from "postgres";
import { parseArgs } from "util";
import { writeFileSync } from "fs";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    niche:   { type: "string" },
    limit:   { type: "string", default: "50" },
    output:  { type: "string" },
  },
  strict: false,
});

if (!args.niche) {
  console.error("❌ Chýba --niche parameter."); process.exit(1);
}

async function main() {
  const cfg = getConfig();
  const sql = postgres(cfg.DATABASE_URL);
  const limit = parseInt(args.limit as string, 10);
  const niche = args.niche as string;
  const outPath = (args.output as string) ?? `./ai-work-${niche}.md`;

  // Načítaj leady bez icebreaker-u
  const leads = await sql<Array<{
    id: string; website: string; original_name: string | null;
    company_name_short: string | null; official_company_name: string | null;
    business_facts: unknown; decision_maker_name: string | null;
  }>>`
    SELECT id, website, original_name, company_name_short, official_company_name,
           business_facts, decision_maker_name
    FROM leads
    WHERE campaign_tag = ${niche}
      AND primary_email IS NOT NULL
      AND (icebreaker_sentence IS NULL OR icebreaker_sentence = '')
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  if (leads.length === 0) {
    console.log("✅ Žiadne leady bez icebreakeru. Všetko hotovo.");
    await sql.end(); return;
  }

  // ─── Výstupný Markdown pre Claudea ──────────────────────────────────────
  const lines: string[] = [
    `# AI Icebreaker Task — Niche: ${niche}`,
    "",
    "Claude, tvoja úloha je vyplniť pole `icebreaker` pre každú firmu nižšie.",
    "",
    "## Pravidlá pre icebreaker",
    "- Max 1–2 vety, slovenčina, neformálny ale profesionálny tón",
    "- Musí byť KONKRÉTNA o tejto firme (nie generická)",
    "- Začína s 'Zaujalo ma, že...' alebo podobne",
    "- Nesmie obsahovať slová 'synergiu', 'inovatívne', 'efektívne'",
    "- Vychádza z faktov nižšie (web, meno, business facts)",
    "",
    "## Výstup",
    "Po vygenerovaní uložíš pole do JSON súboru a zavoláš:",
    "```bash",
    `bun scripts/write-icebreakers.ts --input ./icebreakers-${niche}.json`,
    "```",
    "",
    "## Formát icebreakers JSON",
    "```json",
    "[",
    '  { "id": "uuid-tu", "icebreaker": "Zaujalo ma, že..." },',
    '  { "id": "uuid-tu", "icebreaker": "..." }',
    "]",
    "```",
    "",
    "---",
    "",
    `## Firmy na spracovanie (${leads.length})`,
    "",
  ];

  for (const lead of leads) {
    const facts = Array.isArray(lead.business_facts) ? (lead.business_facts as string[]).join("; ") : String(lead.business_facts ?? "");
    lines.push(`### Firma: ${lead.original_name ?? lead.company_name_short ?? lead.website}`);
    lines.push(`- **ID**: ${lead.id}`);
    lines.push(`- **Web**: ${lead.website}`);
    if (lead.official_company_name) lines.push(`- **Officiálny názov**: ${lead.official_company_name}`);
    if (lead.decision_maker_name) lines.push(`- **Decision maker**: ${lead.decision_maker_name}`);
    if (facts) lines.push(`- **Business fakty**: ${facts}`);
    lines.push(`- **Icebreaker**: _(DOPLŇ SEM)_`);
    lines.push("");
  }

  writeFileSync(outPath, lines.join("\n"), "utf-8");

  console.log(`✅ Súbor pripravený: ${outPath}`);
  console.log(`   ${leads.length} leadov čaká na icebreaker`);
  console.log(`\n🤖 Claude, prečítaj ${outPath}, vygeneruj icebreakery a zavolaj:`);
  console.log(`   bun scripts/write-icebreakers.ts --input ./icebreakers-${niche}.json\n`);

  await sql.end();
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
