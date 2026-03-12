# Automation: smartlead-create-campaign

## Čo robí

Automatizuje kompletné vytvorenie kampane v Smartlead. Podporuje manuálne sekvencie aj **AI generovanie sekvencií** pomocou Gemini 2.5 Flash.

1. AI/Manual generovanie sekvencií (A/B varianty).
2. Vytvorenie kampane (shell).
3. Pridanie všetkých emailových krokov (sequences).
4. Prepojenie odosielacích emailových účtov.
5. Nastavenie limitov, stop-on-reply a časového rozvrhu (schedule).
6. Upload leadov (batch 100).

## Trigger

- Typ: manual / API trigger
- Endpoint: `POST /trigger/smartlead-create-campaign`

## Vstupné dáta (schema.ts)

- `name`: Názov kampane.
- `generateAiSequences`: (boolean) Ak true, použije AI na texty.
- `nicheDescription`: (optional) Kontext pre AI.
- `sequences`: (optional) Manuálne texty (ak generateAiSequences je false).
- `email_account_ids`: Pole ID účtov (napr. `[14382544, 14382530, 14382508, 14382300]`).
- `daily_limit`: Limit na jeden emailový účet za deň (default 50).

## Prompt pre AI

AI sa riadi inštrukciami v súbore `prompts/smartlead-sequence-ai.md`. Tento súbor môže používateľ kedykoľvek upraviť.

## Príklad AI-triggered payloadu

```json
{
  "name": "Autoservisy Bratislava",
  "generateAiSequences": true,
  "nicheDescription": "Majitelia autoservisov, ponuka AI chatbota na objednávky.",
  "email_account_ids": [14382544, 14382530]
}
```
