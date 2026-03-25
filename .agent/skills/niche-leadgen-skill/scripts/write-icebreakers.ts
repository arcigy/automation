#!/usr/bin/env bun
/**
 * scripts/write-icebreakers.ts
 * Zapíše AI-vygenerované icebreakery (od Claudea) späť do DB.
 * Vstup = JSON súbor kde Claude vyplnil icebreakery cez prep-for-ai.ts workflow.
 *
 * Použitie:
 *   bun scripts/write-icebreakers.ts --input ./icebreakers-stavebniny.json
 *
 * Formát vstupného JSON:
 *   [{ "id": "lead-uuid", "icebreaker": "Zaujalo ma, že..." }, ...]
 */

import { getConfig } from "../config";
import postgres from "postgres";
import { parseArgs } from "util";
import { readFileSync } from "fs";

const { values: args } = parseArgs({
  args: (typeof Bun !== "undefined" ? Bun.argv : process.argv).slice(2),
  options: {
    input: { type: "string" },
  },
  strict: false,
});

if (!args.input) {
  console.error("❌ Chýba --input parameter. Príklad: --input ./icebreakers.json");
  process.exit(1);
}

async function main() {
  const cfg = getConfig();
  const sql = postgres(cfg.DATABASE_URL);

  // ─── Načítaj JSON ──────────────────────────────────────────────────────────
  let data: Array<{ id: string; icebreaker: string }>;
  try {
    const raw = readFileSync(args.input as string, "utf-8");
    data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("JSON musí byť pole objektov");
  } catch (e: any) {
    console.error(`❌ Načítanie JSON zlyhalo: ${e.message}`);
    process.exit(1);
  }

  const valid = data.filter(d => d.id && d.icebreaker && d.icebreaker.trim() !== "" && !d.icebreaker.includes("DOPLŇ SEM"));
  const skipped = data.length - valid.length;

  if (valid.length === 0) {
    console.log("⚠️  Žiadne validné icebreakery v súbore.");
    await sql.end(); return;
  }

  // ─── Zápis do DB ──────────────────────────────────────────────────────────
  let ok = 0;
  for (const item of valid) {
    try {
      const result = await sql`
        UPDATE leads
        SET icebreaker_sentence = ${item.icebreaker.trim()}, updated_at = now()
        WHERE id = ${item.id}
        RETURNING id
      `;
      if (result.length > 0) { ok++; console.log(`  ✅ ${item.id.slice(0, 8)}... — "${item.icebreaker.slice(0, 60)}..."`); }
      else { console.log(`  ⚠️  ID nenájdené: ${item.id}`); }
    } catch (e: any) {
      console.error(`  ❌ ${item.id}: ${e.message}`);
    }
  }

  console.log(`\n📊 Výsledok: ${ok}/${data.length} icebreakerov zapísaných | ${skipped} preskočených (nevyplnené)`);
  if (ok > 0) console.log(`✅ DB aktualizovaná. Leady sú pripravené na inject.`);

  await sql.end();
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
