# Tool: Smartlead Add Leads

## Čo robí

Nahráva zoznam leadov do konkrétnej Smartlead kampane. Automaticky rozdeľuje leady do batchov po 100 (limit Smartlead API).

## Vstupné polia

- `campaignId`: ID kampane zo Smartleadu.
- `leads`: Pole objektov, kde každý lead obsahuje `email` (povinné), `first_name`, `company_name` a hlavne `custom_fields`.

## Príklad mapovania z našej DB

```typescript
{
  email: lead.primary_email,
  first_name: lead.decision_maker_name || "Hey",
  company_name: lead.original_name,
  custom_fields: {
    icebreaker: lead.icebreaker_sentence,
    company_short: lead.company_name_short
  }
}
```

## Použitie v Smartlead template

V Smartlead potom stačí v textoch použiť:
`{{icebreaker}}` pre AI pochvalu.
`{{company_short}}` pre ľudský názov firmy.
