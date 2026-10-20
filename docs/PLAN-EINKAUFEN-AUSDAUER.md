# Bau-Plan – Einkaufen, Dashboard bearbeiten, Ausdauer und Story-Bild

**Status:** **Entwurf zur Freigabe** – Gründer-Entscheidungen vom 20.10.2026 (Abschnitt 1). Umsetzung je Etappe als
Pull Request mit Wächter-Prüfung, Reihenfolge E1 → E6 (Abschnitt 1, letzte Zeile).

**Grundlage:** `CLAUDE.md` (Fachlogik nur in `packages/core`, Zod an allen Grenzen, RLS, Export/Löschen, keine
Gesundheitsdaten in Logs, Texte Deutsch, **Teilen-Ausnahme für Einheiten als Bild** aus PR #119), `docs/PLAN-DASHBOARD.md`
(Übersicht, Menüleiste), `docs/PLAN-PHASE-10.md` (11–13: Strecken S0/S1/S2a, Umsetzungsstand S1 Teil 1, W-G13 bis
W-G16), `docs/KONZEPT.md` (5.5/6 Einkaufsliste, 6.13, 10.1), `docs/PLAN-E4.md` (Nummer prüfen, Kamera E4b,
Produktabfrage), `docs/PLAN-PHASE-5.md` (N5b/N7 Einkaufsliste), Code-Stand `origin/main` vom 20.10.2026.

---

## 0. Kurzfassung

1. **Einkaufen (E1):** eigener Knopf unten. Einkaufsliste aus dem Essensplan wie bisher, Abhaken auch **ohne Netz**,
   eigene Artikel, **Barcode-Scanner direkt im Einkaufen**: passt das Produkt zu einem Eintrag → abhaken; unsicher →
   Auswahl; passt nicht → „Zusätzlich hinzufügen?“.
2. **Dashboard bearbeiten (E2):** Kacheln ein-/ausblenden und umsortieren, Menüleiste unten selbst zusammenstellen –
   mit Hoch/Runter-Knöpfen, gespeichert im Konto.
3. **Ausdauer (E3–E5):** erst ein kleiner Technik-Test mit Test-APK (S0), dann Aufzeichnen, „Meine Läufe“, Auswertung
   je Lauf (Karte, Kilometerzeiten, Höhenprofil) und Wochen-/Monatssummen.
4. **Story-Bild (E6):** einzelne Lauf- oder Trainingseinheit als Bild 9:16 teilen – auf dem Gerät erzeugt, Anfang/Ende
   der Strecke abgeschnitten, keine Gesundheitsdaten, kein Upload.

**Das Wichtigste vorweg:**

- **Keine Echtzeit-KI**, keine neuen laufenden Kosten außer Kartenkacheln (Testphase OpenFreeMap, 0 €).
- Vieles ist schon da: Häkchen und eigene Einträge speichert die Einkaufsliste bereits, Strecken-Rechenlogik und
  Tabelle `tracked_routes` gibt es seit S1 Teil 1. Neu sind vor allem App-Oberflächen, drei kleine additive
  Migrationen und Regeln in `packages/core`.
- **E1, E2, E5 und E6 (Kraft) sind sofort in der Vercel-Vorschau testbar.** Aufzeichnen (E4) braucht die Test-APK aus E3.

---

## 1. Gründer-Entscheidungen (20.10.2026)

| Nr.   | Thema                | Entscheidung                                                                                                                                                                                                                   |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EA-G1 | Einkaufen            | **Eigener Knopf in der Menüleiste.** Liste aus Essensplan, Abhaken (persistiert, offline, je Woche/Liste), eigene Artikel, Scanner im Einkaufen (passt → abhaken, unsicher → Auswahl, passt nicht → „Zusätzlich hinzufügen?“). |
| EA-G2 | Dashboard bearbeiten | **Kacheln ein-/ausblenden + Reihenfolge** („Bearbeiten“), **Menüleiste anpassen** (welche Bereiche, Reihenfolge; Mindestregeln). Pro Konto, Standard = heutiger Stand, Hoch/Runter-Knöpfe statt nur Ziehen.                    |
| EA-G3 | Ausdauer             | **Neuer Bereich „Ausdauer“** (Kachel, optional Menüknopf): Aufzeichnen Laufen/Rad/Gehen, „Meine Läufe“, Auswertung je Lauf, Wochen-/Monatssummen. Erst S0-Spike, dann S1 App. **Test-APK vor dem Schluss erlaubt.**            |
| EA-G4 | Story-Bild teilen    | **9:16-Bild für Ausdauer- und Trainingseinheiten**, Privatzone 200 m, Karte abschaltbar, keine Gesundheitsdaten, Erzeugung auf dem Gerät, System-Teilen-Dialog oder Bild speichern, kein Upload.                               |
| EA-G5 | Reihenfolge          | **E1 Einkaufen → E2 Dashboard bearbeiten → E3 S0-Spike → E4 Ausdauer S1 App → E5 Auswertung Woche/Monat → E6 Story-Bild.**                                                                                                     |

## 2. Ist-Stand (geprüft am 20.10.2026)

- **Einkaufsliste** (`apps/mobile/src/app/einkaufsliste/*`, Core `nutrition/shopping-list*.ts`, Tabellen
  `shopping_lists`/`shopping_list_items`): Liste je Woche aus dem Plan, Häkchen über stabilen `item_key`, eigene
  Einträge (`manual|…`, ≤ 80 Zeichen), „nicht mehr im Plan“, Weitergeben/Drucken. Häkchen gehen über
  `set_shopping_item_checked`. **Lücke:** Bei Listen mit Gesundheitsbezug (`usesHealthData`) ist das ein sensibler,
  direkter Schreibweg – **ohne Netz schlägt Abhaken fehl** (`online_only`). Ohne Essensplan gibt es keine Liste
  (Hinweis „Noch kein Plan“).
- **Scanner** (E4b): `components/barcode-scanner(.native).tsx`, `lib/barcode-scan.ts`, Core
  `normalizeScannedBarcode`; Produktabfrage `POST /api/ernaehrung/produkt` hinter Feature-Flag `food_product_lookup`
  (**seit 20.10.2026 für die Testphase an**, Gründer; vor dem Livegang Rechtsprüfung aus `docs/PLAN-E4.md`), im Testmodus antwortet eine Attrappe. Eigene Produkte (`user_food_products`) haben
  optional einen Code. **Es gibt keine Zuordnung Produkt → Lebensmittel** (`foods.id`); `foods` haben `aliases_de`.
- **Menüleiste/Übersicht:** feste Liste `TAB_ORDER` (5 Knöpfe) in `components/tab-bar.tsx`; Kacheln fest in
  `(tabs)/uebersicht.tsx` (Training, Ernährung, Körperdaten, Fortschritt, Schnellzugriffe; Hinweise „Im Training wartet
  etwas“/Plan dringend oben).
- **Strecken:** Core `packages/core/src/routes/*` und Tabelle `tracked_routes` mit RPCs fertig (S1 Teil 1). **Keine
  App-Oberfläche, keine nativen Module, S0 nicht gemacht.** Die gespeicherte Linie hat **keine Höhen** – ein
  Höhenprofil braucht eine additive Spalte (E4).
- **Teilen als Bild:** CLAUDE.md-Ausnahme liegt als PR #119 bereit (noch nicht in `main`) – **E6 erst nach Merge**.

---

## 3. Etappe E1 – Einkaufen (Liste, Abhaken, Scanner)

**Navigation:** Reiter „Einkaufen“ in `(tabs)`; Adresse bleibt **`/einkaufsliste`** (Deep-Links, Vorschau-Links).
`drucken`/`weitergeben` bleiben Unterseiten im Stapel. Standard-Menüleiste siehe Frage EA-1.

**Core (`packages/core/src/nutrition/shopping-scan.ts`, Konstanten `SHOPPING_SCAN` in `constants.ts`):**

- `normalizeProductName(name, brand)`: klein, Umlaute/ß falten, Marke, Mengenangaben („500 g“, „1,5 l“), Bio-/Werbewörter
  und Satzzeichen entfernen, einfache Plural-Endungen (-n/-en/-e/-s) kappen.
- `matchScannedProduct({ code, productName, brand, ownProduct }, list, foods, links)` →
  `{ kind: 'match', itemKey }` | `{ kind: 'choose', candidates (max 5) }` | `{ kind: 'already_checked', itemKey }` |
  `{ kind: 'none', suggestedCategory }`. Reihenfolge:
  1. **Gelernte Zuordnung** Code → `food_id` (eigene, bestätigte Wahl) – offene Einträge mit dieser `food_id`.
  2. **Name** gegen `labelDe` + `aliases_de` des Lebensmittels bzw. Text eigener Einträge (Token-Treffer, Punktzahl).
  3. Genau ein offener Kandidat über der Schwelle **und** klarer Abstand zum zweiten → `match`; mehrere/knapp →
     `choose`; dasselbe Lebensmittel in zwei Einheiten (`g` und `piece`) → `choose`; nur abgehakte Treffer →
     `already_checked`; nichts → `none` (Abteilung aus dem besten schwachen Treffer, sonst „Sonstiges“).
  4. Vorrat und „nicht mehr im Plan“ zählen mit, aber nach offenen Plan-Einträgen.
- `manualItemFromProduct(name)` → eigener Eintrag (≤ 80 Zeichen, gleiche Bereinigung wie heute).
- **Tests:** Umlaute/Plural („Tomaten“ ↔ „Tomate“), Marke im Namen, Mengen im Namen, leere Liste, nur abgehakt,
  Gleichstand → Auswahl, zwei Einheiten → Auswahl, gelernte Zuordnung schlägt Namen, gelernte Zuordnung auf Lebensmittel
  ohne Eintrag → `none`, eigener Eintrag per Name, sehr lange/leere Namen, Steuer-/unsichtbare Zeichen, Determinismus.

**Ablauf in der App:**

1. „Scannen“ oben im Einkaufen → vorhandener Scanner (Kamera bzw. Nummer eintippen).
2. Nummer prüfen (`normalizeScannedBarcode`) → eigene Produkte und gelernte Zuordnungen (**ohne Netz**) → sonst
   Produktabfrage (wenn Flag an; Testmodus: Attrappe).
3. `match` → abhaken + Meldung „Tomaten abgehakt“ mit **„Rückgängig“** (Frage EA-3); `choose` → Auswahl der offenen
   Einträge + „Keiner davon“; Wahl wird als Zuordnung gelernt (mit Einwilligung, siehe unten); `none` bzw. „Keiner
   davon“ → **„Zusätzlich hinzufügen?“** (Name vorbefüllt, Abteilung änderbar); `already_checked` → „Schon abgehakt“.
4. Produkt unbekannt, Abfrage aus oder offline → „Produkt nicht erkannt“ + Auswahl aus den offenen Einträgen bzw.
   eigener Artikel. Der Scanner führt nie in eine Sackgasse.

**Abhaken offline (Lücke schließen):** Häkchen sensibler Listen gehen in eine **verschlüsselte Warteschlange**
(`protected-store`, nur Woche, `item_key`, Häkchen, Zeitpunkt) und werden bei Verbindung über den vorhandenen
Schreibweg gesendet; letzter Stand je Eintrag gewinnt; verschwundener Eintrag → still verworfen. Abmelden, Widerruf
und Konto löschen leeren die Warteschlange. Nicht sensible Listen nutzen die vorhandene Warteschlange.

**Datenmodell (additiv, RLS):** Häkchen und eigene Artikel liegen **bereits** in `shopping_list_items` (`checked`,
`is_manual`) – keine neuen Tabellen dafür. Neu nur:

- `shopping_product_links` (`user_id` Kaskade, `code` (`private.barcode_ok`), `food_id` → `foods`, `updated_at`;
  PK `(user_id, code)`; höchstens 500 je Person). RLS nur eigene Zeilen lesen, Schreiben über
  `save_shopping_product_link` / `delete_shopping_product_link` (Prüfungen = Zod). **Sensibel** wie Produkt-Favoriten
  (Konsum, E4a): nur mit gültiger Einwilligung `health_data`, gelöscht beim Widerruf, im Export (`export_my_data` +
  `DATA_EXPORT_TABLES`), Konto löschen per Kaskade, Partner-Modus sieht nichts.
- Testmodus: `localDb.shoppingProductLinks` mit denselben Regeln.

**Zustände:** kein Plan (Frage EA-2), Kamera verweigert/fehlt (vorhandene Texte), Abfrage aus, offline,
Speicherfehler (Häkchen bleibt lokal, Hinweis), Liste leer/alles erledigt.

**Tests:** Core wie oben; App-Unit für die Offline-Warteschlange; pgTAP (fremde Zuordnungen unsichtbar, `anon` nichts,
Grenzen, Widerruf, Export); `db-sync` (Grenzen, Export-Liste); Playwright `shopping-scan.spec.ts` (Treffer abhaken,
Rückgängig, Auswahl, zusätzlich hinzufügen, offline abhaken → Sync, Menüknopf „Einkaufen“).

## 4. Etappe E2 – Dashboard bearbeiten (Kacheln + Menüleiste)

**Core (`packages/core/src/layout.ts`, Konstanten `APP_LAYOUT`):**

- Kachel-IDs: `training`, `nutrition`, `body`, `progress`, `shortcuts`, ab E4 `endurance`. **Nicht ausblendbar:**
  Hinweise oben („Im Training wartet etwas“, Plan dringend, Sicherheits-/Einwilligungshinweise) – sie stehen immer
  über den Kacheln.
- Menü-Bereiche: `uebersicht`, `today` (Training), `ernaehrung`, `einkaufsliste`, `fortschritt`, ab E4 `ausdauer`,
  `mehr`. **Feste Regeln:** „Mehr“ immer da und immer rechts; „Übersicht“ immer da und links (Startseite);
  **3 bis 5 Knöpfe**; jeder Bereich höchstens einmal.
- `normalizeLayout(stored, available)`: unbekannte/doppelte IDs raus, neue Kacheln/Bereiche an ihrer Standardstelle
  ergänzt, Regeln erzwungen; kaputter Speicher → Standard. `moveItem(layout, id, 'up' | 'down')` (Ränder: keine
  Änderung), `toggleTile`, `setTabs`, `defaultLayout()` = heutiger Stand (+ EA-1).
- **Tests:** Ränder (erste/letzte), alle Kacheln aus (erlaubt, Hinweis „Alle Kacheln ausgeblendet“ + „Bearbeiten“),
  6 Knöpfe abgelehnt, ohne „Mehr“ abgelehnt, unbekannte IDs, neue Kachel nach Update, Idempotenz.

**App:** Knopf **„Bearbeiten“** auf der Übersicht → Liste aller Kacheln mit Schalter „Anzeigen“ und Knöpfen
**„Nach oben“/„Nach unten“** (Bildschirmleser: „Ernährung nach oben“, Ansage „Ernährung ist jetzt an Stelle 2 von 5“
per Live-Region), „Fertig“, „Auf Standard zurücksetzen“. „Menüleiste anpassen“ (aus Bearbeiten und Mehr): Bereiche
an/aus + Hoch/Runter, Regeln mit verständlichem Grund („Höchstens 5 Knöpfe – nimm erst einen heraus“). Ziehen ist
nicht Teil von E2 (später optional). **„Mehr“ zeigt automatisch alle Bereiche, die nicht unten stehen.** Adressen
ausgeblendeter Bereiche funktionieren weiter (kein Knopf markiert).

**Datenmodell (additiv):** Tabelle `app_layout_settings` (`user_id` PK Kaskade, `dashboard_tiles jsonb`,
`tab_bar jsonb`, `updated_at`; CHECK Längen/Typen), RLS nur eigene Zeile, Schreiben über `save_app_layout`
(Prüfung = Zod, ID-Listen per `db-sync` gespiegelt). Kein Gesundheitsdatum; im Export; Kaskade. Offline: lokaler
Stand sofort, Senden über die vorhandene Warteschlange. Testmodus: `localDb.appLayout`.

**Tests:** Core; pgTAP (nur eigene Zeile, Grenzen, Export); Playwright `dashboard-edit.spec.ts` (ausblenden,
verschieben nur per Knopf, Menüleiste mit 5er-Grenze, zurücksetzen, nach Neuladen erhalten), Bildschirmfotos hell/dunkel.

## 5. Etappe E3 – S0-Spike (Development Build, GPS, Karte)

Wie `docs/PLAN-PHASE-10.md` 12 „S0“, ergänzt:

- `expo-location`, `expo-task-manager`, `@maplibre/maplibre-react-native` (Web `maplibre-gl`, nachgeladen), dazu
  gleich **`react-native-view-shot` und `expo-sharing`** für E6 – so reicht **ein** nativer Build.
- Testbildschirm nur im Testmodus: Aufzeichnung 60 min (Akku, Genauigkeit, Sperrbildschirm, Funkloch, Absturz →
  Fortsetzen), Karte mit OpenFreeMap, Bild 1080×1920 erzeugen und teilen.
- Prüfen: „Beim Verwenden“ + Vordergrund-Dienst reicht (W-G13), Web-Export baut weiter, Bündelgröße Web.
- **Ergebnis:** Bericht im PR, Entscheidung W-G13, **Test-APK für die Gründer** (Ausnahme laut EA-G3). Kein
  Nutzer-Feature.

## 6. Etappe E4 – Ausdauer S1 App

Umfang = „Offen für S1 App“ in `docs/PLAN-PHASE-10.md` (Umsetzungsstand S1 Teil 1) plus:

- **Bereich „Ausdauer“** (`/ausdauer`, als Reiter wählbar, Kachel „Ausdauer“ auf der Übersicht: letzte Aktivität,
  km dieser Woche): großer Knopf **„Aufzeichnen“** mit Wahl Laufen/Rad/Gehen, **„Meine Läufe“**, „Eintragen ohne GPS“.
- **Aufzeichnen:** Erklär-Bildschirm vor der System-Abfrage, Start/Pause/Stopp, große Zahlen, Rohpunkte verschlüsselt
  alle 30 s, nach Absturz „Fortsetzen oder speichern?“, Speichern über die Warteschlange (`save_session_log` zuerst,
  dann `save_tracked_route`, danach Eintrag neu laden – S1 N2), Tagebuch-Frage „Zu ‚Lockerer Dauerlauf‘ zählen?“.
- **„Meine Läufe“:** Aufzeichnungen (Linien-Skizze ohne Kartenkacheln) **und** Ausdauer-Einträge ohne GPS
  (Tagebuch), zusammengeführt ohne Doppelzählung (`enduranceActivities(routes, logs)` in Core: verknüpfter Eintrag
  zählt nur einmal). Löschen einzeln/alle, GPX-Export, Favoriten, Vergleich (`compareAttempts`, W-G16).
- **Auswertung je Lauf** (`/ausdauer/[id]`): Karte (MapLibre, Start/Ziel, Attribution – vorgezogener Teil von S2a;
  GPX-Import bleibt S2a), Gesamtzeit/Bewegungszeit, Distanz, Ø-Pace (Rad km/h), **Pace je km als Balken**
  (`km_splits`), **Höhenprofil**, Höhenmeter mit Hinweis „Höhenmeter per GPS sind ungenau“. Einträge ohne GPS: nur
  Zahlen, kein Kartenbereich.
- **Core neu:** `elevationProfile(points, sport)` (gleiche Glättung wie `elevationGain`, nur in Bewegung,
  höchstens 300 Stützpunkte `[distanz_m, höhe_dm]`), `splitBars(kmSplits)` (Balkenlängen, langsamster = 100 %),
  `paceText`/`speedText`. Tests: keine Höhen, Höhen nur teilweise, 0/1/2 Punkte, 12 h, 5.000 Punkte, Rest unter 1 km.
- **Migration (additiv):** `tracked_routes.elevation_profile jsonb` (null erlaubt, CHECK Anzahl ≤ 300 und
  Wertebereiche), `save_tracked_route` nimmt das Feld optional an (ältere App-Fassungen funktionieren weiter),
  Export unverändert vollständig (Spalte kommt automatisch mit), `db-sync` + pgTAP 42 erweitert.
- **Web (W-G14):** Hinweis „Aufzeichnen geht in der App“, **Demo-Aufzeichnung** im Testmodus aus einer Beispiel-GPX,
  **manuell eintragen** über den vorhandenen Ausdauer-Eintrag (A1b).
- **Zustände:** keine Berechtigung, „Suche GPS …“, Akku-Sparmodus, zu kurz (< 1 min / < 100 m → fragen),
  Speicherfehler (bleibt lokal), keine Läufe („Noch keine Läufe – starte deine erste Aufzeichnung“), Karte lädt
  nicht (Zahlen bleiben sichtbar).
- **Tests:** Core; App-Unit (Warteschlange, Wiederaufnahme); Playwright `endurance.spec.ts` im Web (Demo-Aufzeichnung →
  speichern → Liste → Auswertung → löschen; manueller Eintrag erscheint in der Liste); Gerätetest per Test-APK
  (`docs/HANDY-ANLEITUNG.md`, neuer Teil).

## 7. Etappe E5 – Auswertung Woche/Monat

- **Core** `enduranceTotals(activities, { period: 'week' | 'month', anchor })`: je Sportart Anzahl, Distanz,
  Bewegungszeit, Höhenmeter; Woche Mo–So, Kalendermonat, Tag = lokales Datum des Starts (Europe/Berlin); Monat
  zusätzlich Wochenbalken. Vergleich nur neutral zur Vorperiode („12 km mehr als letzte Woche“), keine Serien, keine
  Bestzeiten (W-G16). Tests: Wochen-/Monatswechsel, Sommerzeit, Lauf über Mitternacht, leere Periode, nur Einträge
  ohne GPS, verknüpfte Einträge einmal, 1 vs. 7 Aktivitäten am Tag.
- **App:** Kopf von „Ausdauer“ mit Umschalter Woche/Monat, Blättern zurück, Leerzustand. **Keine Migration.**
- Playwright: Summen nach Demo-Aufzeichnung + manuellem Eintrag, Blättern.

## 8. Etappe E6 – Story-Bild teilen (nach Merge von PR #119)

**Inhalt (feste Positivliste, `packages/core/src/share/story-card.ts`):**

- **Ausdauer:** Strecken-Linie nach `privacyTrim`, Sportart, Datum (ohne Uhrzeit), Gesamt-/Bewegungszeit, Distanz,
  Ø-Pace bzw. km/h, Höhenmeter (mit „ca.“), Alpha5-Logo.
- **Kraft:** Name der Einheit, Datum, Dauer, Anzahl Übungen (bis 5 Namen), Sätze, **Volumen nur aus Zusatzlast**
  (Körpergewichtsübungen ohne Körpergewicht – sonst wäre das Gewicht ablesbar), Logo.
- **Nie:** Puls, Körpergewicht, Körperdaten, Zyklus, Gesundheits-Check, kcal, Ziele/Wunschgewicht, Uhrzeit, Ortsnamen,
  Notizen, App-Link mit Kennung. Test: Positivliste + Prüfung, dass kein Feld außerhalb davon ins Bild gelangt.

**Core `privacyTrim(points, 200)`** (`routes/privacy-trim.ts`, Konstante `ROUTE_PRIVACY_TRIM_M = 200`): schneidet
entlang der Strecke die ersten und letzten 200 m ab (Schnittpunkt interpoliert); bleibt weniger als 100 m übrig →
`null` (Bild ohne Linie, Hinweis „Strecke zu kurz für die Linie“). Tests: 0/1/2 Punkte, < 400 m, genau 400 m,
Rundkurs (Start = Ziel → beide Enden weg), doppelte Punkte, Datumsgrenze ±180°, Genauigkeit des Schnitts < 1 m,
Eigenschaft „kein Punkt im 200-m-Bogen am Anfang/Ende“.

**Erzeugen und Teilen:** Vorschau mit Schaltern „Strecke zeigen“ (Standard an) und „Datum zeigen“. App: Ansicht
1080×1920 → `react-native-view-shot` → `expo-sharing` (System-Teilen-Dialog, dort auch „Bild sichern“), Datei im
Cache, danach gelöscht. Web: Canvas 2D → `navigator.share({ files })`, sonst „Bild herunterladen“. **Kein Upload, kein
Server, keine Konten sozialer Netzwerke, nur auf ausdrücklichen Tipp.** Knöpfe „Als Bild teilen“ in der Auswertung je
Lauf und in der abgeschlossenen Trainingseinheit/Verlauf.

**Tests:** Core (`privacyTrim`, Positivliste, Volumen ohne Körpergewicht); Playwright (Web-Vorschau, Schalter,
`navigator.share` als Ersatz-Objekt, Download-Rückfall, keine Netzanfrage beim Erzeugen).

### Umsetzungsstand E3–E6 (20.10.2026, Branch `claude/ausdauer-gps`)

**E3 – native Module (ein Build für E4 und E6), Entscheidungen:**

- `expo-location` + `expo-task-manager` (SDK-57-Versionen per `expo install`). **W-G13 entschieden: „Beim Verwenden“
  - Vordergrund-Dienst reicht** – geprüft im Quelltext von expo-location 57: `startLocationUpdatesAsync` mit
    `foregroundService` verlangt auf Android nur Vordergrund-Standort + `FOREGROUND_SERVICE_LOCATION` (kein
    `ACCESS_BACKGROUND_LOCATION`), auf iOS nur „Beim Verwenden“ + Hintergrundmodus `location`. Der Dienst startet nur
    aus der geöffneten App (Start/Fortsetzen per Tipp) und endet bei Pause/Stopp bzw. wenn die App beendet wird.
- **Karte ohne natives Karten-Modul:** `@maplibre/maplibre-react-native` (11.x, neue Architektur) ist nicht Teil der
  von Expo SDK 57 geprüften Module und ließ sich hier ohne Android-SDK nicht bauen – Risiko „Build bricht“. Deshalb
  `maplibre-gl` 5.6.0 (fest versioniert, SRI-Prüfsumme, jsDelivr) in `react-native-webview` (SDK-57-Version) bzw. im
  Browser in einem abgeschotteten `iframe` (`sandbox="allow-scripts"`). Ins HTML kommen nur Zahlen (Koordinaten der
  gespeicherten Linie). Kacheln: OpenFreeMap (Testphase), Attribution „© OpenStreetMap-Mitwirkende“ in der Karte und
  als Text darunter. Lädt die Karte nicht (offline, CDN), bleiben die Zahlen (Hinweis).
- **E6 ohne Mediathek:** `react-native-view-shot` (5.1.0) + `expo-sharing` (System-Teilen-Dialog, dort „Bild
  sichern“). **Kein** `expo-media-library`, keine Foto-Berechtigung, kein Plugin `expo-sharing` (das baut nur eine
  „Teilen in die App“-Erweiterung, nicht nötig).
- `app.config.ts`: Plugin `expo-location` (deutsche Texte, kein „Immer“, keine Bewegungsdaten, Benachrichtigungs-Symbol
  = weißes Logo), `ACCESS_BACKGROUND_LOCATION` zusätzlich in `blockedPermissions`, eigenes Plugin
  `withOnlyLocationBackgroundMode` (iOS-Hintergrundmodi nur `location`; `fetch` aus expo-task-manager entfernt),
  Datenschutz-Manifest + `NSPrivacyCollectedDataTypePreciseLocation`. Test `src/test/native-config.test.ts` erweitert.
- **Prüfung ohne EAS (lokal):** `expo prebuild --platform all --no-install --clean` (danach gelöscht) – AndroidManifest
  der App: `INTERNET`, `VIBRATE`, `CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_LOCATION`; entfernt (`tools:node="remove"`): `ACCESS_BACKGROUND_LOCATION`,
  `READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`; dazu beim Zusammenführen aus Bibliotheken wie bisher
  `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` (expo-notifications; expo-task-manager braucht es ebenfalls) – keine
  weiteren `uses-permission` in den Manifesten der neuen Module (view-shot, webview, sharing: keine). Info.plist:
  `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`
  (nur weil iOS ihn verlangt – die App fragt „Immer“ nie), `UIBackgroundModes = [location]`. `expo install --check`
  (offline): aktuell; `expo-doctor`: 19/21 grün, 2 brauchen Netz zu exp.host/React Native Directory (in der Sitzung
  gesperrt). Web-Export baut (Bündel unverändert ohne native Module).

**E4 – App:**

- **Aufzeichnen** (`/ausdauer/aufzeichnen`): Erklär-Bildschirm vor der Systemabfrage, „Suche GPS …“/„GPS schwach“,
  große Zahlen (Zeit ohne Pausen, Distanz, Ø-Pace bzw. km/h), Pause/Fortsetzen (neues Teilstück – was dazwischen
  geschieht, zählt nicht: `summarizeRecording`), Stopp mit Rückfrage, 12-h-Grenze, Bildschirm bleibt an. Verweigert →
  „Einstellungen öffnen“ + „Erneut prüfen“; Standort aus → Hinweis.
- **Sicherung:** Zustand alle 30 s, bei Pause/Stopp und beim Wechsel in den Hintergrund verschlüsselt im neuen
  geschützten Speicher `routeRecording` (App AES-GCM, Browser sessionStorage); nach Absturz „Aufzeichnung gefunden –
  Fortsetzen / Beenden und speichern / Verwerfen“ (nur eigenes Konto, Zod-geprüft). Abmelden/Konto löschen leeren ihn.
- **Speichern:** Name, Favorit, Schwierigkeit, Notiz; „zu kurz“ (< 1 min) → nur verwerfen/fortsetzen; < 100 m →
  Rückfrage, dann ohne Tagebuch-Eintrag. Tagebuch: heute geplante Ausdauer gleicher Art ohne Eintrag → „Zu ‚…‘
  zählen?“ (Standard Ja), sonst freie Einheit (A1b); Werte aus der Strecke (`diaryValuesFromSummary`, passt immer zu
  `sessionLogFitsRoute`). Reihenfolge wie S1 N2: Eintrag über die Tagebuch-Warteschlange, dann `save_tracked_route`
  mit Verweis (Herkunft gps), danach neu laden. Die Eintrag-id wird in der Sicherung vermerkt – ein zweiter Versuch
  legt nie einen zweiten Eintrag an.
- **Supabase:** neue verschlüsselte **Strecken-Warteschlange** (`routeQueue`): sendet erst, wenn der verknüpfte
  Eintrag nicht mehr in der Tagebuch-Warteschlange wartet; offline → später; Verknüpfung passt nicht → ohne Verweise
  erneut; abgelehnt → bleibt mit Hinweis („Erneut versuchen“/„Verwerfen“). App vor `db-migrate` (Spalte fehlt) →
  einmal ohne Höhenprofil. Liste offline aus dem zuletzt geladenen Stand.
- **Testmodus:** dieselben Regeln (`tracked-route-rows.ts`: Zod, nicht in der Zukunft, gleiche id, Favorit, Eintrag
  passt, Herkunft gps + Revision, Tageslimit 20), Export enthält die Strecken, Eintrag löschen leert den Verweis.
- **Meine Läufe:** Strecken (Linien-Skizze ohne Kacheln) + Einträge ohne GPS, verknüpfte nur einmal
  (`enduranceActivities`); „wird übertragen“/„nicht gespeichert“; „Alle Strecken löschen“.
- **Auswertung** (`/ausdauer/[id]`): Karte, Gesamt-/Bewegungszeit, Distanz, Ø-Pace/km/h, Höhenmeter „ca.“ + Hinweis,
  Kilometer-Balken (`splitBars`), Höhenprofil, neutraler Vergleich auf Favoriten (`compareAttempts`), Bearbeiten,
  GPX-Datei, „Erneut laufen“, Löschen.
- **Migration (additiv)** `20261020210000_tracked_route_elevation_profile.sql`: `private.elevation_profile_valid`,
  Spalte `tracked_routes.elevation_profile` (CHECK, auch für service_role), `save_tracked_route` = S1-Fassung + nur das
  optionale Feld (db-sync prüft die Obermenge); Export automatisch (`to_jsonb(t)`). pgTAP neu
  `54_tracked_route_elevation.test.sql` (19 Tests; statt 42 zu erweitern – dort ist das Tageslimit schon ausgeschöpft).
- **Web (W-G14):** Hinweis „Aufzeichnen geht in der App“, im Testmodus **Demo-Aufzeichnung** (ausgedachte Runde am
  Rhein im Zeitraffer, Zeit liegt in der Vergangenheit), „Eintragen ohne GPS“ → vorhandenes Nachtragen (A1b).
- **Übersicht/Mehr:** Kachel „Ausdauer“ (km dieser Woche, letzte Aktivität) als eigene Komponente
  (`components/endurance-tile.tsx`, eine Zeile in `uebersicht.tsx`), Eintrag unter „Mehr“. Menüleiste unverändert
  (Reiter wählbar erst mit E2).

**E5:** `enduranceTotals` (Woche Mo–So, Kalendermonat mit Wochenbalken, Tag = Europe/Berlin, je Sportart, neutraler
Vergleich zur Vorperiode), Umschalter Woche/Monat und Blättern in „Ausdauer“. Keine Migration.

**E6:** `privacyTrim` (200 m, Rest < 100 m → ohne Linie), feste Positivliste `STORY_CARD_FIELDS`
(`share/story-card.ts`), Volumen nur Zusatzlast. Bild 1080 × 1920 mit Linie (keine Kacheln, EA-4), Logo, Werte.
App: Ansicht → view-shot → Teilen-Dialog → Datei gelöscht; Browser: Canvas → Web Share bzw. Download. Knöpfe „Als Bild
teilen“ in der Auswertung je Lauf und in jedem Tagebuch-Eintrag (Kraft und Ausdauer).

**Tests:** Core neu/erweitert (elevation-profile, format, privacy-trim, sketch, activities, recording, story-card,
db-sync) – Core gesamt 5.474; App 93 Dateien/929 Tests (u. a. `endurance.test.ts`, `route-queue.test.ts`,
`recording.test.ts`, `story-layout.test.ts`, native-config); pgTAP 51 Dateien/2.664 Tests grün; Playwright
`endurance.spec.ts` (3 Tests: Demo → speichern → Auswertung → Liste/Summen → Story-Bild mit Web-Share-Ersatz,
Download, keine Netzanfrage → löschen; Eintrag ohne GPS + Kachel + Mehr; Wiederaufnahme nach Neuladen + „zu kurz“)
sowie dashboard/history/backfill weiter grün.

**Offen / Risiken:** Gerätetest per Test-APK (HANDY-ANLEITUNG Teil 9b) – Akku 60 min, Sperrbildschirm, Funkloch,
Hersteller-Energiesparen (manche Android-Hersteller beenden Vordergrund-Dienste trotzdem). Karte braucht jsDelivr und
OpenFreeMap (kein SLA; vor Livegang eigener Kachel-Server, PLAN-PHASE-10 11.1, und Datenschutzerklärung). „Reiter
Ausdauer“ kommt mit E2. Play-Store: Erklärung zum Vordergrund-Dienst-Typ `location` im Play-Formular (kein
Hintergrund-Standort).

---

## 9. Datenschutz (alle Etappen)

- Neue Tabellen nur additiv, **RLS nur eigene Zeilen**, `anon` nichts, Partner-Modus nichts, Schreiben nur über
  geprüfte Funktionen, Export + Kaskade; pgTAP je Tabelle.
- `shopping_product_links` = sensibel (Einwilligung, Widerruf löscht); `app_layout_settings` und Strecken = keine
  Gesundheitsdaten (W-G15), Strecken bleiben beim Widerruf.
- Keine Koordinaten, Codes oder Produktnamen in Logs/Analytics; Kamerabilder nie gespeichert (wie E4b).
- Story-Bild: Privatzone, Positivliste, nur lokal erzeugt.

## 10. Definition of Done und Prüfen (je Etappe)

Typen + Zod, Migration mit RLS (wo nötig), Core mit Tests inkl. Grenzfälle, UI mobil + Web, Lade-/Leer-/Fehlerzustände,
Texte Deutsch, `docs/` aktualisiert (Umsetzungsstand hier, `docs/HANDY-ANLEITUNG.md`). Vor jedem PR:
`pnpm format:check`, `pnpm turbo run lint typecheck test`, pgTAP, Playwright (Handy-Ansicht), Wächter-Prüfung.

## 11. So testet ihr es am Handy

- **E1, E2, E5, E6 (Kraft):** Vercel-Vorschau-Link im PR → Testmodus → Einkaufen / Übersicht „Bearbeiten“ / Ausdauer
  (Demo-Aufzeichnung) / Training → „Als Bild teilen“.
- **E3, E4, E6 (Lauf):** GitHub-App → Actions → `eas-build` → „Run workflow“ → APK aus dem Build-Link installieren
  → Standort „Beim Verwenden“ erlauben → kurze Runde aufzeichnen.

## 12. Offene Fragen (mit Empfehlung)

- **EA-1 Standard-Menüleiste mit „Einkaufen“:** Heute sind es schon 5 Knöpfe (Grenze). – **Empfehlung:**
  Übersicht · Training · Ernährung · **Einkaufen** · Mehr; „Fortschritt“ bleibt als Kachel und unter „Mehr“ und
  lässt sich in E2 zurückholen.
- **EA-2 Einkaufen ohne Essensplan:** Heute gibt es dann keine Liste. – **Empfehlung:** trotzdem eigene Artikel und
  Scanner erlauben (Liste der Woche ohne Plan-Einträge); ob dafür `replace_shopping_list` additiv gelockert werden
  muss, klärt E1.
- **EA-3 Sicherer Treffer beim Scannen:** sofort abhaken oder erst bestätigen? – **Empfehlung:** sofort abhaken mit
  „Rückgängig“ (schneller im Laden); unsichere Treffer immer mit Auswahl.
- **EA-4 Hintergrund des Story-Bilds:** nur Linie oder echte Karte? – **Empfehlung:** nur Linie auf Alpha5-Hintergrund
  (keine Kartenkacheln: verrät weniger über den Ort, keine Lizenz-/Kostenfrage); echte Karte später optional.

## 13. Was ihr selbst tun müsst

1. PR #119 (CLAUDE.md-Ausnahme Teilen) mergen – Voraussetzung für E6.
2. Für E3/E4: SETUP Teil D (Expo-Projekt, Secret `EXPO_TOKEN`) erledigt lassen; für iPhone Teil D2 (Apple-Konto).
3. Scanner im echten Betrieb: Produktabfrage ist für die Testphase an (20.10.2026); vor dem öffentlichen Livegang
   Rechtsprüfung aus `docs/PLAN-E4.md`. Ohne Produktabfrage funktionieren gelernte Zuordnungen, eigene Produkte und die
   Auswahl aus der Liste weiter.
4. Fragen EA-1 bis EA-4 beantworten (ohne Antwort gilt die Empfehlung).
