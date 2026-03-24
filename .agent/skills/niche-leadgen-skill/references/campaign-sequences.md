# Campaign Sequences — Email Šablóny

Tento súbor slúži ako základ pre AI generovanie emailových sekvencií.
Keď `inject.ts --use-ai-sequences`, Claude si berie inšpiráciu odtiaľto.

Hlavný prompt pre AI je v `prompts/smartlead-sequence-ai.md` (project root).

---

## Šablóna A — Generická (AI audit / automatizácia)

**Krok 1 (Deň 0) — Variant A:**
- Predmet: `Len taká úvaha nad {{company_name}}`
- Tón: Priamy, ľudský, konkrétny problém niche

**Krok 1 — Variant B:**
- Predmet: `Otázka k {{company_name}}`
- Tón: Curiosity-driven, kratší

**Krok 2 (Deň 3) — Followup:**
- Predmet: *(prázdny — ostáva v threade)*
- Tón: Ľahký, nekonfrontačný, "áno/nie"

---

## Premenné dostupné v emailoch

| Premenná | Hodnota |
|---|---|
| `{{company_name}}` | Názov firmy (Smartlead natívna) |
| `{{last_name_with_salutation}}` | Napr. "pán Novák" (Smartlead natívna) |
| `{{personalized_intro}}` | AI icebreaker z enrichment fázy |
| `%signature%` | Automatický podpis odosielateľa |
| `%sender-firstname%` | Krstné meno odosielateľa |

> ⚠️ NIKDY nemeň `%signature%` ani `%sender-firstname%` — sú to Smartlead systémové tagy.

---

## Overená štruktúra (z `docs/smartlead-working-structures.md`)

```json
{
  "sequences": [
    {
      "seq_number": 1,
      "seq_delay_details": { "delay_in_days": 0 },
      "seq_variants": [
        { "variant_label": "A", "subject": "Predmet A", "email_body": "<p>HTML body</p>" },
        { "variant_label": "B", "subject": "Predmet B", "email_body": "<p>HTML body</p>" }
      ]
    },
    {
      "seq_number": 2,
      "seq_delay_details": { "delay_in_days": 3 },
      "seq_variants": [
        { "variant_label": "A", "subject": "", "email_body": "<p>Followup body</p>" }
      ]
    }
  ]
}
```

> Followup (seq > 1) má VŽDY prázdny subject — ostáva v tom istom emailovom threade.

---

## Niche-špecifické úpravy

V kroku 1 meníš IBA:
- `[NICHE]` → cieľová skupina (napr. "autoservisy", "realitné kancelárie")
- `[NICHE-SPECIFICKÝ PROBLÉM]` → konkrétna bolesť (napr. "chcú len cenovú ponuku bez záväzku")

NIČ iné nemeň — štruktúra, dĺžka a rytmus emailu zostáva rovnaký.
