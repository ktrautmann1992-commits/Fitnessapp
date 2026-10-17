# Bau-Plan Etappe E4 – Barcode und Open Food Facts (gratis, ohne KI)

**Status:** **Freigegeben (17.10.2026)** – Gründer-Entscheidung: E4-G1 bis E4-G13 alle „wie empfohlen“ (Abschnitt 10).
Bau zuerst E4a (Nummer eintippen), danach E4b (Kamera, mit neuem EAS-Build).
**E4a umgesetzt – Stand 17.10.2026** (Umsetzungsstand E4a am Ende von Abschnitt 8; Feature-Flag aus, Testmodus mit
Attrappe). **E4b umgesetzt – Stand 17.10.2026** (Umsetzungsstand E4b am Ende von Abschnitt 8; braucht einen neuen
EAS-Build für die App).

**Grundlage:** `CLAUDE.md`; `docs/PLAN-AUSWERTUNG.md` Abschnitt 10 (Skizze E4), 2.4, 2.7, 12, 13, 14 (A-G2, A-G9,
A-G12, A-G14, A-G16) sowie die Umsetzungsstände E1, E2 (Server rechnet nach, fester Titel + Verweis, Widerruf) und E3
(Route `POST /api/ernaehrung/foto`, Herkunft `photo`); `docs/PLAN-PHASE-5.md` 5.1 (Quellen- und Lizenzregeln,
„Nährwerte kommen nie von der KI“, `foods-import`, `sources-integrity`) und 13 (X0 „nur Produktarten“, X1);
`docs/KONZEPT.md` 6.1 und 6.2; Code-Stand `origin/main` vom 16.10.2026 (inkl. E3, Commit `49ccace`).

**Zur Entscheidung A-G16** („Barcode erst nach A3 entscheiden“): A3 ist umgesetzt. Dieser Plan ist die Grundlage
für diese Entscheidung. E4 bleibt **gratis und ohne KI** (A-G9, CLAUDE.md „Gratis ohne KI“).

---

## 0. Kurzfassung

- **Was ihr bekommt:** Auf „Eintragen“ gibt es einen neuen Weg **„Produkt (Barcode)“**. Ihr tippt die Nummer unter dem
  Strichcode ein (E4a) oder scannt ihn mit der Kamera (E4b). Die App zeigt Name, Marke und Nährwerte je 100 g bzw.
  100 ml von **Open Food Facts** (OFF), ihr wählt die Menge (g/ml, „1 Portion“, „ganze Packung“) und tragt ein.
  Unbekannt oder unplausibel → **eigenes Produkt** anlegen (nur für euch sichtbar).
- **Datenschutz:** Die Abfrage läuft **nur über unseren Server** (`apps/web`, Frankfurt). OFF erfährt die Nummer, aber
  nicht, wer fragt: keine Nutzer-ID, kein Cookie, keine IP-Adresse der Person. Die Nummer steht nicht in der Adresse
  (POST statt GET) und nicht in Logs.
- **Zwischenspeicher `food_products`:** gemeinsam für alle, **ohne jeden Personenbezug**, nicht direkt lesbar, nur
  die abgefragten Felder, nach 30 Tagen aufgefrischt, nach 90 Tagen gelöscht. Grund für „gemeinsam“: OFF erlaubt
  **15 Produktabfragen pro Minute je IP-Adresse**, und alle Abfragen kommen von unserem Server.
- **Fremddaten werden geprüft:** Der Core prüft jede Antwort (kcal gegen Makros nach Atwater, unmögliche Werte,
  fehlende Felder, kJ/kcal verwechselt). Unmögliche Werte **sperren das Eintragen** (eigenes Produkt anlegen),
  auffällige Werte brauchen eine **Bestätigung** („Werte prüfen“).
- **Server rechnet nach** wie bei `photo`/`food`: Ein Eintrag mit Herkunft **`product`** bekommt seine Werte aus
  `food_products` (bzw. aus dem eigenen Produkt), nie vom Gerät.
- **Marken** stehen nur bei Produkten, die die Person selbst abgefragt hat (Produktansicht, Tagebuch, Zuletzt,
  Favoriten), **nie** in Vorschlägen, Essensplan, Einkaufsliste, Rezepten oder der Katalog-Suche (X0).
- **OFF-Daten bleiben getrennt vom BLS-Katalog**: Sie kommen nie nach `content/foods/`, `foods`, Rezepte oder Pläne.
- **Lizenz:** OFF-Datenbank unter **ODbL 1.0**, einzelne Inhalte unter **DbCL 1.0**, Bilder unter **CC BY-SA**.
  Pflicht: sichtbare Quellenangabe mit Link und Lizenz. Bilder zeigen wir in E4 nicht. Ob unser Zwischenspeicher eine
  „abgeleitete Datenbank“ ist, prüft eine Juristin oder ein Jurist. Das ist **eure Aufgabe vor dem Livegang**
  (Abschnitt 6).
- **Etappen:** **E4a** Nummer eintippen + Route + Zwischenspeicher + eigene Produkte + Tagebuch + Seite „Lizenzen“
  (kein neuer App-Build nötig). **E4b** Kamera: im Handy-Browser über `BarcodeDetector` (Chrome/Android) und in der
  App über `expo-camera` – **neuer EAS-Build nötig**.

---

## 1. Recherche Open Food Facts (Stand 16.10.2026)

**Hinweis zur Recherche:** In dieser Cloud-Sitzung sperrt der Netz-Proxy `openfoodfacts.org` und
`openfoodfacts.github.io`. Die Fakten stammen deshalb aus der Websuche (Auszüge der offiziellen Seiten) vom
16.10.2026. **Vor dem Bau von E4a prüft die Bau-Sitzung jede Zahl gegen den Originaltext. Gelingt das nicht, prüft ihr
sie im Handy-Browser** (Links in 1.7). Für den Betrieb spielt die Sperre keine Rolle: Vercel erreicht OFF.

### 1.1 Schnittstelle (API)

- **Produkt lesen:** `GET https://world.openfoodfacts.org/api/v2/product/{barcode}` mit `fields=` (nur die
  benötigten Felder, kommagetrennt). Lesen braucht keine Anmeldung. Daneben gibt es **v3** (`/api/v3/product/{barcode}`,
  auch Unterversionen wie `v3.6`) mit anderem Antwortaufbau (`status`, `result`, `errors`). Laut Doku sind Lesen und
  Schreiben in v3 verfügbar, die Parameter für GET in v3 sind aber nicht eindeutig belegt.
  _Empfehlung:_ **v2 mit `fields`** (gut dokumentiert, stabil). Die Bau-Sitzung legt die Version in `constants.ts`
  fest (`OPEN_FOOD_FACTS.apiVersion`), dann ist ein Wechsel eine Zeile.
- **Benötigte Felder** (Vorschlag, beim Bau gegen die Feld-Doku prüfen): `code`, `product_name`, `product_name_de`,
  `generic_name_de`, `brands`, `quantity`, `product_quantity`, `product_quantity_unit`, `serving_size`,
  `serving_quantity`, `nutrition_data_per`, `nutriments` (darin `energy-kcal_100g`, `energy-kj_100g`,
  `proteins_100g`, `carbohydrates_100g`, `sugars_100g`, `fat_100g`, `saturated-fat_100g`, `fiber_100g`, `salt_100g`,
  `sodium_100g`, `polyols_100g`, `alcohol_100g` sowie die zugehörigen `_modifier`-Felder wie „<“),
  `last_modified_t`. **Nicht** abgefragt: Bilder, Zutaten, Allergene, Nutri-Score, NOVA, Eco-Score, Mitwirkende,
  Bearbeitungsverlauf.
- **Einheiten:** Felder mit `_100g` gelten **je 100 g oder je 100 ml** (bei Getränken je 100 ml). Felder mit
  `_serving` gelten je Portion. Ist ein Produkt nur je Portion erfasst, rechnet OFF `_100g` aus `serving_quantity` –
  das stimmt nur, wenn die Portionsgröße stimmt. `energy-kcal` ist in kcal, das Feld `energy` (ohne Zusatz) in kJ
  (in der Doku teils widersprüchlich, Issue #51). `alcohol_100g` ist nach unserem Kenntnisstand **% vol**, nicht
  Gramm – beim Bau prüfen.
- **Nicht gefunden:** v2 antwortet mit `status: 0` („product not found“), je nach Version auch mit HTTP 404. Beides wird
  als `not_found` behandelt.
- **Testumgebung:** `world.openfoodfacts.net` (HTTP-Basic-Auth `off`/`off`). Wir nutzen sie nur für einen
  Handtest vor dem Livegang. Automatische Tests laufen **ohne Netz** mit Ersatz-`fetch` (wie E3).

### 1.2 Nutzungsbedingungen

- **User-Agent ist Pflicht** in der Form `AppName/Version (Kontakt-E-Mail)`, z. B. `Alpha5/0.1.0
(kontakt@<eure-domain>)`. Sonst kann OFF die Anfragen für einen Bot halten. Die Kontaktadresse ist eine
  Funktionsadresse, keine persönliche. Sie ist kein Geheimnis; die Bau-Sitzung trägt sie als Vercel-Variable
  `OFF_CONTACT_EMAIL` ein (ohne sie antwortet die Route `not_configured`).
- **Rate-Limits (offiziell):** **15 Anfragen pro Minute je IP-Adresse** für alle Produkt-Lesezugriffe
  (`GET /api/v*/product`), **10 pro Minute** für Suchen. Bei Überschreitung droht eine **IP-Sperre**. Zusätzlich gibt es
  globale Grenzen; dann antwortet OFF mit **HTTP 503**. Ältere Quellen nennen 100 pro Minute; das ist überholt
  (ein Community-Projekt hat von 100 auf 15 korrigiert).
- **Folge für uns:** Laut OFF gelten die Grenzen bei Abfragen direkt aus einer App je Person. Bei uns laufen aber alle
  Abfragen über den Server, also teilen sich **alle Personen das Kontingent**. Deshalb: gemeinsamer Zwischenspeicher
  und ein eigener, vorsichtiger Deckel von **10 OFF-Abfragen pro Minute** für den ganzen Server (Abschnitt 3.3).
  Für viele Produkte auf einmal empfiehlt OFF die Daten-Exporte (CSV/JSONL). Die brauchen wir in E4 nicht.
  Wächst die Nutzerzahl, ist ein Export-Import die Ausweichlösung (eigene Etappe, Lizenzfolgen siehe 6.3).

### 1.3 Lizenz

- **Datenbank:** Open Database License **ODbL 1.0**. **Einzelne Inhalte** (Werte eines Produkts): Database Contents
  License **DbCL 1.0**. **Produktbilder:** **CC BY-SA**; die Versionsangabe ist uneinheitlich (3.0 laut Digital
  Public Goods). Zusätzlich können Fotos Marken- oder Urheberrechte am Verpackungsdesign berühren.
- **Namensnennung:** Laut Nutzungsbedingungen müssen Weiterverwender die Lizenz nennen und Open Food Facts mit Link
  als Urheber angeben, sichtbar in der App bzw. auf der Website.
- **Share-Alike:** Wer eine **angepasste Fassung der Datenbank** oder ein Werk daraus öffentlich nutzt, muss die
  angepasste Datenbank ebenfalls unter ODbL anbieten. Laut OFF-Support gilt das auch, wenn man OFF-Daten **mit anderen
  Datenbanken verbindet**: Die entstehende Datenbank muss offen sein. Eine Pflicht, eigene Daten an OFF
  zurückzugeben, gibt es nicht.
- **ODbL-Systematik** (Lizenztext, OSMF-Leitfaden „Produced Work“): Ein **„Produced Work“** (z. B. eine
  Bildschirmansicht mit den Werten eines Produkts) ist keine Datenbank, wenn es nicht dazu dient, die Daten
  herauszuziehen. Es braucht nur einen Hinweis (4.3). **Abgeleitete Datenbanken** fallen unter Share-Alike (4.4), aber
  **nur bei öffentlicher Nutzung**. Interne Nutzung ist nicht öffentlich. Wird ein Werk aus einer abgeleiteten
  Datenbank öffentlich genutzt, verlangt 4.6, entweder die ganze abgeleitete Datenbank **oder eine Datei bzw.
  Beschreibung aller Änderungen (z. B. als Algorithmus)** anzubieten. Ob ein **Zwischenspeicher** eine abgeleitete
  Datenbank ist, beantworten die gefundenen Quellen nicht. **Rechtsprüfung nötig** (Abschnitt 6).

### 1.4 Datenqualität

- OFF ist **von Freiwilligen erfasst**. Bekannte Fehler: fehlende Makros (eine Auswertung von 2021 nennt nur etwa 67 %
  vollständige Makro-Angaben), **kJ als kcal eingetragen** (Werte etwa 4-fach falsch), falsche Portionsgrößen (falsche
  `_100g`-Werte, krumme Nachkommastellen), Werte für das zubereitete statt das verkaufte Produkt. OFF selbst
  markiert z. B. „Energy value in kcal does not match value computed from other nutrients“ als Datenqualitätsfehler.
- **Folge:** Wir übernehmen nichts ungeprüft. Der Core prüft jede Antwort (Abschnitt 4), die App zeigt „Angaben von
  Open Food Facts – bitte mit der Packung vergleichen“.
- **Allergene und Zutaten** aus OFF nutzen wir **nicht**. Sie sind Fremddaten ohne Gewähr, und die Warnungen zu
  Unverträglichkeiten in der App beruhen auf dem geprüften Katalog (PLAN-PHASE-5 5.1.1). In der Produktansicht steht
  fest: „Wir prüfen Produkte nicht auf deine Unverträglichkeiten – lies die Zutatenliste auf der Packung.“

### 1.5 Standort und Datenschutz bei OFF

- OFF ist ein französischer Verein; die Server stehen laut Impressum in **Frankreich** (Fondation Free, Paris; neuere
  Fassung zusätzlich OVH, Roubaix). Es gilt französisches Recht, die Daten bleiben in der EU. Was OFF über
  API-Abfragen protokolliert, steht nicht im gefundenen Text. Wir gehen davon aus, dass **IP-Adresse, Zeit und Nummer**
  protokolliert werden.
- **Folge:** Eine Barcode-Abfrage verrät Konsumverhalten (z. B. glutenfreies Brot, Diabetiker-Schokolade,
  Schwangerschafts-Tee). Deshalb fragt **nur unser Server** bei OFF an. OFF sieht dann nur die Server-IP von Vercel,
  die Nummer und unseren User-Agent. Die App lädt **nichts direkt** von OFF, also auch keine Bilder (die würden die
  IP-Adresse der Person an OFF senden).

### 1.6 Kamera

- **Handy-Browser:** Die `BarcodeDetector`-Schnittstelle gibt es in **Chrome für Android** (laut caniuse für
  `detect()` ab Version 151), in Samsung Internet und in Opera Android. Sie fehlt in **Safari auf iPhone/iPad**
  (bis 26.x „standardmäßig aus“) und in **Firefox**. Welche Formate gehen, liefert
  `BarcodeDetector.getSupportedFormats()` zur Laufzeit (`ean_13` prüfen). Ausweichlösung: ein JavaScript/WASM-Leser
  (Polyfill auf Basis von ZXing) oder Nummer eintippen. Kamera im Browser braucht HTTPS (Vercel hat es) und die
  Erlaubnis der Person.
- **App (iPhone/Android):** `expo-camera` (`CameraView`) kann Barcodes lesen (`ean13`, `ean8`, `upc_a`, `upc_e` …),
  `expo-barcode-scanner` ist veraltet. `expo-camera` ist ein **natives Modul mit Config-Plugin** (Kamera-
  Berechtigungstext für iOS, `CAMERA` für Android). Deshalb ist ein **neuer EAS-Build nötig** (Abschnitt 5).

### 1.7 Quellen (alle abgerufen am 16.10.2026, über die Websuche; Originale vor dem Bau gegenprüfen)

- OFF-API, Einführung (Rate-Limits, User-Agent, Testumgebung):
  [openfoodfacts.github.io/openfoodfacts-server/api/](https://openfoodfacts.github.io/openfoodfacts-server/api/) und
  [openfoodfacts.github.io/documentation/docs/Product-Opener/api/](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
- OFF-API, Spickzettel (`fields`):
  [openfoodfacts.github.io/openfoodfacts-server/api/ref-cheatsheet/](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-cheatsheet/)
- OFF-API, Anleitung:
  [openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/)
- Nutzungsbedingungen (ODbL, DbCL, CC BY-SA, Namensnennung):
  [world.openfoodfacts.org/terms-of-use](https://world.openfoodfacts.org/terms-of-use)
- Daten-Exporte und Share-Alike: [world.openfoodfacts.org/data](https://world.openfoodfacts.org/data)
- Support „Are there conditions to use the API?“ (Verbinden mit anderen Datenbanken):
  [support.openfoodfacts.org/…/94-are-there-conditions-to-use-the-api](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api)
- Forum „Conditions to use the Open Food Facts API“:
  [forum.openfoodfacts.org/t/conditions-to-use-the-open-food-facts-api/443](https://forum.openfoodfacts.org/t/conditions-to-use-the-open-food-facts-api/443)
- Rate-Limit-Richtlinie: [github.com/openfoodfacts/openfoodfacts-server/issues/8818](https://github.com/openfoodfacts/openfoodfacts-server/issues/8818);
  Korrektur 100 → 15: [github.com/cyanheads/openfoodfacts-mcp-server/issues/25](https://github.com/cyanheads/openfoodfacts-mcp-server/issues/25)
- Feldbedeutung `_100g`/`_serving`: [github.com/openfoodfacts/api-documentation/issues/64](https://github.com/openfoodfacts/api-documentation/issues/64);
  kcal/kJ-Feld: [github.com/openfoodfacts/api-documentation/issues/51](https://github.com/openfoodfacts/api-documentation/issues/51)
- OFF-Datenqualitätsfehler kcal ≠ Makros:
  [world.openfoodfacts.org/…/energy-value-in-kcal-does-not-match-value-computed-from-other-nutrients](https://world.openfoodfacts.org/store/ica-willys-coop-hemkop/data-quality-error/energy-value-in-kcal-does-not-match-value-computed-from-other-nutrients)
- Impressum/Hosting: [world-xh.pro.openfoodfacts.org/legal](https://world-xh.pro.openfoodfacts.org/legal)
- ODbL 1.0 (Lizenztext): [spdx.org/licenses/ODbL-1.0.html](https://spdx.org/licenses/ODbL-1.0.html) bzw.
  [opendatacommons.org/licenses/odbl/1-0/](https://opendatacommons.org/licenses/odbl/1-0/)
- OSMF-Leitfaden „Produced Work“:
  [osmfoundation.org/wiki/Licence/Community*Guidelines/Produced_Work*-\_Guideline](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline)
- BarcodeDetector: [caniuse.com/mdn-api_barcodedetector_detect](https://caniuse.com/mdn-api_barcodedetector_detect),
  [developer.mozilla.org/docs/Web/API/Barcode_Detection_API](https://developer.mozilla.org/docs/Web/API/Barcode_Detection_API)
- expo-camera (SDK 57): [docs.expo.dev/versions/v57.0.0/sdk/camera/](https://docs.expo.dev/versions/v57.0.0/sdk/camera/);
  veralteter Scanner: [docs.expo.dev/versions/latest/sdk/bar-code-scanner](https://docs.expo.dev/versions/latest/sdk/bar-code-scanner)

---

## 2. Ablauf für die Person

### 2.1 Produkt eintragen

1. **Ernährung → „Eintragen“** → neuer Kasten **„Produkt (Barcode)“** neben „Per Foto“ (Bildschirm
   `ernaehrung/produkt.tsx`). Ohne gültige Einwilligung `health_data` erscheint wie bei E1 die Erklärung mit
   „Einwilligung erteilen“ (A-G12).
2. **Nummer eingeben** (E4a): ein Zahlenfeld (`inputMode="numeric"`) mit Hinweis „Die 8 oder 13 Ziffern unter dem
   Strichcode“. Leerzeichen werden entfernt. Die Prüfziffer prüft schon das Gerät („Die Nummer stimmt nicht – bitte
   noch einmal abtippen“). **Kamera** (E4b): Knopf „Mit der Kamera scannen“, nur wenn das Gerät es kann (Abschnitt 5).
3. **Zuerst eigene Produkte:** Hat die Person ein eigenes Produkt mit dieser Nummer, zeigt die App es sofort, ohne
   Abfrage beim Server. Darunter steht „Stattdessen bei Open Food Facts nachsehen“.
4. **Abfrage** über den Server: „Suche Produkt …“. Ergebnisse:
   - **Gefunden, Werte plausibel** → Produktansicht (2.2).
   - **Gefunden, Werte auffällig** („Werte prüfen“) → Produktansicht mit gelbem Hinweis. „Eintragen“ geht erst nach
     dem Haken „Ich habe die Werte mit der Packung verglichen“. Daneben „Werte ändern“ (legt ein eigenes Produkt an).
   - **Gefunden, Werte unbrauchbar** (z. B. keine kcal, unmögliche Werte, nur zubereitet angegeben) → „Für dieses
     Produkt fehlen verlässliche Nährwerte“ mit **„Eigenes Produkt anlegen“**. Name, Marke und Nummer sind
     vorausgefüllt, die Werte trägt die Person von der Packung ein.
   - **Nicht gefunden** → „Dieses Produkt kennen wir noch nicht“ + „Eigenes Produkt anlegen“ (Nummer vorausgefüllt)
     - „Schnelleintrag stattdessen“.
   - **Ladencode/Waagencode** (Präfix 02 und 20–29, z. B. Frischetheke) bzw. **kein Lebensmittel** (978/979 Bücher,
     977 Zeitschriften) → Hinweis ohne Abfrage („Dieser Code gilt nur im Laden – trag das Lebensmittel über die Suche
     ein“).
   - **Offline** → „Für die Produktabfrage brauchst du Internet. Eigene Produkte und die Suche gehen auch offline.“
   - **Zu viele Abfragen / OFF nicht erreichbar / Zeitlimit** → „Open Food Facts ist gerade nicht erreichbar – versuch
     es in ein paar Minuten noch einmal oder leg ein eigenes Produkt an.“ Die Nummer bleibt im Feld stehen.
5. **Produktansicht (2.2)** → Menge wählen → Mahlzeit (vorbelegt nach Uhrzeit wie E1) → Tag (heute bis 14 Tage
   zurück) → **„Eintragen“**. Herkunft im Tagebuch: **`product`**. „Abbrechen“ speichert nichts.
6. Ab 1.500 kcal je Eintrag kommt die bekannte Rückfrage aus E1 (ohne Zahlen bei „Zahlen aus“).

### 2.2 Produktansicht

- **Name** (aus `product_name_de`, sonst `product_name`, sonst `generic_name_de`, sonst „Produkt ohne Namen“), darunter
  **Marke** (erste Angabe aus `brands`) und Packungsgröße (`quantity`). Alles als reiner Text, gekürzt (Abschnitt 4.1).
- **Nährwerte je 100 g bzw. 100 ml:** kcal, Eiweiß, Kohlenhydrate (davon Zucker), Fett (davon gesättigte), Ballaststoffe,
  Salz. Fehlende Werte zeigt die App als „–“, nie als 0. Bei „Zahlen aus“ und in Schwangerschaft/Stillzeit (A-G8):
  keine kcal und keine Makros, nur Name, Marke und Menge. Hinweise kommen dann ohne Zahlen („Die Angaben wirken
  unvollständig“).
- **Mengenwahl:** Gramm bzw. Milliliter frei (1–2.000, wie `FOOD_LOG_LIMITS`), Schnellknöpfe **„1 Portion (30 g)“**
  (nur wenn `serving_quantity` plausibel ist, 1–2.000), **„ganze Packung (400 g)“** (nur wenn `product_quantity`
  ≤ 2.000) und ½ / 2 Portionen. Gespeichert wird immer die Menge in g bzw. ml (keine Einheit „Portion“ für Produkte).
- **Quellenangabe** (Pflicht, ODbL 4.3) unter den Werten, klein, aber lesbar:
  „Produktdaten: Open Food Facts (openfoodfacts.org), Lizenz ODbL 1.0 · abgerufen am 16.10.2026 · Angaben ohne Gewähr –
  bitte mit der Packung vergleichen.“ Dazu ein Link „Mehr zur Lizenz“ zur Seite „Lizenzen“ (6.1). Ein Link „Bei Open Food
  Facts ansehen“ öffnet den Browser erst nach dem Hinweis „Dabei verlässt du die App; Open Food Facts sieht dann deine
  IP-Adresse“ (_Empfehlung:_ so, E4-G11).
- Fester Satz: „Wir prüfen Produkte nicht auf deine Unverträglichkeiten – lies die Zutatenliste auf der Packung.“
- **Nicht angezeigt:** Bilder, Nutri-Score, NOVA, Eco-Score, „gesund/ungesund“ (keine Bewertungen; 2.4
  Essstörungs-Sensibilität; E4-G9).

### 2.3 Eigenes Produkt anlegen

- Erreichbar aus „Nicht gefunden“/„Werte unbrauchbar“/„Werte ändern“ und unter **Ernährung → „Eigene Gerichte“ →
  Reiter „Eigene Produkte“** (Liste, Ändern, Löschen; wie E2).
- Felder: **Name** (1–60 Zeichen, Pflicht), **Marke** (0–40 Zeichen, freiwillig), **Nummer** (freiwillig, mit
  Prüfziffer), **Bezug** „je 100 g“ oder „je 100 ml“, **kcal, Eiweiß, Kohlenhydrate, Fett** (Pflicht), Zucker, Salz
  (freiwillig), **Portion in g/ml** (freiwillig). Vorausgefüllt aus OFF, wenn vorhanden. Die Person sieht deutlich:
  „Deine Angaben – nur für dich sichtbar“.
- Dieselbe Plausibilitätsprüfung wie bei OFF (Abschnitt 4). Unmögliche Werte (z. B. 120 g Fett je 100 g) lassen sich
  nicht speichern, Atwater-Abweichungen lösen die ruhige Rückfrage „Stimmen die Werte?“ aus (wie E2, keine Sperre).
- Bei „Zahlen aus“: Anlegen ist **nicht** möglich (man müsste Zahlen eintippen). Stattdessen der Hinweis „Trag das
  Produkt als Schnelleintrag ein oder schalte die Zahlen kurz ein“ (_Empfehlung,_ E4-G8). Vorhandene eigene Produkte
  bleiben eintragbar, ihre Werte sind ausgeblendet.
- Höchstens **200** eigene Produkte (Konstante `USER_FOOD_PRODUCT_LIMITS`, PRODUKTENTSCHEIDUNG).
- **Kein Hochladen zu OFF**, keine Weitergabe (CLAUDE.md „Kein Teilen“; E4-G7).
- **Kein Anlegen per Foto der Nährwerttabelle** (das wäre Texterkennung/KI und damit Premium; E4-G5).

### 2.4 Zuletzt, Favoriten, Bearbeiten

- **Zuletzt:** abgefragte und eingetragene Produkte erscheinen mit Name und Marke (eigene Abfrage, X0-konform; E4-G4).
  Ein Tipp trägt mit der zuletzt gewählten Menge ein. Die Werte kommen aus dem Zwischenspeicher bzw. eigenen Produkt.
  Fehlt der Speicher-Eintrag (nach 90 Tagen gelöscht), fragt die App neu ab (online) oder zeigt „Produkt neu abrufen“.
- **Favoriten:** Stern für Produkte, Schlüssel `product|<Nummer>` bzw. `own_product|<id>`. Gespeichert werden nur
  Verweis und Menge, **keine Werte**. Den Titel setzt der Server (wie E1 S1).
- **Bearbeiten** eines Eintrags: Menge, Mahlzeit, Tag – Regeln wie E2 H2 (`rebuildEntry`): gleiche Menge →
  Schnappschuss bleibt; Quelle vorhanden → neu aus der Quelle; sonst verhältnisgleich aus dem Schnappschuss.
- **Katalog-Suche** („Suche“ auf „Eintragen“) zeigt **keine** OFF-Produkte und keine Marken. Eigene Produkte erscheinen
  dort in einem eigenen Abschnitt „Deine Produkte“ (_Empfehlung_; nur die eigenen).

---

## 3. Technik

### 3.1 Übersicht

```
App (Nummer/Kamera) ──POST {code}──▶ apps/web /api/ernaehrung/produkt (fra1)
                                        │ 1. Herkunft, Login, Einwilligung, Limits (DB-Funktion)
                                        │ 2. food_products (frisch?) ──ja──▶ Antwort
                                        │ 3. globaler OFF-Deckel ──▶ OFF v2 (User-Agent, 6 s)
                                        │ 4. Core: normalisieren + prüfen ──▶ food_products (upsert)
                                        ▼
                                     Antwort {status, product, check}
App „Eintragen“ ──▶ save_food_log_entries (source = product) ──▶ Werte aus food_products / user_food_products
```

### 3.2 Route `POST /api/ernaehrung/produkt` (`apps/web`)

Aufbau wie `POST /api/ernaehrung/foto` (E3): `runtime = 'nodejs'`, `preferredRegion = 'fra1'`, `maxDuration = 15`,
Logik in `apps/web/src/lib/food-product/` (`handler.ts`, `off-client.ts`, `config.ts`), die Fachlogik in
`packages/core`.

1. **Herkunft (CORS):** nur die eigene App (`APP_WEB_ORIGIN`, Produktionsadresse, Vorschauen nach dem Muster aus E3
   N1). Sonst 403.
2. **Konfiguration:** `OFF_CONTACT_EMAIL` gesetzt und Flag `food_product_lookup` in `private.feature_flags` an
   (Start **aus** wie `ai_food_photo`; für Live-Tests mit Testkonten einschalten, für alle erst nach der
   Rechtsprüfung, 6.2). Sonst `not_configured`.
3. **Login:** Bearer-Token wie E3 (`verifyUser` über `/auth/v1/user`), **bevor** der Körper gelesen wird (E3 M2).
4. **Körper:** höchstens 256 Byte, JSON strikt `{ code: string }` (Zod `productLookupRequestSchema` aus
   packages/core). Die **Nummer steht nie in der URL** (Vercel-Zugriffslogs speichern Pfad und Abfrage).
5. **Nummer prüfen** im Core (`normalizeBarcode`, Abschnitt 4.2): ungültig → `invalid_code`; Laden-/Waagencode,
   Buch, Zeitschrift → `not_food_code`. Beides ohne Abfrage und ohne Zählung beim globalen Deckel.
6. **Reservierung** in der Datenbank `food_product_lookup_reserve(p_user)` (nur `service_role`): Einwilligung
   `health_data` gültig (FOR SHARE), Advisory-Sperre je Person, **Limit je Person** 60 Abfragen pro Stunde und 200 pro
   Tag (Europe/Berlin), Zähler **ohne Nummer** (`private.food_product_lookup_counts`: user_id, Stunde, Anzahl;
   Aufbewahrung 2 Tage). Über dem Limit → `rate_limited` (Text: „Du hast heute sehr viele Produkte abgefragt – ab
   morgen geht es wieder. Eigene Produkte und die Suche gehen weiter.“).
7. **Zwischenspeicher lesen:** Zeile in `food_products` mit `retrieved_at` jünger als **30 Tage** → Antwort ohne
   OFF-Abfrage. Negative Treffer (`found = false`) gelten **1 Tag**.
8. **Globaler Deckel:** `private.off_request_reserve()` – höchstens **10 OFF-Abfragen pro Minute** für den ganzen
   Server (Zähler je Minute, Advisory-Sperre). Ist er voll und gibt es eine ältere Zeile im Speicher → die ältere
   Zeile mit Hinweis „Stand vom …“. Ohne Zeile → `unavailable` (zählt nicht gegen das Limit der Person).
9. **OFF-Abfrage** (`off-client.ts`): `GET https://world.openfoodfacts.org/api/v2/product/<code>?fields=…` mit
   **nur** diesen Kopfzeilen: `User-Agent: Alpha5/<Version> (<OFF_CONTACT_EMAIL>)`, `Accept: application/json`.
   **Keine** Nutzer-ID, kein Token, kein Cookie, keine weitergeleitete IP (`X-Forwarded-For` wird nicht gesetzt),
   kein Referer. **Zeitlimit 6 s**, keine Weiterleitungen auf fremde Hosts (`redirect: 'error'`), Antwort höchstens
   512 KB (gestreamt mit Byte-Limit wie E3 N2), nur `application/json`. HTTP 429/503 → `unavailable` und **5 Minuten
   Sperre** des globalen Deckels (Schutz vor einer IP-Sperre). Ein Fehler wird nicht wiederholt.
10. **Normalisieren und prüfen** im Core (`normalizeOffProduct` + `checkProductNutrients`, Abschnitt 4). Danach
    `food_product_upsert(...)` (nur `service_role`).
11. **Antwort** (Zod `productLookupResponseSchema`): `found` mit `product` (Nummer, Name, Marke, Packungsgröße,
    Bezug g/ml, Werte je 100, Portion, Quelle mit Lizenz und Abrufdatum) und `check` (`ok` | `review` | `blocked` +
    Gründe als Codes) · `not_found` · `invalid_code` · `not_food_code` · `rate_limited` · `unavailable` ·
    `not_configured` · `no_consent`.
12. **Logs:** nur feste Codes (`off_timeout`, `off_429`, `cache_hit` …), **nie** Nummer, Produktname, Nutzer-ID oder
    Token. Kein Analytics-Ereignis mit Produktbezug.

**Testmodus:** dieselbe Kette auf dem Gerät mit einer **Attrappe** (`mockOffLookup`: feste Beispielnummern für
gefunden/plausibel, auffällig, unbrauchbar, nicht gefunden, kJ als kcal, Getränk, Zeitlimit, 429). Die Werte sind
**ausgedachte Testwerte**, als solche markiert, keine OFF-Daten. Kein Netz.

### 3.3 Zwischenspeicher `food_products` (gemeinsam, ohne Personenbezug)

| Spalte                                                                           | Inhalt                                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `code` text PK                                                                   | normalisierte Nummer (8, 13 oder 14 Ziffern, Prüfziffer gültig; CHECK)                          |
| `found` boolean                                                                  | false = OFF kennt die Nummer nicht (negativer Treffer, 1 Tag)                                   |
| `off_fields` jsonb                                                               | **unveränderte** OFF-Antwort, nur die abgefragten Felder (≤ 16 KB, CHECK)                       |
| `name_de`, `brand_de`, `quantity_label`                                          | aus `off_fields` abgeleitet und bereinigt (4.1), höchstens 80/40/30 Zeichen                     |
| `base_unit` (`g`/`ml`)                                                           | Bezug der Werte                                                                                 |
| `kcal`, `protein_g`, `carbs_g`, `fat_g`                                          | je 100 g/ml nach Normalisierung (4.3); `null` wenn unbrauchbar                                  |
| `sugar_g`, `sat_fat_g`, `fiber_g`, `salt_g`                                      | je 100, optional                                                                                |
| `serving_g`, `package_g`                                                         | Portion bzw. Packung in g/ml, nur wenn plausibel                                                |
| `check_level` (`ok`/`review`/`blocked`), `check_reasons` text[]                  | Ergebnis der Core-Prüfung (Codes, CHECK-Liste = Core)                                           |
| `normalizer_version` int                                                         | Fassung der Normalisierung (ändert sich die Regel, wird bei der nächsten Abfrage neu gerechnet) |
| `source_db` = `'open_food_facts'`, `source_license` = `'ODbL-1.0'`, `source_url` | Quelle (fest, CHECK)                                                                            |
| `off_last_modified` timestamptz                                                  | `last_modified_t` von OFF                                                                       |
| `retrieved_at` timestamptz                                                       | Abrufzeitpunkt bei OFF                                                                          |

- **Kein Personenbezug:** keine `user_id`, kein „abgefragt von“, keine Abfrage-Zähler, kein „zuletzt abgefragt“. Damit
  ist die Tabelle selbst **kein Gesundheitsdatum** und keine personenbezogene Datei.
- **RLS an, keine Policy** für `anon`/`authenticated`: Niemand liest die Tabelle direkt (sonst könnte jede Person
  alle jemals abgefragten Nummern sehen und die ganze Sammlung herunterladen; das wäre auch lizenzrechtlich eine
  öffentliche Datenbank). Lesen und Schreiben nur über `service_role` bzw. `security definer`-Funktionen:
  `food_product_upsert` (Route), `private.food_product_values(code)` (für `save_food_log_entries` und den
  Favoriten-Trigger).
- **Ablauf:** auffrischen nach **30 Tagen** (bei der nächsten Abfrage), **löschen nach 90 Tagen** ohne Auffrischung
  (aufgeräumt in `food_product_lookup_reserve`, höchstens 500 Zeilen je Aufruf; dazu ein Schritt im bestehenden
  Aufräum-Muster). Negative Treffer nach 1 Tag. Eine Zeile, auf die Tagebuch-Einträge zeigen, darf trotzdem gelöscht
  werden: Das Tagebuch hat einen eigenen Schnappschuss (kein Fremdschlüssel, 3.5).
- **Getrennt vom BLS-Katalog:** eigene Tabelle, eigener Code-Pfad. OFF-Werte gelangen **nie** in `content/foods/`,
  `foods`, Rezepte, Essenspläne, Einkaufslisten, Meal-Prep, Austausch-Vorschläge, Ratgeber oder PDFs des Essensplans.
  `foods-import`/`sources-integrity` bleiben unberührt. db-sync prüft: Keine Migration verknüpft `food_products` mit
  `foods`/`recipes`. Die Regel „Nährwerte nie von Hand/KI“ gilt weiter für **unseren** Katalog. OFF-Werte sind
  Fremdangaben mit Quellenangabe, eigene Produkte sind Angaben der Person (wie der Schnelleintrag).

### 3.4 Eigene Produkte `user_food_products` (nur für die Person)

- Spalten: `id` uuid, `user_id` → `auth.users` **on delete cascade**, `name_de` (1–60, gleiche Zeichenregeln wie
  `custom_meals`, E2 H1), `brand_de` (0–40, gleiche Regeln), `code` (optional, Prüfziffer), `base_unit`, `kcal`,
  `protein_g`, `carbs_g`, `fat_g` (Pflicht), `sugar_g`, `salt_g` (optional), `serving_g` (optional), `based_on_off`
  boolean (vorausgefüllt aus OFF, nur Merker), `revision`, `created_at`, `updated_at`. Grenzen wie Zod
  (`userFoodProductSchema`): kcal 0–900, Makros 0–100 je 100 (Summe ≤ 100 + Toleranz, 4.4).
- **RLS:** nur eigene Zeilen lesen; kein direktes Schreiben. `save_user_food_product(p jsonb)` und
  `delete_user_food_product(p_id)` (security definer, `search_path = ''`, REVOKE public/anon), Reihenfolge wie E2:
  Einwilligung `health_data` FOR SHARE → Advisory-Sperre der Person → Zeilen. Antwort `saved` · `conflict` ·
  `rejected` (`invalid` | `limit`), ohne Name oder Werte in Meldungen. Löschen geht immer, auch ohne Einwilligung.
- **Freitext:** Name und Marke sind Freitext. Deshalb gilt wie bei E2-G1: nur mit Einwilligung, **beim Widerruf
  gelöscht**, nie im Tagebuch-Titel (fester Titel „Eigenes Produkt“ + Verweis), nie in Logs, Fehlermeldungen oder
  testIDs.
- Eigene Produkte fließen **nie** in `food_products` (keine Vermischung, kein Personenbezug im gemeinsamen Speicher).

### 3.5 Tagebuch: Herkunft `product`

- `FOOD_LOG_SOURCES` + `product`. Neue Spalten in `food_log_entries`: `product_code` text (CHECK Format) und
  `user_product_id` uuid mit FK `(user_product_id, user_id)` → `user_food_products` **on delete set null
  (user_product_id)**. **Kein** Fremdschlüssel auf `food_products` (Zwischenspeicher darf ablaufen).
- **Form-CHECK `product`:** `food_id`/`recipe_id`/`portion` leer, `amount` + `unit in ('g','ml')`, alle vier Werte
  gesetzt; genau eins von `product_code` / `user_product_id` (nach dem Löschen eines eigenen Produkts sind beide leer
  erlaubt: Titel „Eigenes Produkt“). Titel: bei OFF-Produkten **vom Server** aus `food_products` (`name_de` + „ · “ +
  `brand_de`, ≤ 100 Zeichen), bei eigenen Produkten fest **„Eigenes Produkt“**.
- **Server rechnet nach** (`private.food_log_server_values`, neueste Fassung als echte Obermenge wie in E2/E3):
  - OFF-Produkt: Zeile in `food_products` vorhanden, `found`, `check_level <> 'blocked'` → Werte = je 100 ×
    Menge / 100, gerundet mit `private.js_round`/`js_round1` (gleiche Rechnung wie der Core, Kreuzvergleich im Harness).
    Fehlt die Zeile (abgelaufen) oder ist sie gesperrt → **neuer** Eintrag `rejected`/`product_unavailable`. Die App
    behält ihn lokal mit Hinweis („Produkt neu abrufen“, E1 G3) und fragt beim nächsten Online-Sein neu ab.
    **Ändern** eines vorhandenen Eintrags ohne Zeile → verhältnisgleich aus dem Schnappschuss (E2 S1/H2).
  - Eigenes Produkt: Werte aus `user_food_products` (FOR KEY SHARE). Fremdes oder gelöschtes Produkt → Verweis leer,
    Titel „Eigenes Produkt“, Gerätewerte nur nach `food_log_device_values_ok` (wie E2 Runde 2 S1).
  - Mengen-Grenze 2.000 g/ml und 3.000 kcal je Eintrag wie bisher (CHECKs).
- **Favoriten:** `food_log_favorites` + Herkunft `product` mit Schlüssel `product|<code>` bzw. `own_product|<id>`.
  Der Trigger setzt den Titel aus `food_products` bzw. „Eigenes Produkt“ und speichert keine Werte. **Beim Widerruf
  gelöscht** (verraten Marken und Konsum; strenger als A-G14, wie die Schnell-Favoriten; E4-G10).
- `rebuildEntry`, `entryFromProduct(product, amount, unit)`, `entryFromUserProduct(...)` im Core. Der Testmodus rechnet
  mit derselben Funktion (`checkFoodLogSave`).

### 3.6 Export, Löschen, Widerruf

- **Export** (`export_my_data`, neueste Fassung als Obermenge): `user_food_products`, Tagebuch-Einträge mit
  `product_code`/`user_product_id`, Produkt-Favoriten. Der gemeinsame Zwischenspeicher gehört niemandem und kommt
  nicht in den Export. Die Zähler `food_product_lookup_counts` der Person kommen mit Zeitraum und Anzahl hinein
  (ohne Nummern, es gibt keine). `DATA_EXPORT_TABLES` + `user_food_products`, `food_product_lookup_counts`.
- **Konto löschen:** Kaskade über `user_id` (eigene Produkte, Zähler, Tagebuch, Favoriten). `food_products` enthält
  nichts von der Person.
- **Widerruf `health_data`** (`private.consents_after_revoke`, neueste Fassung + Obermenge): löscht wie bisher alle
  Tagebuch-Einträge, dazu **eigene Produkte** und **Produkt-Favoriten**. Der Dialogtext wird ergänzt („… samt eigenen
  Gerichten, eigenen Produkten und Produkt-Favoriten …“).
- **Nächste Fassung des Einwilligungstexts `health_data`** nennt „Produkte, die du per Nummer oder Barcode abfragst,
  und eigene Produkte“. Sie ist ohnehin für N7 Teil 2 offen (E1 Präzisierung 14, E2 Präzisierung 11) – vor dem
  Livegang juristisch prüfen.

---

## 4. Plausibilitätsprüfung im Core (`packages/core/src/nutrition/food-product.ts`)

Alle Grenzen in `constants.ts` als `FOOD_PRODUCT_CHECK` mit Quelle bzw. „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH
PRÜFEN“. Dieselbe Funktion prüft OFF-Produkte und eigene Produkte. Die Grenzen stehen gleich im SQL (db-sync).

### 4.1 Texte aus OFF bereinigen (`sanitizeOffText`)

Crowd-Daten sind **unvertrauenswürdige Eingaben**: Steuerzeichen, Zero-Width-/Bidi-Zeichen (Klassen aus E2 H1), HTML/
Markup und Links entfernen, Leerraum zusammenfassen, Name ≤ 80, Marke ≤ 40 (erste Angabe vor dem Komma), Packung ≤ 30
Zeichen. Leer → „Produkt ohne Namen“. Anzeige immer als reiner Text.

### 4.2 Nummer prüfen (`normalizeBarcode`)

- Nur Ziffern (Leerzeichen/Bindestriche entfernt), Länge **8** (EAN-8), **12** (UPC-A → mit führender 0 auf 13
  ergänzt), **13** (EAN-13) oder **14** (GTIN-14), **Prüfziffer nach GS1 (Modulo 10)**. UPC-E (6/8 Ziffern) wird nur
  über die Kamera geliefert und auf UPC-A erweitert (E4b).
- **Kein Lebensmittel bzw. nur im Laden gültig:** Präfix `02`, `20`–`29` (Laden-/Waagencodes mit Preis/Gewicht),
  `977` (Zeitschriften), `978`/`979` (Bücher), `98`/`99` (Gutscheine) → `not_food_code`, **keine Abfrage**.
- Grenzfälle: 7/9/11/15 Ziffern, falsche Prüfziffer, nur Nullen, führende Nullen bei EAN-8 vs. UPC, Buchstaben,
  Emoji, 1.000 Zeichen.

### 4.3 Normalisieren (`normalizeOffProduct`)

- Werte nur aus den `_100g`-Feldern. Fehlt `_100g`, aber `_serving` und eine plausible `serving_quantity` sind da →
  umrechnen und Grund `from_serving` (wird „Werte prüfen“). Nur zubereitete Werte (`*_prepared_100g`) → `blocked`
  (`prepared_only`: „Die Werte gelten nur für das zubereitete Produkt“).
- **kcal fehlt, kJ vorhanden** → kcal = kJ / 4,184 (LMIV Anhang XIV: 1 kcal = 4,184 kJ), Grund `kcal_from_kj`.
- **Salz fehlt, Natrium vorhanden** → Salz = Natrium × 2,5 (LMIV Anhang I Nr. 11).
- **Alkohol:** OFF `alcohol_100g` in % vol → g je 100 ml = % vol × 0,789 (Dichte Ethanol). Nur für die Atwater-
  Prüfung (7 kcal/g), nicht angezeigt. Beim Bau prüfen, ob das Feld wirklich % vol ist.
- `_modifier` „<“ (z. B. „< 0,5 g“) → Wert übernehmen, Grund `upper_bound` (kein Einfluss auf die Stufe).
- Einheiten: Bezug `ml`, wenn `product_quantity_unit` bzw. `quantity` auf ml/cl/l lautet, sonst `g`. Unklar → `g` mit
  Grund `unit_assumed`.
- Rundung wie Tagebuch: kcal ganz, Makros 1 Nachkommastelle (`js_round`).
- Diese Umrechnungen sind die einzigen „Änderungen“ an OFF-Daten. Sie stehen als Methode auf der Seite „Lizenzen“
  (ODbL 4.6 b, Abschnitt 6.2).

### 4.4 Prüfstufen (`checkProductNutrients` → `ok` | `review` | `blocked`)

**`blocked` – Eintragen aus OFF gesperrt, „Eigenes Produkt anlegen“ angeboten** (physikalisch unmöglich oder nicht
nutzbar):

- kcal **und** kJ fehlen, oder einer von Eiweiß/Kohlenhydrate/Fett fehlt (das Tagebuch braucht alle vier, E1-Form).
  _Alternative,_ E4-G3: fehlende Makros als 0 mit „Werte prüfen“. _Empfehlung:_ **sperren**, denn eine stille 0
  verfälscht die Tagessumme.
- ein Wert negativ, `NaN`, unendlich oder kein Zahlwert.
- kcal > **905** je 100 (reines Fett = 900 + Rundung).
- ein Makro > 100 g je 100, Salz > 100, Summe Eiweiß + Kohlenhydrate + Fett + Ballaststoffe + Salz > **102** g je 100
  g (Rundung der Packungsangaben; bei ml-Bezug > 110, weil Sirup und Öl schwerer als Wasser sind).
- **kJ als kcal eingetragen:** kcal und kJ angegeben und kJ/kcal < 3,8 (z. B. „1.500 kcal / 1.500 kJ“) oder > 4,6.
- nur zubereitete Werte (`prepared_only`).

**`review` – „Werte prüfen“, Eintragen erst nach Bestätigung „Ich habe die Werte mit der Packung verglichen“:**

- **Atwater:** 4 · Eiweiß + 4 · (Kohlenhydrate − Polyole) + 2,4 · Polyole + 9 · Fett + 2 · Ballaststoffe + 7 ·
  Alkohol(g) weicht um mehr als **20 %** (mindestens **±10 kcal** absolut) von kcal ab. Faktoren aus
  `RECIPE_CHECK_LIMITS.atwater` (LMIV Anhang XIV). Die Toleranz ist weiter als R4 (15 %), weil Packungen gerundet
  deklariert werden. Fehlen Ballaststoffe, nur Abweichung nach oben prüfen (Ballaststoffe können die Lücke erklären).
- kcal aus kJ umgerechnet (`kcal_from_kj`), aus Portion umgerechnet (`from_serving`), Einheit angenommen
  (`unit_assumed`).
- Zucker > Kohlenhydrate + 0,5 g; gesättigte Fettsäuren > Fett + 0,5 g.
- Portion (`serving_quantity`) außerhalb 1–2.000 → Portionsknopf entfällt, Grund `serving_ignored` (keine Stufe).

**`ok`:** keine der Bedingungen.

**Nur Hinweis, keine Stufe:** OFF-Stand älter als 3 Jahre (`off_last_modified`) → „Angaben vom …“.

**Gerät und Server gleich:** Die Route speichert `check_level`/`check_reasons`. `save_food_log_entries` lehnt
`blocked` ab. Die Bestätigung bei `review` ist Bedienung auf dem Gerät; der Server prüft sie nicht (keine
Integritätsfrage, die Werte rechnet er ohnehin selbst).

### 4.5 Grenzfälle (Unit-Tests, je mit Testwerten, nicht mit echten OFF-Daten)

Wasser (0 / 0 / 0 / 0 → `ok`, absMin), Mineralwasser je 100 ml, Rapsöl (900 kcal, 100 g Fett → `ok`), 906 kcal →
`blocked`, Butter (741 kcal, 83 g Fett, 0,7 g Eiweiß), Cola light (0,3 kcal), Zuckerfreier Kaugummi mit 60 g Polyolen
(mit Polyol-Feld `ok`, ohne `review`), Bier 5 % vol (Alkohol erklärt die kcal), Proteinpulver (380 kcal, 80 g Eiweiß),
Haferflocken mit fehlenden Ballaststoffen, kJ = kcal (`blocked`), nur kJ (Umrechnung + `review`), nur Natrium,
Nur-Portion-Werte mit/ohne `serving_quantity`, Suppenpulver nur zubereitet (`blocked`), Makro-Summe 102/103 g, Sirup
je 100 ml (Summe 105 → `ok` bei ml), „< 0,5“, negative Werte, Zeichenketten statt Zahlen, leerer Name, Name mit
HTML/Bidi/Emoji/500 Zeichen, Marke „A, B, C“, Packung 5 kg (kein „ganze Packung“), Portion 0 g/2.001 g, Zucker >
Kohlenhydrate, eigenes Produkt mit 120 g Fett (nicht speicherbar), Menge 2.000/2.001 g, 3.000-kcal-Grenze je Eintrag
(Öl 334 g → 3.006 kcal → abgelehnt), „Zahlen aus“ ohne kcal in Ergebnis und Hinweisen.

---

## 5. Kamera (E4b)

### 5.1 Handy-Browser (Vercel-Vorschau, euer Haupt-Testweg)

- Feature-Erkennung: `'BarcodeDetector' in window` und `getSupportedFormats()` enthält `ean_13`. Dann Knopf „Mit der
  Kamera scannen“: `getUserMedia({ video: { facingMode: 'environment' } })`, Vorschau im Bildschirm, `detect()` alle
  ~200 ms, erster gültiger Code (Prüfziffer!) beendet die Kamera sofort. Bilder werden **nie gespeichert oder
  gesendet**, nur die Ziffern.
- **iPhone (Safari) und Firefox:** keine Schnittstelle. _Empfehlung_ für E4b: Polyfill auf ZXing-WASM-Basis
  (npm-Paket, genaue Version beim Bau, ~1 MB, nur nachgeladen, wenn der Knopf gedrückt wird). _Alternative:_ auf diesen
  Browsern nur „Nummer eintippen“ (E4-G1).
- Kamera verweigert → „Ohne Kamera-Erlaubnis kannst du die Nummer eintippen“ + Hinweis, wo man die Erlaubnis im
  Browser ändert.

### 5.2 App (iPhone/Android)

- `expo-camera` (Version passend zu SDK 57 über `npx expo install`, in der Bau-Sitzung per Workflow bzw. Lockfile),
  `CameraView` mit `barcodeScannerSettings: { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }`, Config-Plugin in
  `app.config.ts` mit deutschem Text: **„Alpha5 nutzt die Kamera nur, um den Strichcode von Lebensmitteln zu lesen.
  Es werden keine Fotos gespeichert.“** Android: `CAMERA`. Kein Mikrofon (`recordAudioAndroid: false`). Der Kommentar
  „Keine NS…UsageDescription-Texte“ in `app.config.ts` wird angepasst, das Datenschutz-Manifest geprüft (Kamera ist
  keine „Required Reason API“; App-Store-Angabe „Kamera“ ergänzen).
- **Neuer EAS-Build nötig:** Ein natives Modul kommt nur über einen neuen Build ins Gerät (Workflow `eas-build.yml`,
  „Run workflow“ in der GitHub-App, Android-APK + iOS/TestFlight). Ohne neuen Build: Die App prüft beim Start, ob das
  native Modul vorhanden ist (`requireOptionalNativeModule`). Fehlt es (alter Build), zeigt sie nur „Nummer eintippen“.
  So stürzt keine ältere App ab. **E4a braucht keinen neuen Build.**
- Sinnvoll: E4b zusammen mit E3-G1 (`expo-image-picker`/`expo-image-manipulator`) in **einem** Build, damit ihr nur
  einmal neu installieren müsst.

---

## 6. Lizenz und Impressum

### 6.1 Pflicht-Angaben (Empfehlung, Wortlaut juristisch prüfen)

- **Produktansicht** (2.2): „Produktdaten: Open Food Facts (openfoodfacts.org), Lizenz ODbL 1.0 · abgerufen am … ·
  Angaben ohne Gewähr.“
- **Neue Seite „Lizenzen und Quellen“** in der App (Einstellungen → „Lizenzen und Quellen“, `lizenzen.tsx`) und auf der
  Website (`apps/web`, `/lizenzen`, verlinkt aus dem Impressum). Sie gibt es heute noch nicht; die BLS-Angabe steht
  bisher nur an Rezepten und im PDF. Inhalt:
  - BLS 4.0, Max Rubner-Institut, CC BY 4.0 (bestehender Text aus `nutrientSourcesText`).
  - **Open Food Facts:** „Diese App enthält Informationen aus Open Food Facts (openfoodfacts.org), die unter der Open
    Database License (ODbL 1.0, opendatacommons.org/licenses/odbl/1-0/) bereitgestellt werden. Einzelne Inhalte
    stehen unter der Database Contents License (DbCL 1.0, opendatacommons.org/licenses/dbcl/1-0/).“ (Wortlaut nach
    dem Muster-Hinweis in ODbL 4.3.)
  - **Methode der Änderungen** (ODbL 4.6 b): „Wir übernehmen die Werte je 100 g/ml unverändert und rechnen nur so um:
    kJ → kcal (÷ 4,184), Natrium → Salz (× 2,5), Portionswerte → je 100 g, Runden auf ganze kcal und 0,1 g; Texte
    werden gekürzt und von Steuerzeichen bereinigt. Die Original-Daten erhältst du bei Open Food Facts
    (world.openfoodfacts.org/data).“
  - Keine Produktbilder (deshalb kein CC-BY-SA-Hinweis nötig; kommt dazu, falls Bilder je kommen).
- **Datenschutzerklärung** (`apps/web` `/datenschutz`): Abschnitt „Produktabfrage“ – was an OFF geht (nur die Nummer
  von unserem Server), was wir speichern (gemeinsamer Speicher ohne Personenbezug; Tagebuch, eigene Produkte unter
  `health_data`). Text juristisch prüfen.

### 6.2 Ist unser Zwischenspeicher eine „abgeleitete Datenbank“?

- **Einschätzung (keine Rechtsberatung):** Ein gemeinsamer Speicher, der mit der Zeit viele OFF-Produkte sammelt und
  normalisierte Spalten enthält, ist **wahrscheinlich eine abgeleitete Datenbank** (Auszug + Umrechnung). Er wird aber
  **nicht öffentlich genutzt**: Niemand kann ihn lesen oder herunterladen (3.3). Öffentlich sind nur **einzelne
  Produkt-Ansichten** (Produced Works, je ein Produkt, kein Herausziehen der Datenbank möglich). Daraus folgt nach
  ODbL 4.6: Wir müssen den Empfängern **die ganze abgeleitete Datenbank oder die Beschreibung der Änderungen**
  anbieten. Die Beschreibung der Methode (6.1) ist die schlanke Lösung. Share-Alike (4.4) greift erst, wenn wir die
  Datenbank selbst öffentlich machen. Das tun wir nicht.
- **Was wir deshalb vermeiden:**
  1. OFF-Daten **nie mit dem BLS-Katalog oder eigenen Inhalten vermischen** (sonst wäre die gemischte Datenbank
     offen zu legen, laut OFF-Support).
  2. Keine öffentliche Liste/Suche über den Speicher (keine „Produkt-Suche“ über alle Abfragen; die OFF-Suche selbst
     nutzen wir in E4 auch nicht).
  3. **Eigene Produkte der Personen nie in den gemeinsamen Speicher** (das wären eigene Zusätze; außerdem
     personenbezogen).
  4. Kurze Lebensdauer (30/90 Tage), nur benötigte Felder, `off_fields` unverändert daneben.
- **Ein Speicher je Person** würde lizenzrechtlich wenig ändern (jede Ansicht bleibt ein Produced Work), aber das
  OFF-Kontingent schneller verbrauchen und Gesundheits-Konsumdaten pro Person sammeln. _Empfehlung:_ **gemeinsam,
  ohne Personenbezug** (E4-G2).
- **Gründer-Aufgabe vor dem Livegang:** Rechtsprüfung durch eine Fachanwältin oder einen Fachanwalt für IT-/Urheberrecht
  (ODbL 4.3/4.4/4.6, Wortlaut der Hinweise, Datenschutzerklärung, nächste Fassung des Einwilligungstexts). Bis dahin: E4 nur
  im Testmodus und für Live-Tests mit Testkonten; das Flag `food_product_lookup` bleibt für alle anderen **aus**.

### 6.3 Später: Export-Import statt Live-Abfrage

Reicht das Kontingent nicht mehr, wäre ein Import des OFF-Exports (nur DACH-Produkte) möglich. Dann wäre die
Datenbank eindeutig abgeleitet. Bei öffentlicher Nutzung als Suche würde Share-Alike greifen. Eigene Etappe mit eigener
Rechtsprüfung, nicht Teil von E4.

---

## 7. Datenschutz (DSGVO)

- **Art. 9?** Die einzelne Barcode-Abfrage ist für sich kein Gesundheitsdatum, aber zusammen mit dem Tagebuch lassen
  sich Rückschlüsse auf Gesundheit und Essverhalten ziehen (glutenfrei, Diabetiker-, Schwangerschaftsprodukte).
  Deshalb wie A-G12 **vorsorglich Art. 9**: Abfrage, Eintragen und eigene Produkte nur mit gültiger Einwilligung
  `health_data` (E4-G12). Tagebuch-Einträge `product` fallen ohnehin unter `health_data`.
- **Datenminimierung:** OFF bekommt **nur** die Nummer, von der Server-IP, mit unserem User-Agent. Keine Nutzer-ID,
  kein Token, kein Cookie, keine Weiterleitung der Personen-IP, kein Referer. In Logs keine Nummern. Zähler ohne
  Nummern. Gemeinsamer Speicher ohne Personenbezug. Keine Bilder von OFF in der App (die würden die IP der Person an
  OFF senden). Der Link „Bei Open Food Facts ansehen“ geht erst nach dem Hinweis auf (2.2).
- **Ist OFF Empfänger personenbezogener Daten?** Nein, wenn nur die Nummer ohne Personenbezug von unserem Server kommt.
  Deshalb ist kein Auftragsverarbeitungsvertrag nötig. Trotzdem gehört OFF in die Datenschutzerklärung (Transparenz).
  Juristisch bestätigen lassen (6.2).
- **Nicht an Analytics/Werbung/Affiliate:** keine Produkt-Ereignisse, keine Marken in Statistiken. Marken lösen nie
  Affiliate-Links aus (CLAUDE.md „Affiliate“).
- **Rechte der Person:** Export (3.6), Löschen (Kaskade), Widerruf (3.6), eigene Produkte jederzeit löschbar.
- **Offline-Speicher:** Produktdaten, die die App für Einträge braucht, liegen in der bestehenden verschlüsselten
  Ernährungs-Warteschlange (N7 Teil 2), nicht offen im Gerätespeicher.

---

## 8. Migrationen, Tests, Gegenproben, DoD, Handy-Test

### 8.1 Migrationen (rein additiv, Zeitstempel ab `20261016200000`)

1. `20261016200000_food_products.sql` – `food_products` (3.3, RLS ohne Policy, CHECKs inkl. Grund-Codes und Quelle),
   `private.food_product_lookup_counts`, `private.off_request_budget` (Minute, Anzahl, Sperre bis), Flag
   `food_product_lookup` in `private.feature_flags`, Funktionen `food_product_lookup_reserve(p_user)`,
   `private.off_request_reserve()`, `private.off_request_backoff()`, `food_product_upsert(p jsonb)` (alle nur
   `service_role`, security definer, `search_path = ''`), Aufräumen 1/30/90 Tage.
2. `20261016200100_user_food_products.sql` – `user_food_products` (3.4), RLS, `save_user_food_product`,
   `delete_user_food_product`.
3. `20261016200200_food_log_product.sql` – Herkunft `product`, Spalten `product_code`/`user_product_id` + FK, Form-
   CHECK, `food_log_favorites` + `product`/`own_product`, Trigger-Titel, `save_food_log_entries` und
   `private.food_log_server_values` als **echte Obermenge** der neuesten Fassung (`20261016160200_food_log_photo.sql`).
4. `20261016200300_food_product_revoke_export.sql` – `private.consents_after_revoke()` und `export_my_data()` als
   Obermenge der neuesten Fassungen (+ eigene Produkte, Produkt-Favoriten, Zähler).

`database.types.ts` über den Workflow `db-types`, Migrationen über `db-migrate` beim Merge.

### 8.2 Tests

- **Core** `food-product.test.ts`: alle Grenzfälle aus 4.2 und 4.5; `normalizeOffProduct` mit zehn festen
  OFF-förmigen Testantworten (ausgedachte Werte); `sanitizeOffText`; `entryFromProduct`/`rebuildEntry`;
  Zod-Schemas strikt; **Eigenschaftstest** (3.000 zufällige Werte-Sätze: `blocked` nie mit physikalisch möglichen
  Werten innerhalb der Grenzen, Eintrag nie über 3.000 kcal, „Zahlen aus“ nie mit kcal). `db-sync.test.ts`: CHECK-
  Listen = Core (Herkunft, Grund-Codes, Prüfstufen, Grenzen), Limits SQL = Core, Spalten von `food_products` ohne
  `user_id`, keine Verknüpfung mit `foods`, Export- und Widerrufs-Obermenge.
- **Web** `food-product/handler.test.ts` (Ersatz-`fetch`, globales `fetch` gesperrt): CORS, Login vor dem Körper,
  Körper > 256 Byte, Nummer in der URL wird ignoriert, ungültige Nummer/Ladencode ohne OFF-Anfrage, Einwilligung,
  Limits je Person, globaler Deckel, Speicher frisch/alt/negativ, 429/503 → Sperre 5 Min., Zeitlimit 6 s,
  Weiterleitung, Antwort > 512 KB, falscher Content-Type, kaputtes JSON, **Kopfzeilen an OFF genau
  User-Agent + Accept** (keine Nutzer-ID, kein Token, kein X-Forwarded-For), Logs ohne Nummer/Name/ID,
  `not_configured` ohne Kontaktadresse.
- **App** `food-product.test.ts`: Testmodus-Kette mit Attrappe, eigenes Produkt zuerst, Eintragen `product`, eigenes
  Produkt anlegen/ändern/löschen/200, Widerruf löscht eigene Produkte und Produkt-Favoriten, Export-Spalten, Konto
  löschen, ungültiger Gerätespeicher, abgelehnter Eintrag (`product_unavailable`) bleibt lokal.
- **pgTAP** `39_food_products.test.sql` (Rechte: `authenticated` liest nichts, nur `service_role` ruft; Limits Stunde/
  Tag Berlin; globaler Deckel 10/11; Sperre nach 429; Aufräumen 1/30/90 Tage; CHECKs), `40_user_food_products.test.sql`
  (Isolation, Grenzen, Zeichenregeln, 200/201, Sperr-Reihenfolge, Löschen ohne Einwilligung, Widerruf, Export,
  Kaskade), `41_food_log_product.test.sql` (Werte vom Server statt vom Gerät, `blocked` abgelehnt, fehlende Zeile →
  `product_unavailable`, Ändern aus Schnappschuss, Titel vom Server, fester Titel „Eigenes Produkt“, fremder Verweis,
  2.000 g/ml, 3.000 kcal, Favoriten-Trigger ohne Werte, Widerruf, Export). Plus Anpassungen 01/17 (Export-Zählung).
- **Harness** (zwei Verbindungen): gleichzeitige Abfragen beim 60. Limit → genau eine; Widerruf während
  `save_user_food_product` wartet und löscht danach; Kreuzvergleich Core ↔ SQL für Produkt-Einträge (≥ 2.000
  Zufallsfälle, 0 Abweichungen).
- **Playwright** (Testmodus, Handy-Ansicht) `food-product.spec.ts`: Nummer → gefunden → 1 Portion → eintragen →
  Tagessumme; „Werte prüfen“ erst nach Haken; unbrauchbar → eigenes Produkt vorausgefüllt; nicht gefunden → eigenes
  Produkt → eintragen; Ladencode; offline; „Zahlen aus“ (kein „kcal“ im ganzen DOM inkl. testIDs); keine Marke/kein
  Name in testIDs; Quellenangabe sichtbar; Seite „Lizenzen und Quellen“. E4b zusätzlich: Kamera-Knopf nur mit
  `BarcodeDetector` (Ersatz-Objekt im Test), Kamera verweigert.

### 8.3 Gegenproben (absichtlich brechen → rot → zurücksetzen)

Core: Prüfziffer ignoriert, Ladencode abgefragt, kcal > 905 erlaubt, kJ = kcal nicht erkannt, fehlende Makros als 0,
Atwater-Toleranz 100 %, Markup nicht entfernt, kcal trotz „Zahlen aus“. Web: Nutzer-ID im OFF-Aufruf, Nummer im Log,
Körper vor Login gelesen, Zeitlimit entfernt, globaler Deckel übergangen, 429 ohne Sperre. pgTAP: `authenticated`
darf `food_products` lesen, `user_id`-Spalte im Speicher, Werte vom Gerät übernommen, `blocked` gespeichert, eigenes
Produkt einer anderen Person nutzbar, Widerruf ohne Löschen eigener Produkte/Produkt-Favoriten, Export ohne eigene
Produkte, RLS `using (true)`, Limit 61, FOR SHARE entfernt. Harness: ohne Advisory-Sperre zwei Abfragen über dem Limit.
Playwright: Marke in einer testID, Quellenangabe entfernt.

### 8.4 Definition of Done (je Etappe, wie PLAN-AUSWERTUNG 12)

1. Typen + Zod (`productLookupRequestSchema`, `productLookupResponseSchema`, `userFoodProductSchema`, Herkunft
   `product` in `foodLogPayloadEntrySchema`).
2. Migrationen additiv mit RLS und pgTAP (`db-test` grün).
3. Core-Logik mit Tests und Grenzfällen, Grenzen in `constants.ts` (`OPEN_FOOD_FACTS`, `FOOD_PRODUCT_CHECK`,
   `FOOD_PRODUCT_LOOKUP_LIMITS`, `USER_FOOD_PRODUCT_LIMITS`) mit Quelle bzw. PRODUKTENTSCHEIDUNG.
4. UI mobil + Web-Export, Playwright im Testmodus.
5. Lade-, Leer-, Fehler-, Offline- und Limit-Zustände (2.1).
6. Texte Deutsch in `i18n/de-nutrition.ts`, Screenshots hell/dunkel.
7. Doku: Umsetzungsstand in diesem Plan, `PLAN-AUSWERTUNG.md` Abschnitt 10, KONZEPT 6.1, PLAN-PHASE-5 13 (X1 → E4),
   HANDY-ANLEITUNG, SETUP (Vercel-Variable `OFF_CONTACT_EMAIL`), `.env.example`.
8. Seite „Lizenzen und Quellen“ (App + Web), Datenschutzerklärung-Abschnitt (Entwurf), Feature-Flag in Produktion aus
   bis zur Rechtsprüfung.
9. Pull Request mit deutscher Zusammenfassung und „So testest du es am Handy“; Wächter-Prüfung.

### 8.5 So testet ihr es am Handy

**Einmalig (E4a, Klick-Schritte im mobilen Browser):**

1. vercel.com öffnen → Projekt **„Web“** → **Settings** → **Environment Variables**.
2. **Add New** → Name `OFF_CONTACT_EMAIL`, Wert: eure Kontakt-Adresse (z. B. `kontakt@…`, keine private Adresse) →
   Umgebungen **Preview** (und später Production) → **Save**.
3. Im Pull Request auf „Redeploy“ der Vorschau warten (oder neuen Commit abwarten).

**Testmodus (ohne Konto, ohne Netz zu OFF):**

1. Vorschau-Link der App öffnen → Testmodus → Ernährung → „Eintragen“ → „Produkt (Barcode)“.
2. Beispielnummer aus der Liste „Testnummern“ eintippen (im Testmodus angezeigt) → Produkt erscheint → „1 Portion“ →
   „Eintragen“ → Tagessumme stimmt.
3. Testnummer „Werte prüfen“ → Eintragen erst nach dem Haken. Testnummer „unbrauchbar“ → „Eigenes Produkt anlegen“
   ist vorausgefüllt.
4. Eine erfundene Nummer mit falscher Prüfziffer → Hinweis „Die Nummer stimmt nicht“.
5. Flugmodus an → Hinweis „brauchst du Internet“; eigene Produkte gehen trotzdem.

**Mit Testkonto (Supabase-Modus, echte OFF-Abfrage):**

1. Eine Packung aus dem Schrank nehmen, die 13 Ziffern unter dem Strichcode eintippen → Name, Marke und Werte mit der
   Packung vergleichen → eintragen.
2. Dieselbe Nummer noch einmal → kommt sofort (Zwischenspeicher).
3. Einstellungen → „Lizenzen und Quellen“ → Open-Food-Facts-Hinweis steht da.
4. Einstellungen → Gesundheits-Einwilligung widerrufen → eigene Produkte und Produkt-Favoriten sind weg.

**E4b (Kamera):** Android/Chrome-Vorschau → „Mit der Kamera scannen“ → Strichcode vor die Kamera → Produkt erscheint.
iPhone/Safari: mit Polyfill gleich, sonst nur Nummer. App: neuen Build über GitHub-App → Actions → `eas-build` → „Run
workflow“ → APK installieren bzw. TestFlight → Kamera-Erlaubnis → scannen.

### Umsetzungsstand E4a (17.10.2026)

**Umgesetzt** (Branch `claude/e4a-produkt`): Nummer unter dem Strichcode eintippen → Abfrage über unseren Server bei
Open Food Facts → Produktansicht → Menge → Eintragen (Herkunft `product`). Noch **ohne Kamera** und ohne neue native
Abhängigkeit (E4b). Gebaut nach der **dokumentierten** API-Form v2 – aus der Entwicklungsumgebung war
openfoodfacts.org gesperrt; alle Feldnamen sind in `OPEN_FOOD_FACTS` als **„VOR LIVEGANG PRÜFEN“** markiert, getestet
wird ausschließlich mit Attrappen (kein echter Netzaufruf in Tests und CI, globales `fetch` in Tests gesperrt).

**Core** (`packages/core`): `nutrition/barcode.ts` (GS1-Prüfziffer, UPC-A → EAN-13, GTIN-14 mit Indikator 0 → EAN-13,
Laden-/Waagen- und Nicht-Lebensmittel-Präfixe 02x/04x/05x/2xx/977–979/98x–99x sowie EAN-8 mit 0/2 → `not_food`),
`nutrition/food-product.ts` (Bereinigung, `parseOffAnswer`, `normalizeOffProduct`, zweistufige Prüfung
`checkProductNutrients` ok/review/blocked inkl. Atwater, kJ↔kcal, Portions-Umrechnung, Ethanol-Dichte, Salz aus
Natrium; Einträge `entryFromProduct`/`entryFromUserProduct`, Server-Spiegel `serverProductEntry`,
`rebuildProductEntry`; eigene Produkte mit Zod), `nutrition/food-product-lookup.ts` (Ablauf der Route
`runProductLookup` ohne Next/Netz, Speicher-Zeile, Limits, Attrappe `MOCK_PRODUCT_CASES` mit 9 Testnummern
`400999900001x`). Grenzen in `constants.ts`: `OPEN_FOOD_FACTS`, `FOOD_PRODUCT_LOOKUP_LIMITS` (60/Std., 200/Tag,
global 10/Min., 30/90 Tage, „nicht gefunden“ 1 Tag), `FOOD_PRODUCT_CHECK`, `USER_FOOD_PRODUCT_LIMITS` (200 Produkte) –
je mit Quelle bzw. PRODUKTENTSCHEIDUNG.

**Web** (`apps/web`): `POST /api/ernaehrung/produkt` (Region fra1, 15 s): CORS nur eigene App, **Login vor dem Lesen
des Körpers**, Körper ≤ 256 Byte (Nummer nur im Körper, nie in der URL/im Log), Einwilligung `health_data` (E4-G12),
Limits atomar in der Datenbank, Anfrage an OFF nur mit `User-Agent: Alpha5/0.1.0 (<OFF_CONTACT_EMAIL>)` + `Accept`
(keine Nutzer-ID, kein Token, keine Weiterleitung, 6 s, ≤ 512 KB), 429/503 → 5 Minuten Pause. Ohne
`OFF_CONTACT_EMAIL` → `not_configured`, **nie** eine Anfrage. Seite `/lizenzen` (ODbL/DbCL, BLS), Link im Fuß und im
Impressum, Datenschutzerklärung Abschnitt 8 „Produktabfrage“ (Entwurf).

**Datenbank** (rein additiv, Zeitstempel ab `20261017100000` statt der im Plan genannten `20261016200000`):
`20261017100000_food_products.sql` (Speicher ohne Personenbezug, RLS ohne Policy, nur `service_role`; Zähler je Person
und Stunde **ohne Nummer**; globaler Deckel; Flag `food_product_lookup` **aus**; `food_product_lookup`,
`food_product_upsert`, `food_product_off_backoff`; Aufräumen per pg_cron `food-products-retention` (02:37 UTC) und beim
Zugriff; Flag über `beta_admin(..., p_flag => 'food_product_lookup')`), `20261017100100_user_food_products.sql`
(eigene Produkte, RLS, `save_/delete_user_food_product`, höchstens 200), `20261017100200_food_log_product.sql`
(Herkunft `product`, `product_code`/`user_product_id`, Favoriten `product`/`own_product` nur als Verweis + Menge,
`save_food_log_entries` als echte Obermenge mit `product_unavailable`), `20261017100300_food_product_revoke_export.sql`
(Widerruf löscht eigene Produkte und Produkt-Favoriten, Export + `user_food_products` und eigene Zähler).

**App** (`apps/mobile`): Ernährung → Eintragen → Karte „Produkt (Barcode)“ (`/ernaehrung/produkt`), alle Zustände aus
2.1 (laden, nicht gefunden, unbrauchbar, „Werte prüfen“ mit Pflicht-Haken, Ladencode, offline, Limit Stunde/Tag, nicht
erreichbar, nicht eingeschaltet, keine Einwilligung); eigene Produkte zuerst (auch offline); „Eigenes Produkt
anlegen“ vorausgefüllt (Name/Marke/Nummer, Werte nur wenn nicht gesperrt); Verwaltung unter Ernährung → Eigene
Gerichte → „Eigene Produkte“ (`/ernaehrung/produkte`); Zuletzt/Favoriten mit Marke; „Produkt neu abrufen“, wenn die
Speicher-Zeile fehlt; Einstellungen → „Lizenzen und Quellen“. Testmodus: Attrappe im Gerät mit Testnummern-Liste.
„Kalorienzahlen aus“: keine Zahlen, keine eigenen Produkte (E4-G8).

**Präzisierungen gegenüber dem Plan** (bitte im Wächter bestätigen):

1. Werte vom Server über eine **neue** Funktion `private.food_log_product_values` statt einer Erweiterung von
   `private.food_log_server_values` (die bleibt unverändert; `save_food_log_entries` ist Obermenge und ruft beide).
2. Flag `food_product_lookup` ist **global** (gratis, keine Freischaltung je Person); `beta-grant` lehnt
   `freischalten`/`entziehen` dafür ab, `status` zeigt nur Summen.
3. Eigene Produkte werden über einen Knopf in „Eigene Gerichte“ verwaltet (kein eigener Reiter im Eintragen).
4. Zusätzliche Präfixe 04x/05x (GS1: firmeninterne Nummern, Gutscheine) als `not_food`.
5. Funktionsnamen: `public.food_product_lookup(uid, code)` (Einwilligung → Limits → Speicher → Reservierung beim
   globalen Deckel) und `public.food_product_off_backoff()` statt `food_product_lookup_reserve`/`off_request_backoff`.
6. Texte in `apps/mobile/src/i18n/de-food-product.ts` (statt `de-nutrition.ts`); Testmodus hat keinen globalen
   Deckel (Attrappe im Gerät).
7. Attrappe: kein Link „Bei Open Food Facts ansehen“ (ausgedachte Testnummern); der Link mit IP-Hinweis erscheint nur
   bei echten Antworten.

**Tests:** Core 4.702 (davon 121 in `food-product.test.ts` mit Eigenschaftstests, `db-sync.test.ts` 397), Web 186
(davon 29 in `food-product/handler.test.ts`), App 672 (davon 17 in `food-product.test.ts`), pgTAP 39 Dateien/2.131
Tests (neu 39–41, angepasst 17 und 30), Playwright komplett 107 grün, darunter neu `food-product.spec.ts` (3 Tests, 5×
wiederholt stabil), `history.spec.ts` (Export jetzt 38 Tabellen), `nutrition-food-log`/`custom-meals` (neuer
Widerrufstext). Harness: Kreuzvergleich Core ↔ SQL (3 Läufe, zusammen 7.776 Fälle, 0 Abweichungen);
Nebenläufigkeit: 10 gleichzeitige Abfragen beim Zähler 59 → genau 1 erlaubt (Zähler 60); 20 Personen gleichzeitig →
genau 10 Anfragen an OFF; Widerruf während `save_user_food_product` wartet (2,6 s) und löscht danach.

**Gegenproben (gebrochen → rot → zurückgesetzt):** Core: kcal-Grenze 905 → 2.000, EAN-8 mit 2 abgefragt,
Einheiten-Prüfung in `serverProductEntry` entfernt, Obermenge `save_food_log_entries` (Zeile entfernt → db-sync rot).
Web: Kontaktadresse nicht geprüft, Körper 4 KB erlaubt. pgTAP: Einwilligung nicht geprüft, Policy + Leserecht auf
`food_products`, Limit 205 statt 200, Widerruf ohne Löschen eigener Produkte, Gerätewerte übernommen. App: Widerruf
ohne Löschen der Produkt-Favoriten (Test erst ergänzt, weil er grün blieb). Harness: Kreuzvergleich mit geändertem
Titel-Trenner (287 Abweichungen) bzw. Rundung (746); ohne Advisory-Sperre → 5 Abfragen scheitern erst an der
CHECK-Grenze statt sauber „Limit“; ohne `FOR SHARE` → Widerruf wartet nicht, eigenes Produkt bleibt. Playwright:
„Eintragen“ ohne Haken bei „Werte prüfen“ möglich → rot; Marke in einer testID → rot; dabei gefunden: die Testnummer
„kJ als kcal“ brachte „kcal“ in DOM und testID bei „Zahlen aus“ → umbenannt in „Energie-Einheiten vertauscht“.

**Offen / vor dem Livegang:** API-Felder und Nutzungsbedingungen von Open Food Facts prüfen (SETUP Teil M4);
Lizenz-Hinweis, Datenschutz-Abschnitt und Einwilligungstext `health_data` (nennt Produkte noch nicht ausdrücklich)
juristisch prüfen; `database.types.ts` per Workflow `db-types` gegenprüfen; E4b (Kamera).

### Nachtrag Wächter-Prüfung E4a (17.10.2026): Auflagen umgesetzt bzw. vorgemerkt

Urteil „Freigabe mit Auflagen“. Stand nach dem Merge von `main` (WP4 #89, content-review #91):

- **M1 umgesetzt – Speicher nicht an den Limits vorbei auslesbar.** Neue Migration
  `20261017100400_food_product_use_limit.sql`: Jede **neue** Nutzung einer Nummer zählt wie eine Abfrage auf
  `private.food_product_lookup_counts` (ohne Nummer), nämlich ein neuer Produkt-Eintrag, eine geänderte Nummer an einem
  Eintrag und ein neuer Produkt-Favorit. Nicht gezählt werden: Menge/Mahlzeit ändern, vorhandenen Favoriten erneut
  setzen, eigene Produkte. Beim Limit (60/Stunde, 200/Tag) wird der Eintrag mit dem neuen Code `product_limit`
  abgelehnt (App: „sehr viele Produkte abgefragt bzw. eingetragen …“) bzw. der Favorit nicht gespeichert – ohne Titel
  oder Werte aus dem Speicher. Umgesetzt als Trigger (`private.food_product_charge`, Advisory-Sperre
  `food_product_lookup|<Person>`); Sperr-Reihenfolge Einwilligung → `food_log|<Person>` → `food_product_lookup|<Person>`.
  `save_food_log_entries` (20261017100200, noch nicht eingespielt) übersetzt die Meldung in `product_limit`. Gewählt
  wurde „zählen“ statt „nur nach eigener Abfrage der letzten 90 Tage“: Das braucht keine personenbezogene Liste
  abgefragter Nummern. **Folge (Gründer-Info):** Nachschlagen und Eintragen zählen zusammen, praktisch also etwa 30
  verschiedene Produkte pro Stunde bzw. 100 pro Tag. Der Testmodus rechnet gleich (`chargeProductUse`,
  `isNewProductUse` im Core). Tests: pgTAP `44_food_product_use_limit.test.sql` (19), Core, App. Gegenproben:
  Eintrag bzw. Favorit zählt nicht, Upsert zählt doppelt, Menge ändern zählt, Code nicht übersetzt, App ohne
  „neu?“-Prüfung → jeweils rot.
- **N1 umgesetzt:** Die Route misst die OFF-Felder in UTF-8-Bytes (`offFieldsBytes`, TextEncoder) gegen
  `offFieldsCheckBytes` 14 KB – Puffer zur Datenbank-Grenze von 16 KB, deren jsonb-Textform länger ist. Gegenprobe:
  Messung in Zeichen → Emoji-Antwort wird gespeichert → rot.
- **N2 umgesetzt:** `AbortSignal.timeout(5000)` für jeden Supabase-Aufruf der Route (`supabaseTimeoutMs`). Die App
  wartet auf die Route höchstens `clientTimeoutMs` 16 s und meldet dann „bitte gleich noch einmal“. Hier bewusst nicht
  5 s, weil die Route selbst bis zu 6 s auf OFF wartet und `maxDuration` 15 s hat. Gegenprobe: Signal entfernt → rot.
- **N4 umgesetzt:** `retrieved_at` im gemeinsamen Speicher nur stundengenau (Core `recordFromProduct`/
  `notFoundRecord` und `food_product_upsert` mit `date_trunc('hour', …)`). Bei der Rechtsprüfung trotzdem den Satz
  „ohne Bezug zu Personen“ in Datenschutz-Abschnitt 8 prüfen (bei sehr wenig Nutzung bleibt eine grobe zeitliche
  Zuordnung denkbar).
- **Vorgemerkt (nicht umgesetzt):**
  - **N3:** `not_configured` (503) kommt vor der Login-Prüfung; der Konfigurationsstand ist also ohne Login
    sichtbar. Unkritisch – bei Gelegenheit die Reihenfolge Login → Konfiguration tauschen.
  - **N5:** In der Offline-Warteschlange kann ein Tagebuch-Eintrag vor dem erneut gespeicherten eigenen Produkt beim
    Server ankommen. Er verliert dann nur den Verweis (fester Titel, Gerätewerte), Daten gehen nicht verloren. Gleiches
    Muster wie bei eigenen Gerichten; später gemeinsam lösen.
  - **N6:** `database.types.ts` ist von Hand ergänzt – vor dem Merge den Workflow `db-types` laufen lassen.
  - **N7:** Der Einwilligungstext `health_data` nennt Produkte und Nummern noch nicht. Vor dem Einschalten des Flags
    anpassen (neue Fassung) und rechtlich prüfen.
- **H1 umgesetzt (nach dem Merge von Z3, PR #92):** Neue Migration `20261017210000_revoke_export_union.sql` mit
  Zeitstempel nach beiden Vorgängern. Sie fasst `private.consents_after_revoke()` und `public.export_my_data()` als
  **Vereinigung** von E4a (`20261017100300`) und Z3 (`20261017200200`) neu; die Vorgänger bleiben unverändert.
  - Der Widerruf löscht `weight_goals`, `user_food_products` und die Produkt-Favoriten, jeweils am Anfang und in der
    Wiederholung.
  - Der Export enthält `user_food_products`, `food_product_lookup_counts` und `weight_goals`.
  - Der Kommentar von `user_food_products` beginnt jetzt mit „SENSIBEL (Art. 9 vorsorglich, Freitext)“; der
    SENSIBEL-Test von Z3 führt die Tabelle damit in der Liste der ganz gelöschten Tabellen.
  - `db-sync.test.ts` prüft die Obermenge gegen **beide** Vorgänger.
  - pgTAP `45_revoke_export_union.test.sql` (14 Tests): Widerruf löscht beides, fremde Daten bleiben, Export.
  - Das E4a-pgTAP `43_food_product_use_limit` heißt jetzt `44_…` (Nummer 43 hat Z3).
  - App: Export jetzt 39 Tabellen; Widerruf im Gerät löscht `userFoodProducts` und `weightGoal`.
  - Gegenproben: Löschung von `weight_goals` bzw. `user_food_products` aus der Vereinigung entfernt → pgTAP und
    db-sync rot.

### Umsetzungsstand E4b (17.10.2026)

**Umgesetzt** (Branch `claude/e4b-kamera`): Knopf **„Mit der Kamera scannen“** auf „Produkt (Barcode)“, nur wenn das
Gerät es kann. Der erkannte Code steht danach im Nummernfeld und läuft durch **dieselbe Prüfung und denselben Ablauf**
wie beim Eintippen (Prüfziffer, Ladencodes ohne Abfrage, eigene Produkte zuerst, Server-Abfrage, Produktansicht).
Kamerabilder bleiben im Arbeitsspeicher, werden nie gespeichert, gesendet oder geloggt.

- **Core** (`nutrition/barcode.ts`): `scannedBarcodeFormat` (Namen aus `BarcodeDetector` und `expo-camera`),
  `expandUpcE` (UPC-E → UPC-A nach GS1, Prüfziffer muss passen, Nummernsystem 0/1), `scannedBarcodeDigits` (Länge muss
  zum Format passen; UPC-A auch als 13 Ziffern mit führender 0, wie iOS sie liefert) und `normalizeScannedBarcode`
  (= `normalizeBarcode` danach). QR-/Code-128-Codes werden ignoriert. Tests `barcode.test.ts` (40, inkl.
  Eigenschaftstest „Scan = Eintippen“ mit 2.000 Nummern).
- **Browser** (`components/barcode-scanner.tsx`, Logik in `lib/barcode-scan.ts`): Knopf, wenn HTTPS + `getUserMedia`
  und ein Leser da sind. Eingebauter `BarcodeDetector` nur, wenn `getSupportedFormats()` `ean_13` enthält (Chrome
  Android), sonst **ZXing-Polyfill** `barcode-detector` 3.2.2 / `zxing-wasm` 3.1.3 – damit geht es auch in **Chrome
  und Safari auf dem iPhone** (beide WebKit). Der Polyfill ist ein eigenes Bündel (`ponyfill-….js`, 44 KB) und wird
  erst beim Knopfdruck nachgeladen; die WebAssembly-Datei (~1 MB) kommt von **unserer Domain**
  (`/scanner/<Version>/zxing_reader.wasm`, beim Bauen von `scripts/copy-scanner-wasm.mjs` aus `node_modules` kopiert,
  SHA-256 gegen die Angabe im Paket geprüft) – **nie vom voreingestellten CDN jsDelivr**. Ausgaben des Lesers gehen
  nicht in die Konsole. Rückkamera, kein Ton, Leseversuch alle 200 ms, erster gültiger Code (bzw. Ladencode) beendet
  die Kamera sofort; Abbrechen und Verlassen des Bildschirms beenden sie auch.
- **App** (`components/barcode-scanner.native.tsx`): `expo-camera` ~57.0.6 (passend zu SDK 57), `CameraView` mit
  `barcodeTypes` `ean13`, `ean8`, `upc_a`, `upc_e`. Fehlt das native Modul (alter Build), liefert
  `requireOptionalNativeModule('ExpoCamera')` null → kein Knopf, kein Absturz; `expo-camera` wird erst dann geladen.
  `app.config.ts`: Plugin `expo-camera` mit deutschem Text (Wortlaut 5.2), `microphonePermission: false`,
  `recordAudioAndroid: false`. Android-Berechtigungen jetzt INTERNET, VIBRATE, **CAMERA** (geprüft in
  `native-config.test.ts` gegen `expo config --type introspect`: Info.plist nur `NSCameraUsageDescription`, kein
  Mikrofon, kein RECORD_AUDIO). expo-camera bringt kein eigenes Datenschutz-Manifest mit; Kamera ist keine „Required
  Reason API“.
- **Verweigert:** „Ohne Kamera-Erlaubnis kannst du die Nummer eintippen.“ + Weg zur Einstellung (Browser: Chrome
  Android/iPhone-Einstellungen; App: Knopf „Einstellungen öffnen“). Keine Kamera/belegt/Leser lädt nicht → „Die Kamera
  ließ sich nicht starten … tipp die Nummer ein“. Texte in `i18n/de-food-product.ts` (`scan`).
- **Tests:** Core 4.845 (neu 40), App 788 (neu 19 in `lib/barcode-scan.test.ts`, `native-config.test.ts` angepasst
  und +1), Playwright `food-product-scan.spec.ts` (6 Tests, 5× wiederholt stabil): ohne Kamera kein Knopf; eingebauter
  Leser als Ersatz-Objekt (Fehllesung übersprungen, Formate, Kamera danach aus, ZXing nicht geladen); **echter
  ZXing-Scan** eines auf eine Zeichenfläche gezeichneten EAN-13 (Leser erst nach dem Knopfdruck, von 127.0.0.1, keine
  fremde Adresse) → Produktansicht → eintragen; verweigert → Hinweis → Nummer eintippen; keine Kamera; Abbrechen
  beendet die Kamera.

**Nicht mit eingebaut – E3-G1:** `expo-image-picker`/`expo-image-manipulator` sind noch nicht im Projekt (Foto in der
App zeigt weiter den Hinweis). Sie bringen weitere Berechtigungen (Fotos) und eigenen Code; der Plan empfahl, sie mit
demselben Build zu bringen. Wenn E3-G1 vor dem nächsten EAS-Build fertig wird, beide zusammen bauen, sonst zwei Builds.

**Neuer EAS-Build nötig** (Android-APK und iOS/TestFlight, HANDY-ANLEITUNG Teil 7l). Die Web-Vorschau braucht nichts.

**Vormerkungen / vor dem Livegang:** App-Store-Datenschutzangaben prüfen (Kamera nur auf dem Gerät, keine Bilder
erhoben); Android liest mit **Google ML Kit (gebündelt, auf dem Gerät)** – ML-Kit-Bedingungen zu anonymen
Nutzungsstatistiken prüfen und in der Datenschutzerklärung erwähnen; auf echten Geräten testen (iPhone Chrome/Safari,
Android Chrome, APK, TestFlight), besonders bei wenig Licht und kleinen EAN-8-Codes; beim Aktualisieren von
`barcode-detector` die Version von `zxing-wasm` in `apps/mobile/package.json` angleichen (sonst bricht der Build mit
Hinweis ab).

---

## 9. Aufwand und Etappen

| Etappe  | Inhalt                                                                                                                                                                                        | Neuer App-Build? | Grobe Größe                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| **E4a** | Nummer eintippen, Route, `food_products`, Limits, Prüfung im Core, eigene Produkte, Tagebuch `product`, Favoriten/Zuletzt, Widerruf/Export, Seite „Lizenzen und Quellen“, Datenschutz-Entwurf | nein             | etwa wie E2 + E3-Route (größte Teile: SQL-Obermengen, Tests) |
| **E4b** | Kamera im Browser (`BarcodeDetector` + ggf. ZXing-Polyfill), `expo-camera` in der App, Berechtigungstexte (umgesetzt 17.10.2026)                                                              | **ja (EAS)**     | klein bis mittel; Build am besten zusammen mit E3-G1         |

Reihenfolge: E4a → Wächter-Prüfung → E4b. E4a ist allein voll nutzbar (Nummer eintippen dauert ~5 Sekunden). Die
Rechtsprüfung (6.2) kann parallel laufen. Bis dahin bleibt das Feature-Flag in Produktion aus.

---

## 10. Fragen an die Gründer (mit Empfehlung)

- **E4-G1 Kamera jetzt oder Nummer zuerst?** _Empfehlung:_ **Nummer zuerst (E4a), Kamera als E4b** direkt danach,
  den App-Build gemeinsam mit E3-G1. Im Browser auf iPhone mit ZXing-Polyfill (sonst nur Nummer).
- **E4-G2 Zwischenspeicher gemeinsam oder je Person?** _Empfehlung:_ **gemeinsam, ohne Personenbezug**, nicht direkt
  lesbar, 30 Tage auffrischen / 90 Tage löschen. Grund: OFF-Kontingent 15/Minute für unseren ganzen Server, kein
  Personenbezug im Speicher, lizenzrechtlich kein Nachteil gegenüber „je Person“.
- **E4-G3 Unplausible Werte – sperren oder warnen?** _Empfehlung:_ **zweistufig:** unmögliche/fehlende Werte
  **sperren** (eigenes Produkt anlegen), Atwater-Abweichung > 20 % und Umrechnungen **warnen** mit Pflicht-Haken „mit
  der Packung verglichen“.
- **E4-G4 Marken in „Zuletzt“/„Favoriten“?** _Empfehlung:_ **ja**, weil die Person das Produkt selbst abgefragt hat.
  **Nie** in Vorschlägen, Essensplan, Einkaufsliste, Rezepten, Katalog-Suche oder PDFs des Essensplans (X0).
- **E4-G5 Eigenes Produkt per Foto der Nährwerttabelle?** _Empfehlung:_ **nein** in E4. Das wäre Texterkennung bzw.
  KI, also Premium mit eigener Einwilligung und eigenem Limit; frühestens als eigene Etappe nach dem echten
  Gemini-Betrieb.
- **E4-G6 Produktbilder von OFF anzeigen?** _Empfehlung:_ **nein** (CC BY-SA mit Namensnennung je Bild, mögliche
  Marken-/Urheberrechte an der Verpackung, Datenverbrauch; direkt geladen würden sie die IP der Person an OFF senden).
- **E4-G7 Eigene Produkte an OFF melden („Produkt ergänzen“)?** _Empfehlung:_ **nein** (CLAUDE.md „Kein Teilen“,
  Datenschutz). Höchstens später ein reiner Link zur OFF-Website ohne Daten.
- **E4-G8 Eigenes Produkt bei „Zahlen aus“?** _Empfehlung:_ **nicht anlegbar** (man müsste kcal eintippen), stattdessen
  Schnelleintrag. Vorhandene eigene Produkte bleiben eintragbar (Werte ausgeblendet).
- **E4-G9 Nutri-Score/NOVA/„gesund“ zeigen?** _Empfehlung:_ **nein** (Bewertung von Essen, Essstörungs-Sensibilität
  2.4; dazu wäre ein Lizenz- und Markenhinweis für den Nutri-Score nötig).
- **E4-G10 Widerruf `health_data`:** eigene Produkte **und** Produkt-Favoriten löschen? _Empfehlung:_ **ja** (Freitext
  bzw. Marken verraten Konsum; wie E2-G1 und die Schnell-Favoriten).
- **E4-G11 Link „Bei Open Food Facts ansehen“?** _Empfehlung:_ **ja, mit Hinweis** „Dabei verlässt du die App; Open
  Food Facts sieht dann deine IP-Adresse“.
- **E4-G12 Abfrage nur mit Gesundheits-Einwilligung?** _Empfehlung:_ **ja** (Zweck ist das Tagebuch; vorsorglich
  Art. 9 wie A-G12; einfacher und strenger).
- **E4-G13 Limits:** je Person **60 Abfragen pro Stunde / 200 pro Tag**, Server gesamt **10 OFF-Abfragen pro Minute**,
  200 eigene Produkte, als Konstanten änderbar? _Empfehlung:_ **ja**.
- **Gründer-Aufgaben (keine Frage, Pflicht vor dem Livegang):** Rechtsprüfung ODbL/DbCL (Hinweis-Wortlaut, 4.6,
  abgeleitete Datenbank), Datenschutzerklärung-Abschnitt, nächste Fassung `health_data`-Text; Kontakt-Adresse für den
  User-Agent einrichten; Feature-Flag in Produktion erst danach einschalten.
