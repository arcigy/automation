# Niche Templates

Claude VŽDY číta tento súbor pred spustením discovery pre konkrétnu niche.
Kľúčové slová sú optimalizované pre slovenský trh (Google Maps + Serper).

---

```yaml
niche: stavebniny
  maps_queries: ["stavebniny", "stavebný materiál", "stavebný sklad", "predaj tehál"]
  serper_queries: ["predaj stavebného materiálu", "stavebný sklad staviva", "stavebniny SK"]
  blacklist_keywords: ["baumax", "obi", "hornbach", "hobby", "bauhaus", "jysk"]

niche: realitky
  maps_queries: ["realitná kancelária", "nehnuteľnosti", "reality", "realitná agentúra"]
  serper_queries: ["kúpa predaj nehnuteľností", "realitná kancelária Slovakia", "predaj bytov"]
  blacklist_keywords: ["bazos", "nehnutelnosti.sk", "reality.sk", "topreality", "sreality"]

niche: autoservisy
  maps_queries: ["autoservis", "autoopravovňa", "servis áut", "pneuservis", "car service"]
  serper_queries: ["oprava áut servis", "autoopravovňa pneuservis", "llakovacie stredisko"]
  blacklist_keywords: ["autobazar", "autohaus", "škoda auto", "volkswagen dealership"]

niche: kadernictva
  maps_queries: ["kaderníctvo", "kadernícky salón", "hair salon", "barber shop"]
  serper_queries: ["kadernícky salón objednávky", "kaderník salon SK"]
  blacklist_keywords: []

niche: zubari
  maps_queries: ["zubný lekár", "zubná ambulancia", "stomatológia", "zubná klinika"]
  serper_queries: ["zubný lekár objednávky online", "zubná ambulancia privát"]
  blacklist_keywords: ["nemocnica", "poliklinika", "zdravotné stredisko"]

niche: fitnescentra
  maps_queries: ["fitness centrum", "posilňovňa", "gym", "fitnescentrum", "crossfit"]
  serper_queries: ["fitness centrum členstvo", "posilňovňa gym SK"]
  blacklist_keywords: ["recovapro", "mall", "forum"]

niche: hotely
  maps_queries: ["hotel", "penzión", "ubytovanie", "apartmány na prenájom"]
  serper_queries: ["hotel ubytovanie rezervácia", "penzión dovolenka SK"]
  blacklist_keywords: ["booking.com", "airbnb", "trivago", "hotels.com"]

niche: restauracie
  maps_queries: ["reštaurácia", "gastropub", "bistro", "catering", "jedáleň"]
  serper_queries: ["reštaurácia online objednávky", "catering firemné akcie SK"]
  blacklist_keywords: ["pizza hut", "mcdonald", "kfc", "subway", "delivery.com"]

niche: pravnici
  maps_queries: ["advokát", "advokátska kancelária", "právnik", "notár"]
  serper_queries: ["advokátska kancelária právne poradenstvo SK", "právnik obchodné právo"]
  blacklist_keywords: ["sak.sk", "notarskakomorask"]

niche: uctovnici
  maps_queries: ["účtovník", "účtovníctvo", "daňový poradca", "mzdová agenda"]
  serper_queries: ["externé účtovníctvo firma SK", "daňový poradca mzdová agenda"]
  blacklist_keywords: []

niche: cisticky
  maps_queries: ["čistiaca služba", "upratovacia firma", "cleaning service", "dezinfekcia"]
  serper_queries: ["upratovacia firma firmy SK", "čistenie kobercov okien"]
  blacklist_keywords: []

niche: doprava-logistika
  maps_queries: ["prepravná spoločnosť", "kuriér", "logistika", "expresná preprava", "špeditérska firma"]
  serper_queries: ["prepravná spoločnosť express SK", "doručovacia logistika firma"]
  blacklist_keywords: ["dpd", "gls", "dhl", "fedex", "ups"]

niche: skolky-skoly
  maps_queries: ["súkromná škôlka", "materská škola súkromná", "kurzy angličtiny", "jazyková škola"]
  serper_queries: ["súkromná škôlka zápis", "jazyková škola kurzy SK"]
  blacklist_keywords: ["základná škola štátna", "stredná škola"]

niche: e-shopy
  maps_queries: []
  serper_queries: ["e-shop SK dodávateľ", "online obchod slovensko kontakt"]
  blacklist_keywords: ["amazon", "ebay", "alza", "nay", "mall.sk"]

niche: tepelne-cerpadla
  maps_queries: ["montáž tepelných čerpadiel", "tepelné čerpadlá", "kúrenie a chladenie", "plynoinštalácia kúrenie", "stavebná firma bazény"]
  serper_queries: ["montáž tepelného čerpadla firma SK", "tepelné čerpadlá a solárne systémy", "predaj montáž tepelných čerpadiel", "inštalatér tepelné čerpadlo"]
  blacklist_keywords: ["bazoš", "heureka", "alza", "mall"]
```

---

## Ako pridať nový niche

1. Skopíruj blok začínajúci `niche: ...`
2. Nahraď slug a hodnoty
3. Otestuj s `--dry-run`:
   ```bash
   bun scripts/discovery.ts --niche [slug] --region Bratislava --dry-run --verbose
   ```
