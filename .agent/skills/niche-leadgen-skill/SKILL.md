# Niche Lead Gen Skill — Inštrukcie pre Claude (V2 Automated)

## Stack & Produkcia

- **Runtime**: Node.js / Bun
- **Scraper**: Axios (Fast) + Playwright (JS Fallback) -> 98% úspešnosť.
- **AI Engine**: Gemini 2.5 Flash (Plne automatizované icebreakery a analýza DM).
- **Primary Source**: Serper.dev (Organické výsledky) pre vysokú kvalitu.
- **Blacklist**: Stály zákaz pre Facebook, Bazoš, Portály a Sociálne siete.

---

## 🚀 Jediný príkaz pre kompletný pipeline (Hands-off)

Ak chceš spustiť všetko od nuly až po spustenú kampaň:

```bash
node --env-file=.env --import tsx .agent/skills/niche-leadgen-skill/scripts/full-pipeline.ts --niche "fasady" --query "odvetrávané fasády na sk" --create-campaign --use-ai-sequences
```

Tento príkaz:
1.  **Discovery**: Nájde firmy cez Serper (primárne) a Maps.
2.  **Enrichment**: Scrapne weby (cez Playwright ak treba), vytiahne IČO, DM a napíše Icebreaker cez Gemini.
3.  **Validation**: Odfiltruje duplicity a nekvalitné domény.
4.  **Injection**: Vytvorí kampaň v Smartleade s AI sekvenciami a správnym oslovením (`pán/pani`).

---

## 🧠 Rozhodovanie (Discovery)

| User hovorí | Čo spustiť |
|---|---|
| "Nájdi firmy [niche] cez Serper" | `discovery.ts --niche [niche] --source serper --query "[query]"` |
| "Nájdi firmy na celom SK" | pridaj `--region all-slovakia --resume` |
| "Vyhni sa portálom" | System už automaticky filtruje Facebook, Bazoš a katalógy. |

---

## 🛠️ Detaily Scrapera (98% Success)

Náš scraper teraz funguje v dvoch vlnách:
1.  **Vlna 1 (Blesková)**: Axios stiahne HTML. Ak nájde email, končí.
2.  **Vlna 2 (Hĺbková)**: Ak Axios nič nenašiel, spustí sa **Playwright (Chromium)**. Načíta web, spustí Javascript, odscrolluje na spodok a hľadá skryté kontakty.
3.  **Blacklist**: Ak je doména na zozname portálov (facebook, bazos, azet...), scraper ju okamžite preskočí.

---

## 📧 Smartlead & Personalizácia

- **Oslovenie**: Používame premennú `{{last_name_with_salutation}}`. 
- **Logika**: Ak meno existuje, pole obsahuje ` pán Priezvisko`. Ak nie, je prázdne.
- **Template**: V Smartlead šablóne VŽDY píšeme `Dobrý deň{{last_name_with_salutation}},` (bez medzery).
- **Zodpovednosť**: `inject.ts` automaticky generuje sekvencie cez Gemini prompt ak zadáš `--use-ai-sequences`.

---

## 📋 Príkazy — rýchla referencia

```bash
# Discovery (Serper priority)
node --env-file=.env --import tsx discovery.ts --niche "fasady" --source serper --query "realizacia odvetravanych fasad slovensko"

# Enrichment (s Playwright fallbackom)
node --env-file=.env --import tsx enrich.ts --niche "fasady" --limit 100

# Inject (s AI textami)
node --env-file=.env --import tsx inject.ts --niche "fasady" --create-campaign --use-ai-sequences
```
