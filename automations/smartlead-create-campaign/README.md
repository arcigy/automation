# Automation: smartlead-create-campaign

## Čo robí

Automatizuje kompletné vytvorenie kampane v Smartlead. Na jeden request vykoná:

1. Vytvorenie kampane (shell).
2. Pridanie všetkých emailových krokov (sequences).
3. Prepojenie odosielacích emailových účtov.
4. Nastavenie limitov, stop-on-reply a časového rozvrhu (schedule).

## Trigger

- Typ: manual / API trigger
- Endpoint: `POST /trigger/smartlead-create-campaign`

## Vstupné dáta (schema.ts)

- `name`: Názov kampane.
- `sequences`: Pole objektov (subject, body, delay_in_days).
- `email_account_ids`: Pole ID účtov, ktoré majú z kampane odosielať.
- `daily_limit`: Limit na jeden emailový účet za deň (default 50).
- `schedule`: Časové pásmo a dni odosielania.

## Príklad payloadu

```json
{
  "name": "Nová AI Automatizácia",
  "email_account_ids": [12345, 67890],
  "sequences": [
    {
      "subject": "Otázka k vašej automatizácii",
      "body": "Ahoj {{first_name}}, videl som tvoj web...",
      "delay_in_days": 0
    },
    {
      "subject": "Re: Otázka k vašej automatizácii",
      "body": "Pripomínam sa ohľadom predchádzajúceho emailu...",
      "delay_in_days": 2
    }
  ],
  "daily_limit": 40
}
```
