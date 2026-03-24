---
name: remote-leadgen
description: Spúšťa lead generation operácie cez Railway API. Volaj vždy cez tools.json — nikdy neformátuj HTTP requesty manuálne.
---

# Remote Lead Gen — Cloud Skill

## Konfigurácia

- **Base URL:** `https://automation-arcigy.up.railway.app`
- **Auth header:** `x-api-key: wvbwvnpiwemwkmgpomnoprtmnpotn51984er`
- **Tool definitions:** viď `tools.json`

Všetky API kľúče (Gemini, Smartlead, Google Maps) sú uložené na Railway serveri. Claude ich nikdy nevidí.

---

## Pravidlá

1. **Vždy použi tool z `tools.json`** — nikdy nehádaj formát parametrov
2. **Vždy pridaj `x-api-key` header** (okrem `/health`)
3. **Pred inject vždy spusti validate** — zabraňuje zlým dátam v Smartleade
4. **Použi `dryRun: true`** pri testovaní nových scraping konfigurácií

---

## Typický workflow

```
1. get_status          → zisti aktuálny stav DB
2. run_discovery       → scrapni nové leady
3. run_enrich          → AI enrichment (Gemini)
4. run_validate        → over kvalitu
5. run_inject          → nahraj do Smartleadu
6. get_status          → potvrď výsledok
```

---

## Príklady príkazov od užívateľa

| Užívateľ povie | Tool |
|---|---|
| "Scrapni plumbers v Bratislave" | `run_discovery` |
| "Enrichni všetky pending leady" | `run_enrich` |
| "Daj mi status" | `get_status` |
| "Inject do Smartleadu min score 80" | `run_inject` |
| "Pridaj amazon.sk do blacklistu" | `manage_blacklist` |
| "Exportuj accountants" | `export_leads` |

---

## Chybové stavy

| HTTP kód | Príčina | Riešenie |
|---|---|---|
| 401 | Zlý auth kľúč | Skontroluj `x-api-key` header |
| 400 | Chýbajúci parameter | Skontroluj `tools.json` required fields |
| 500 | Railway server error | Skontroluj Railway dashboard |
