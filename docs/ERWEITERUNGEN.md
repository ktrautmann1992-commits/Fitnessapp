# Erweiterungen – Stand Brainstorming

Diese Datei ergänzt `docs/KONZEPT.md` und `docs/PROMPTS.md`. Claude Code arbeitet sie dort ein (siehe Prompt A unten).

---

## 0. Grundregeln für alle Erweiterungen

### KI-Grenze: Gratis ohne KI, Premium mit KI
- **Alle Funktionen mit Echtzeit-KI sind ausschließlich Premium:** Kalorien per Foto, Körperfoto-Analyse, KI-Coach, KI-Erklärungen in Worten.
- Die Prüfung, ob ein Nutzer Premium hat, erfolgt **immer auf dem Server**, nie nur in der App.
- Jede KI-Funktion hat ein **eigenes Monatslimit pro Nutzer** (konfigurierbar). Tabelle `ai_usage` protokolliert Funktion, Tokens und Kosten. Bei erreichtem Limit: klare Meldung, keine stille Fehlfunktion.
- Alles andere läuft über feste Regeln und Datenbank – ohne laufende KI-Kosten.

### Nicht bauen
- **Kein Teilen, keine Community, keine Ranglisten, keine öffentlichen Profile.** Strecken, Fotos und Challenges bleiben privat.

### Vorschlag Gratis / Premium für die neuen Funktionen
| Funktion | Gratis | Premium |
|---|---|---|
| Lebensmittel-Tracker mit Barcode | Ja | Ja |
| Standardgerichte | Ja | Ja |
| Fitnessstudio suchen und im Profil anlegen | Ja | Ja |
| Mitgliedschaft mit Laufzeit, Preis, Kündigungserinnerung | Ja | Ja |
| Strecken aufzeichnen, Favoriten, Schwierigkeit | Ja | Ja |
| Körperumfänge und Mess-Erinnerungen | Ja | Ja |
| Monats-Challenges | Ja | Ja |
| Einfache Progression (Gewicht steigt bei geschafften Wdh.) | Ja | Ja |
| Live-Anpassung des Plans (alle Regeln aus Abschnitt 9) | Nein | Ja |
| Gerichte vor und nach dem Training | Nein | Ja |
| Kalorien per Foto (KI) | Nein | Ja |
| Körperfoto-Analyse (KI) | Nein | Ja |

---

## 1. Lebensmittel-Tracker mit Barcode-Scan
- Scan über die Handykamera, Abfrage bei **Open Food Facts** (Lizenz ODbL: Quellenangabe in der App), Ergebnis in eigener Tabelle zwischenspeichern.
- Nicht gefunden: manuell anlegen (Name, Marke, kcal, Eiweiß, Kohlenhydrate, Fett pro 100 g) – nur für den eigenen Nutzer sichtbar.
- Menge eingeben (g, Stück, Portion), Zuordnung zu Mahlzeit (Frühstück, Mittag, Abend, Snack, vor/nach Training).
- Tagesübersicht: Ziel aus der Ernährungs-Engine gegen tatsächlich Gegessenes.
- Zuletzt gegessen und Favoriten für schnelles Eintragen.

## 2. Standardgerichte
- Nutzer legt eigene Gerichte an („Mein Porridge“, „Shake nach dem Training“) mit kcal und Makros – direkt eingegeben oder aus Zutaten berechnet.
- Mit einem Tipp ins Tagebuch, Portion anpassbar.

## 3. Gerichte vor und nach dem Training (Premium, ohne KI)
- Für **jede geplante Einheit** berechnet die Ernährungs-Engine Zielmengen und Zeitfenster abhängig von Art, Dauer und Intensität der Einheit sowie Körpergewicht und Ziel:
  - größere Mahlzeit ca. 2–3 Stunden vorher
  - kleiner Snack ca. 30–60 Minuten vorher (optional)
  - Mahlzeit nach dem Training innerhalb von ca. 1–2 Stunden
  - bei langen Ausdauereinheiten zusätzlich Verpflegung während der Einheit
- Die App schlägt **konkrete Gerichte** aus der freigegebenen Rezeptdatenbank vor, skaliert die Portion auf die Zielmenge und berücksichtigt Ernährungsform, Schwein ja/nein, Vorlieben, Abneigungen, Unverträglichkeiten und Kochmodus.
- Immer eine **schnelle Alternative** ohne Kochen (z. B. Shake, Banane mit Quark).
- Sonderfall **Training früh morgens**: kleiner, leicht verdaulicher Vorschlag oder Fokus auf die Mahlzeit danach.
- **Erinnerung per Push** zum richtigen Zeitpunkt („In 2 Stunden ist Training – Zeit für …“), abschaltbar.
- Rezepte dafür werden über die Content-Pipeline erzeugt und mit Tag `vor_training` / `nach_training` / `waehrend` versehen.

## 4. Kalorien per Foto (Premium, KI)
- Foto der Mahlzeit → Claude-API mit Bildeingabe schätzt Lebensmittel und Portionen → Abgleich mit Lebensmitteldatenbank.
- Ergebnis immer als **Vorschlag**: Nutzer bestätigt oder korrigiert Lebensmittel und Mengen, erst dann wird eingetragen.
- Hinweis, dass es sich um eine Schätzung handelt.
- Foto standardmäßig nach der Auswertung löschen; Speichern nur, wenn der Nutzer es aktiv möchte.
- Tageslimit und Monatslimit über `ai_usage`.

## 5. Fitnessstudio in der Nähe
- Suche nach Studios im Umkreis des Standorts über **OpenStreetMap** (kostenlos; alternative Anbieter nur nach Kostenprüfung).
- Studio im Profil als „Mein Studio“ speichern.
- Hat das Studio eine hinterlegte Geräteliste (Partnerstudio oder vom Nutzer gepflegt), wird sie automatisch als **Equipment-Profil** für den Trainingsplan genutzt.
- Vorbereitung für B2B: Feld „Partnerstudio“, später eigene Geräteliste und Branding.

## 6. Mitgliedschaft im Studio
- Felder: Studio, Vertragsbeginn, Mindestlaufzeit, Kündigungsfrist, Monatsbeitrag, Notizen.
- **Erinnerung vor Ablauf der Kündigungsfrist** (z. B. 4 Wochen und 1 Woche vorher).
- Kennzahl „Kosten pro Trainingsbesuch“ aus Beitrag und protokollierten Studio-Einheiten.

## 7. Strecken aufzeichnen (ohne Community)
- GPS-Aufzeichnung in der App für Laufen und Radfahren: Distanz, Höhenmeter, Dauer, Pace bzw. Geschwindigkeit, Strecke auf der Karte.
- Aufzeichnung im Hintergrund (Standortberechtigung mit verständlicher Begründung für App Store und Play Store).
- Strecke speichern mit Name, **Favorit**, Schwierigkeit **leicht / mittel / schwer**, Notiz.
- Favoriten erneut laufen/fahren und Zeiten vergleichen; Aufzeichnung landet automatisch im Trainingstagebuch.
- GPX-Export für die Uhr.
- Alles privat. Kein Teilen.

## 8. Körperumfänge mit Mess-Erinnerung
- Erfassung: Oberarm, Brust, Schulter, Taille, Bauch, Oberschenkel (optional: Hüfte, Wade). Links/rechts wo sinnvoll.
- Im Onboarding als **optionaler** Schritt, mit kurzer Mess-Anleitung pro Stelle (Bild/Animation).
- **Mess-Update**: App erinnert in festem Abstand (Standard alle 4 Wochen, einstellbar) zum Nachmessen; zusammen mit Gewicht.
- Verlaufsdiagramme pro Umfang.
- Die Werte fließen in die Live-Anpassung (Abschnitt 9).

## 9. Live-Anpassung des Trainingsplans (Premium, ohne KI)
Der Plan passt sich **sofort** an, sobald neue Daten eingehen – über feste Regeln in `packages/core`, nicht über KI.

**Auslöser:** Einheit eingetragen, Einheit verpasst, Mess-Update, neue Wearable-Daten, Ziel oder Wettkampfdatum geändert.

**Regeln (Startwerte, zentral in `constants.ts`, mit Tests):**
- Alle Wiederholungen geschafft und Belastung niedrig → Last steigt.
- Belastung über mehrere Einheiten sehr hoch → Last oder Umfang sinkt.
- Keine Steigerung bei einer Übung über ca. 3 Wochen → Variation oder Erholungswoche.
- Weniger als ca. 70 % der Einheiten geschafft über 3 Wochen → Vorschlag, den Plan auf weniger Tage umzustellen (Nutzer bestätigt).
- Fettverlust: Taille/Bauch und Gewicht stagnieren über ca. 4 Wochen → Kalorien leicht anpassen, **immer innerhalb der Schutzgrenzen aus CLAUDE.md**.
- Muskelaufbau: Gewicht und Umfänge stagnieren, Kraft steigt nicht → Kalorien leicht erhöhen oder Volumen anpassen.
- Schlechte Tagesform aus Wearable → leichtere Einheit für heute vorschlagen.

**Transparenz:**
- Jede Anpassung wird in `plan_adjustments` gespeichert (Grund, vorher, nachher).
- Nutzer sieht „Warum hat sich mein Plan geändert?“ in einfachen Worten (Textbausteine, keine KI).
- Kleine Anpassungen automatisch, große (weniger Trainingstage, Kalorienänderung) nur nach Bestätigung.
- Optional Premium-KI: ausführlichere Erklärung in Worten.

**Technik:** Neuberechnung ereignisgesteuert auf dem Server (Datenbank-Trigger bzw. Server-Funktion), Ergebnis sofort in der App sichtbar; offline eingetragene Daten lösen die Neuberechnung beim nächsten Sync aus.

## 10. Körperfoto-Analyse (Premium, KI)
- Fotos in festen Posen (vorne, seitlich, hinten) mit Umriss-Hilfe auf dem Kamerabild, Erinnerung zusammen mit dem Mess-Update.
- KI vergleicht zwei Zeitpunkte und beschreibt **sichtbare Veränderungen** sachlich und ermutigend.
- **Keine** Körperfett-Prozentzahl aus Fotos, keine Bewertung von Aussehen oder Attraktivität, keine abwertenden Aussagen.
- Eigene Einwilligung, verschlüsselte Speicherung im privaten Bereich, jederzeit löschbar, keine Nutzung für andere Zwecke.
- Monatslimit über `ai_usage`.

## 11. Monats-Challenges
- Jeden Monat eine Auswahl an Challenges, im Admin-Bereich angelegt. Nutzer tippt „Ich mache mit“.
- Arten: Anzahl Einheiten, Lauf-/Raddistanz, Schritte, Mobility-Minuten, Wasser trinken, regelmäßiges Messen. Dauer: Woche oder Monat, Ziel täglich oder gesamt.
- **Fortschritt automatisch** aus Tagebuch, Strecken und Wearables; manuelles Abhaken nur, wo nötig.
- Nur passende Challenges anzeigen: keine Konflikte mit Erholungswoche, Tapering oder Gesundheits-Check; Umfang innerhalb der Sicherheitsgrenzen.
- **Nicht erlaubt:** Essens-, Fasten- oder Abnehm-Challenges, Challenges, die zu Übertraining verleiten.
- Ein **Joker pro Monat** für einen verpassten Tag; Serien springen nicht hart auf null.
- Abzeichen nach Abschluss, privat.
- Optional Sponsor (Supplement-Hersteller, Partnerstudio) mit Rabattcode – klar als Werbung gekennzeichnet.

---

## Neue Tabellen (Ergänzung zum Datenmodell)
- `food_products` (barcode, name, marke, nährwerte pro 100 g, quelle, user_id bei eigenen)
- `food_log_entries` (user_id, datum, mahlzeit, product_id oder custom_meal_id, menge, nährwerte)
- `custom_meals`, `custom_meal_items`
- `meal_photo_estimates` (user_id, ergebnis jsonb, bestätigt, foto_gespeichert)
- `gyms` (osm_id, name, adresse, lat, lng, equipment jsonb, ist_partner)
- `user_gyms` (user_id, gym_id, ist_hauptstudio)
- `gym_memberships` (user_id, gym_id, beginn, mindestlaufzeit_monate, kuendigungsfrist_tage, monatsbeitrag, notizen)
- `tracked_routes` (user_id, name, sportart, geometrie, distanz_m, hoehenmeter, dauer_s, schwierigkeit, favorit, notiz)
- `body_measurements` (user_id, datum, je Umfang eine Spalte in cm)
- `measurement_reminders` (user_id, intervall_tage, naechstes_datum)
- `progress_photos` (user_id, datum, pose, speicherpfad) – sensibel
- `photo_analyses` (user_id, foto_a, foto_b, ergebnis_text)
- `plan_adjustments` (user_id, zeitpunkt, ausloeser, regel, vorher jsonb, nachher jsonb, bestaetigt)
- `ai_usage` (user_id, funktion, tokens, kosten, zeitpunkt)
- `challenges`, `challenge_participations`, `challenge_progress`

Alle mit RLS, sensible Tabellen wie in CLAUDE.md beschrieben.

---

## Neue und erweiterte Phasen

**Einordnung:** Körperumfänge kommen ins MVP (Phase 1). Die übrigen Erweiterungen hängen sich an die bestehenden Phasen an.

### Ergänzung zu Phase 1
```
Ergänze das Onboarding um den optionalen Schritt Körperumfänge nach ERWEITERUNGEN.md Abschnitt 8, inklusive Mess-Anleitung, Tabelle body_measurements und measurement_reminders mit RLS.
```

### Phase 4b – Live-Anpassung
```
Setze ERWEITERUNGEN.md Abschnitt 9 um: Regel-Engine in packages/core mit umfassenden Tests, ereignisgesteuerte Neuberechnung auf dem Server, Tabelle plan_adjustments, Ansicht „Warum hat sich mein Plan geändert?“, Bestätigung bei großen Änderungen, Mess-Erinnerungen per Push. Premium-Prüfung auf dem Server; Gratis-Nutzer behalten die einfache Progression.
```

### Erweiterung Phase 5 – Lebensmittel-Tracker, Standardgerichte, Gerichte vor/nach dem Training
```
Setze ERWEITERUNGEN.md Abschnitte 1, 2 und 3 um: Barcode-Scan mit Open Food Facts und Quellenangabe, Ernährungstagebuch mit Tagesziel, Standardgerichte, Vorschläge für Gerichte vor, während und nach jeder geplanten Einheit aus der Rezeptdatenbank mit skalierten Portionen, schneller Alternative und Push-Erinnerung zum richtigen Zeitpunkt. Ergänze die Content-Pipeline um passende Rezepte mit den Tags vor_training, nach_training und waehrend.
```

### Erweiterung Phase 7 – KI-Grenze und Limits
```
Setze ERWEITERUNGEN.md Abschnitt 0 um: zentrale Server-Prüfung für Premium bei allen KI-Funktionen, Tabelle ai_usage, konfigurierbare Monatslimits pro Funktion, verständliche Meldung bei erreichtem Limit, Kostenübersicht im Admin-Bereich.
```

### Phase 7b – KI-Funktionen für Premium
```
Setze ERWEITERUNGEN.md Abschnitte 4 und 10 um: Kalorien per Foto mit Bestätigung durch den Nutzer und Körperfoto-Analyse mit Posen-Hilfe, eigener Einwilligung und verschlüsselter Speicherung. Beide nur für Premium, mit Limits aus ai_usage. Halte dich strikt an die Regeln zu Formulierungen in Abschnitt 10.
```

### Phase 9b – Studio und Mitgliedschaft
```
Setze ERWEITERUNGEN.md Abschnitte 5 und 6 um: Studiosuche über OpenStreetMap, „Mein Studio“ im Profil, Geräteliste als Equipment-Profil für die Plan-Engine, Mitgliedschaft mit Laufzeit, Kündigungsfrist und Beitrag, Erinnerungen vor der Kündigungsfrist, Kosten pro Trainingsbesuch.
```

### Erweiterung Phase 10 – Strecken aufzeichnen
```
Setze ERWEITERUNGEN.md Abschnitt 7 um: GPS-Aufzeichnung mit Hintergrundbetrieb, Distanz, Höhenmeter, Dauer, Pace, Speichern mit Name, Favorit und Schwierigkeit leicht/mittel/schwer, automatischer Eintrag ins Trainingstagebuch, GPX-Export. Kein Teilen, keine Community.
```

### Phase 11b – Monats-Challenges
```
Setze ERWEITERUNGEN.md Abschnitt 11 um: Challenges im Admin-Bereich anlegen, Teilnahme per Tipp, automatischer Fortschritt aus Tagebuch, Strecken und Wearables, Filter nach Ziel und Planphase, Joker pro Monat, private Abzeichen, optionaler gekennzeichneter Sponsor. Keine Essens-, Fasten- oder Abnehm-Challenges, keine Ranglisten.
```

---

## Prompt A – Erweiterungen in die Projektdokumente einarbeiten
(Zuerst ausführen, sobald der Pull Request aus Phase 0 gemergt ist.)
```
Lies CLAUDE.md und ERWEITERUNGEN.md im Hauptverzeichnis.
1. Arbeite alle Erweiterungen in docs/KONZEPT.md ein: passende Abschnitte ergänzen, Datenmodell erweitern, Monetarisierung mit der Gratis/Premium-Tabelle aktualisieren.
2. Arbeite die neuen und erweiterten Phasen an den richtigen Stellen in docs/PROMPTS.md ein.
3. Ergänze CLAUDE.md um die KI-Grenze (alle Echtzeit-KI-Funktionen nur Premium, Server-Prüfung, Limits über ai_usage) und die Regel „Kein Teilen, keine Community“.
4. Verschiebe ERWEITERUNGEN.md nach docs/.
Schreibe noch keinen App-Code. Zeig mir zum Schluss in einfachen Worten, was du geändert hast. Ergebnis als Pull Request.
```
