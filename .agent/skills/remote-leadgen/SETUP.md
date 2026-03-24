# Remote Leadgen Skill — Setup

## 1️⃣ Predpoklady

- Railway deployment je live: https://automation-arcigy.up.railway.app
- Máš `LEADGEN_API_KEY` z Railway settings

## 2️⃣ Konfigácia prostredia

Nastav environment premenné v Claude Code settings alebo v `.env.local`:

```bash
LEADGEN_API_URL=https://automation-arcigy.up.railway.app
LEADGEN_API_KEY=<tvoj-uuid-kľúč>
```

## 3️⃣ Verifikácia

Spustи health check:

```bash
curl https://automation-arcigy.up.railway.app/health
```

Mal by si dostať:
```json
{
  "status": "ok",
  "service": "niche-leadgen-skill",
  "timestamp": "2026-03-24T..."
}
```

## 4️⃣ Autentifikácia API Kľúča

Všetky requesty (okrem `/health`) vyžadujú header:

```
x-api-key: <LEADGEN_API_KEY>
```

Príklad:
```bash
curl -H "x-api-key: 550e8400-e29b-41d4-a716-446655440000" \
  https://automation-arcigy.up.railway.app/status
```

## 5️⃣ Prvý pokus

Spustי sa v Claude a skús:

```
"Daj mi status všetkých leadov"
```

Mal by Claude automaticky volať `/status` endpoint a vrátit ti DB štatistiky.

## 🆘 Troubleshooting

### "Unauthorized (401)"
- ✅ Skontroluj `LEADGEN_API_KEY` na Railway
- ✅ Je header `x-api-key` správne nastavený?

### "Connection refused"
- ✅ Je Railway deployment aktívny?
- ✅ Skontroluj https://railway.app dashboard

### "Bad Request (400)"
- ✅ Chýbajúci alebo nesprávny parameter
- ✅ Prečítaj dokumentáciu endpoint v SKILL.md

---

## 📚 Ďalšie kroky

1. Skontroluj `SKILL.md` pre všetky dostupné operácie
2. Použij `client.ts` ako TypeScript client ak potrebuješ progr. prístup
3. Refér sa na `references/` v skill root pre niche keywords a templates

---

## 🔐 Bezpečnosť

**❌ NIKDY:**
- Commituj `.env` súbory s API kľúčmi
- Zdielaj `LEADGEN_API_KEY` verejne
- Pushuj API kľúče do Git repozitária

**✅ VŽDY:**
- Úschováj kľúče v Railway secrets
- Používaj environment premenné
- Rotuj API kľúče pravidelne
