# Výsledky simulácie AI Odpovedí

## 1. Jasný záujem
**Lead:** "Dobrý deň, to znie super. Pošlite mi prosím tú ukážku."

**Klasifikácia / Status:** AI_REPLIED

**AI Odpoveď:**

```html
Dobrý deň,<br><br>
Ďakujem Vám za Váš záujem, som rád, že to znie super. <br><br>
Tu je sľ
```

---

## 2. Odmietnutie (Negatívne)
**Lead:** "Nemám záujem, vymažte ma."

**Klasifikácia / Status:** SKIP (NEGATIVE)

---

## 3. Otázka na cenu (Pozitívne)
**Lead:** "Zaujímavé. Koľko takéto niečo stojí? Môžete mi poslať viac info?"

**Klasifikácia / Status:** AI_REPLIED

**AI Odpoveď:**

```html
Dobrý deň,<br><br>Som rád, že vás naša ponuka zaujala a ďakujem za váš záujem.<br><br>Cena sa odví
```

---

## 4. Už bolo poslané (Already Sent)
**Lead:** "Viete mi to poslať ešte raz? Stratil som ten link."

**Klasifikácia / Status:** SKIP (Stopka - detegovaná manuálna odpoveď)

---

## 5. Human Check (Stopka) - Manuálna odpoveď
**Lead:** "Môžete mi to poslať?"

**Klasifikácia / Status:** SKIP (Stopka - detegovaná manuálna odpoveď)

---

## 6. Followup situácia (Nespúšťa stopku)
**Lead:** "Jasné, pošlite."

**Klasifikácia / Status:** AI_REPLIED

**AI Odpoveď:**

```html
Dobrý deň pán/pani Nagy,<br><br>Ďakujem za Vašu odpoveď. Ako som sľúbil, tu je ukážka našej
```

---

## 7. Technická otázka (Neutrálne)
**Lead:** "Používate na to Make alebo Python?"

**Klasifikácia / Status:** SKIP (NE)

---

## 8. Out of Office
**Lead:** "I am out of office until next Monday. Please contact my colleague."

**Klasifikácia / Status:** SKIP (NEUTRAL)

---

## 9. Žiadosť o hovor
**Lead:** "Môžeme si o tom zavolať v utorok? Alebo mi pošlite nejaké podklady vopred."

**Klasifikácia / Status:** AI_REPLIED

**AI Odpoveď:**

```html
Dobrý deň,<br><br>Ďakujem za Vašu odpoveď. Rád Vám posielam ukážku našich služieb, ktorú si môžete pozrieť vopred: <a href='https://www.arcigy.com/showcase'>https://www.arcigy.com/showcase</a>. Určite sa s Vami rád spojím v utorok a prediskutujeme to podrobnejšie.
```

---

## 10. Odpoveď kolegovi
**Lead:** "Pošlite to radšej mojim kolegom na info@firma.sk, oni to riešia."

**Klasifikácia / Status:** AI_REPLIED

**AI Odpoveď:**

```html
Dobrý deň pán/pani Baláž,<br><br>Ďakujem za nasmerovanie. Rád by som Vám opätovne poslal priamy odkaz na naš
```

---

