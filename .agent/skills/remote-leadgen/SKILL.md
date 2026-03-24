---
name: remote-leadgen
description: Cloud-based lead generation API client — spúšťa všetky leadgen operácie cez Railway HTTP API bez lokálnych zavislostí
---

# Remote Lead Gen Skill — Cloud Control

## 🚀 Setup (PRVÝKRÁT)

Pred prvým použitím nastav:

```bash
LEADGEN_API_URL=https://automation-arcigy.up.railway.app
LEADGEN_API_KEY=<tvoj-GEMINI_API_KEY-z-railway>
```

> ⚡ Vše ostatné (databáza, API klíče) sú na Railway — ty tu nie!

---

## 📋 Všetky funkcie

### 1. 🔍 Discovery — Scraping

**Príkaz:**
```
Scrapni [niche] v [region]
```

**Parametre:**
- `niche` — niche (napr. "plumber", "accountant")
- `region` — mesto alebo kraj (napr. "bratislava", "all-slovakia")
- `source` — (voliteľne) "maps", "serper", alebo oboje
- `target` — (voliteľne) cieľ počtu leadov
- `dryRun` — (voliteľne) true = len náhľad bez ukladania

**Príklady:**
```
"Scrapni plumbers v bratislava s 50 leadmi"
"Scrapni accountants na Slovensku, iba z Google Maps"
"Test scraping bez ukladania"
```

---

### 2. 🧠 Enrichment — AI Enhancement

**Príkaz:**
```
Enrichni leady [z niche X] [limit N]
```

**Parametre:**
- `niche` — (voliteľne) konkrétna niche
- `limit` — (voliteľne) max počet leadov
- `allPending` — (voliteľne) všetky pending leady

**Príklady:**
```
"Enrichni všetky pending leady"
"Enrichni 20 leadov z plumber niche"
"Enrichni leady"
```

---

### 3. ✅ Validation — Quality Check

**Príkaz:**
```
Validuj leady [z niche X]
```

**Parametre:**
- `niche` — konkrétna niche na validáciu

**Čo robí:**
- Checkuje email formáty
- Skóre kvality (0-100)
- Duplicity & blacklist

---

### 4. 💉 Inject — Upload do Smartleadu

**Príkaz:**
```
Inject do Smartleadu [z niche X] [s parametrami]
```

**Parametre:**
- `niche` — niche na injectnutie
- `minScore` — (voliteľne) minimálne skóre (default 0)
- `createCampaign` — (voliteľne) vytvor novú kampaň
- `dryRun` — (voliteľne) len náhľad

**Príklady:**
```
"Inject plumbers do Smartleadu"
"Inject highest quality leady (min score 80) a vytvor kampaň"
"Skontroluj čo sa injected bez ukladania"
```

---

### 5. 📊 Prep for AI — Markdown Export

**Príkaz:**
```
Priprav leady z [niche] pre Claude
```

**Čo robí:**
- Exportuje leady v markdown formáte
- Vhodné pre ďalšie AI spracovanie

---

### 6. ❄️ Write Icebreakers — Email Templates

**Príkaz:**
```
Napíš icebreakery pre tieto leady
```

**Input:** Pole `{id, icebreaker}` objektov

**Čo robí:**
- Uloží emailové úvodné vety
- Linkuje na leadov v DB

---

### 7. 📥 Export — CSV/JSON

**Príkaz:**
```
Exportuj leady [z niche X]
```

**Čo robí:**
- Vracia export vo formáte CSV alebo JSON
- Všetky relevantné polia

---

### 8. 🚫 Blacklist — Domain Management

**Príkaz:**
```
Spravuj blacklist: [add/remove/list] [domena.sk]
```

**Parametre:**
- `action` — "add", "remove", alebo "list"
- `domain` — (pre add/remove) doména na zmenu

**Príklady:**
```
"Pridaj amazon.sk do blacklistu"
"Odstrániť facebook.com z blacklistu"
"Ukáž všetky blacklistované domény"
```

---

### 9. 📈 Status — Database Info

**Príkaz:**
```
Daj status [z niche X]
```

**Čo vracia:**
- DB štatistiky
- Počty leadov podľa stavu
- Posledné aktualizácie

---

## 🔧 Technické detaily

### API Endpoints

Všetky requesty vyžadujú header:
```
x-api-key: <LEADGEN_API_KEY>
```

| Endpoint | Metóda | Popis |
|----------|--------|-------|
| `/health` | GET | Health check (bez auth) |
| `/status` | GET | DB štatistiky |
| `/discovery` | POST | Scraping |
| `/enrich` | POST | Enrichment |
| `/validate` | POST | Validácia |
| `/inject` | POST | Smartlead upload |
| `/prep-for-ai` | POST | Markdown export |
| `/write-icebreakers` | POST | Email templates |
| `/export` | GET | CSV/JSON export |
| `/blacklist` | POST | Domain management |

### Error Handling

- **401 Unauthorized** → Zle API kľúč
- **400 Bad Request** → Chýbajúci parametre
- **500 Server Error** → Railway API error (check Railway logs)

---

## 💡 Best Practices

1. **Vždy validuj pred inject-om**: `Validuj leady` → potom `Inject`
2. **Testuj dry-run**: `Scrapni ... dryRun: true` pred plným behom
3. **Monitoruj status**: Pred Discovery urob `status` aby si videl aktuálny stav
4. **Blacklist preventívne**: Pridaj problem domény do blacklistu aby sa už nescrapovali

---

## 🆘 Debug

**Chyba: "Unauthorized"**
- Skontroluj `LEADGEN_API_KEY` na Railway
- Regeneruj ak treba

**Chyba: "Connection refused"**
- Je Railway deployment online? Skontroluj Railway dashboard
- Skontroluj `LEADGEN_API_URL`

**Chyba: "Module not found"**
- Railway dependency issue — check Railway build logs
- Restartni deployment

---

## 🎯 Typický workflow

```
1. Status → Vidíš aktuálny stav
2. Discovery → Scrapnešalbo leady
3. Validate → Skontroluj kvalitu
4. Prep for AI → Zisti viac o leadoch
5. Write Icebreakers → Vytvor email úvody
6. Inject → Upload do Smartleadu
7. Status → Potvrdi upload
```
