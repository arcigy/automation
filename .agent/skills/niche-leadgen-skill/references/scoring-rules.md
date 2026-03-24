# Scoring Rules — Lead Validácia

Tento súbor definuje pravidlá pre `validate.ts` a `inject.ts`.
Každý lead dostane skóre 0–100. Zmeniť môžeš body tu, `validate.ts` ich zrkadlí automaticky.

## Pravidlá skórovania

| Kritérium | Body | Poznámka |
|---|---|---|
| **Má osobný email** | +30 | Nie info@, kontakt@, admin@ |
| **Má web** | +20 | Akákoľvek URL |
| **Doména .sk** | +10 | Preferujeme slovenské firmy |
| **Má decision maker** | +25 | Meno konateľa/majiteľa nájdené |
| **ORSR overený** | +15 | Firma existuje v registri |
| **Má AI icebreaker** | +10 | Personalizovaná veta existuje |
| Generický email (info@...) | −20 | info@, kontakt@, office@, admin@ |
| Chýba email | −10 | Nie je nutný ale penalizuje |
| Verification status: flagged | −15 | Podozrenie na problém |
| Verification status: failed | −30 | Enrichment zlyhal |

## Odporúčané prahy

| Prah | Kedy použiť |
|---|---|
| `--min-score 0` | Všetky leady s emailom (žiadna filtrácia) |
| `--min-score 50` | Štandardné kola — dobré pre väčšinu niche |
| `--min-score 70` | Vysoko personalizované kampane |
| `--min-score 85` | Len top kvalita — menší objem, lepší rate |

## Príklad výstupu `validate.ts`

```
📊 Scoring výsledky (stavebniny) — min-score: 70

  Priemer skóre  : 68/100
  Celkom leadov  : 143
  Prejde (≥70)   : 89 (62%)
  Neprejde (<70) : 54

  Rozdelenie:
    0-29      ██ 5
    30-49     ████ 12
    50-69     ████████████ 37
    70-89     ████████████████████ 62
    90-100    ████ 27
```
