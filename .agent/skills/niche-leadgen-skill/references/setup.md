# Setup — Nastavenie ENV premenných

## Krok 1: Skopíruj `.env.example`

```bash
cd C:\Users\laube\Downloads\AUTOMATIZACIE
cp .agent\skills\niche-leadgen-skill\.env.example .env
```

Alebo použi existujúci `.env` v project roote — pridaj tam chýbajúce premenné.

---

## Krok 2: Vyplň hodnoty

### `DATABASE_URL`
PostgreSQL connection string. Formát:
```
postgresql://user:password@host:port/dbname
```
Pre Railway:
→ Railway dashboard → tvoj projekt → PostgreSQL service → Connect → Connection String

### `SMARTLEAD_API_KEY`
→ Smartlead → Settings → API → Copy API Key

### `GOOGLE_MAPS_API_KEY`
→ [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create API Key
→ Povoľ **Places API** (Text Search) v sekcii "Enable APIs & Services"

### `SERPER_API_KEY`
→ [serper.dev](https://serper.dev) → Dashboard → API Key

### `ANTHROPIC_API_KEY`
→ [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key

### `SLACK_WEBHOOK_URL` *(voliteľné)*
→ Slack → Your App → Incoming Webhooks → Add New Webhook to Workspace → Copy URL

---

## Krok 3: Overenie

```bash
bun scripts/db-status.ts
```

Ak ENV sú správne → vypíše štatistiky DB.
Ak niečo chýba → jasná chybová správa s názvom premennej.

---

## Pozor

- `.env` súbor **NIKDY** necommituj do gitu (je v `.gitignore`)
- Nikdy nepoužívaj Production Railway kľúče pri lokálnom vývoji
