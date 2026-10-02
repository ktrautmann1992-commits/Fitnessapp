# Fachkonzept – [APP-NAME]

## 1. Zielgruppe & Ziele
- DACH, Einsteiger, Fortgeschrittene, ambitionierte/professionelle Ausdauersportler
- Ziele: Fettverlust, Definition, Muskelaufbau, Allgemeine Fitness, Ausdauer
- Ausdauer-Disziplinen: 5 km, 10 km, Halbmarathon, Marathon, Triathlon (Sprint, Olympisch, Mitteldistanz, Langdistanz), Radfahren, Schwimmen
- Optional Wettkampfdatum → Periodisierung rückwärts vom Wettkampf

## 2. Onboarding (Reihenfolge)
1. Geschlecht (männlich/weiblich) → bei weiblich: Zyklusmodul anbieten (opt-in)
2. Alter (min. 16), Größe, Gewicht, optional Körperfett, Ruhepuls
3. Gesundheits-Check (Herz-Kreislauf, Schwangerschaft, Verletzungen/Beschwerden, Medikamente ja/nein) + Einwilligungen
4. Trainingserfahrung (Einsteiger / Fortgeschritten / Leistungssport)
5. Ziel + ggf. Disziplin + Wettkampfdatum
6. Zeitbudget: Trainingstage/Woche, Minuten/Einheit, bevorzugte Wochentage
7. Trainingsort: Studio / Zuhause / beides
8. Equipment zu Hause: Kurzhanteln (Gewichtsstufen), Langhantel + Scheiben, Kettlebells (kg), Flachbank, Schrägbank, Klimmzugstange, Widerstandsbänder, Rudergerät, Ergometer, Laufband, Sonstiges (Freitext)
9. Ernährung: omnivor / vegetarisch / vegan; Schwein ja/nein; mag / mag nicht (Lebensmittel-Auswahl); Unverträglichkeiten; Mahlzeiten pro Tag
10. Kochmodus: täglich frisch / Meal-Prep (wie oft pro Woche)
11. Wearable verbinden (optional, überspringbar)

## 3. Content-Pipeline (Offline-KI)
- Skripte in `packages/content` erzeugen per Claude Message Batches API (kostengünstig, asynchron):
  - Plan-Vorlagen (Matrix: Ziel × Level × Tage/Woche × Minuten × Equipment-Profil × Geschlecht wo sinnvoll)
  - Ausdauer-Blöcke (Basis, Aufbau, Spitze, Tapering) je Disziplin und Level
  - Rezepte (getaggt: Ernährungsform, Schwein, Kochmodus, Zubereitungszeit, Makros pro Portion, Haltbarkeit für Meal-Prep)
  - Übungsbeschreibungen, Technik-Hinweise, Alternativen
- Jede Ausgabe: JSON-Schema-Validierung → Status `draft` → Review im Admin-Bereich → `published`
- Plausibilitäts-Checks automatisch (z. B. Makros eines Rezepts rechnerisch prüfen, Wochenvolumen innerhalb Grenzen)
- Fachliche Freigabe durch qualifizierte Person (Trainer/Ernährungsfachkraft) vor Veröffentlichung empfohlen

## 4. Trainingsplan-Engine (`packages/core/plan`)
1. **Matching:** passende Vorlage nach Ziel, Level, Tagen, Dauer, Equipment-Profil (Scoring, beste Übereinstimmung)
2. **Equipment-Anpassung:** Übung nicht machbar → Alternative aus Bibliothek mit gleichem Bewegungsmuster/Muskelgruppe
3. **Terminierung:** Einheiten auf bevorzugte Wochentage, Erholungsabstände beachten
4. **Laststeuerung:** Startgewichte aus Selbsteinschätzung bzw. erstem Testtraining; danach doppelte Progression (erst Wiederholungen, dann Gewicht); RPE-Ziel pro Satz
5. **Deload:** alle 4–6 Wochen bzw. bei sinkender Leistung/hoher Belastungsempfindung
6. **Ausdauer:** Intensitätsverteilung ca. 80/20, Zonen aus Testlauf/Herzfrequenz, Umfangsteigerung ≤10 %/Woche, Tapering vor Wettkampf
7. **Neuplanung:** verpasste Einheiten sinnvoll verschieben oder streichen, nie stapeln
8. **Fallback:** keine Vorlage passt → Echtzeit-KI-Generierung mit gleichem Schema + Validierung (Premium, rate-limitiert)

## 5. Tagesansicht & Trainingstagebuch
- Heute: geplante Einheit mit allen Übungen, Sätzen, Wiederholungen, Zielgewicht, Pause
- Pro Übung: abhaken / nicht gemacht / Alternative durchgeführt (Auswahl aus Alternativen)
- Pro Satz: Gewicht, Wiederholungen, optional RPE
- Ausdauer: Distanz, Zeit, Pace/Geschwindigkeit, Höhenmeter, Herzfrequenz (manuell oder aus Wearable)
- Belastungsempfinden der Einheit: Schieberegler 0–10
- Notizen, Pausentimer, Aufwärm- und Mobility-Block, Übungsvideos/Animationen
- Offline-fähig, Sync später

## 6. Ernährungs-Engine (`packages/core/nutrition`)
- Grundumsatz: Mifflin-St Jeor (bzw. Katch-McArdle, wenn Körperfett bekannt)
- Gesamtumsatz: Grundumsatz × Alltagsfaktor + Trainingsenergie der geplanten Einheiten (tagesgenau)
- Zielanpassung: Defizit/Überschuss je Ziel, mit Schutzgrenzen aus CLAUDE.md
- Makros: Eiweiß nach g/kg je Ziel; Kohlenhydrate bei Ausdauer an Trainingslast periodisiert; Rest Fett (Mindestmenge einhalten)
- Timing: Mahlzeit vor dem Training (2–3 h vorher) bzw. Snack (30–60 min vorher), Mahlzeit nach dem Training mit Eiweiß + Kohlenhydraten; an Tagen mit langen Einheiten Verpflegung während des Trainings
- Wettkampf: Carb-Loading-Tage, Frühstück am Wettkampftag, Gel-/Trinkplan
- Plan-Erzeugung: Rezepte aus Datenbank filtern (Vorlieben, Ernährungsform, Kochmodus) → Optimierung auf Tagesmakros (Portionsgrößen skalieren) → Wochenplan
- Einkaufsliste: aggregiert, nach Supermarkt-Abteilung sortiert, abhakbar, Meal-Prep-Mengen
- Lebensmittel tauschen, Barcode-Scanner (Open Food Facts; Lizenz beachten)

## 7. Supplement-Modul
- Nur evidenzbasiert: Proteinpulver (wenn Eiweißziel über Ernährung schwer erreichbar), Kreatin-Monohydrat, Koffein (vor Training, mit Tageslimit und Hinweis auf Schlaf), Vitamin D (Hinweis: Spiegel ärztlich prüfen lassen), bei Ausdauer: Kohlenhydrat-Gels/Elektrolyte; Omega-3 optional
- Zeitplan: vor Training / nach Training / vor dem Schlafen / täglich
- Datenfeld pro Supplement: Evidenzstufe, Begründungstext, Gegenanzeigen-Flags (Schwangerschaft, Nierenerkrankung, Medikamente, Alter <18)
- Gegenanzeige erkannt → keine Empfehlung, Hinweis auf ärztliche Rücksprache
- Affiliate-Links pro Supplement (mehrere Shops), klar als Werbung gekennzeichnet

## 8. Zyklus-Modul (opt-in)
- Zyklusstart, Länge, Symptome, Energie, Schlaf – täglich in Sekunden erfassbar
- Hormonelle Verhütung / Schwangerschaft / Wechseljahre als Status
- Anpassung adaptiv: bei gemeldeten Beschwerden/niedriger Energie leichtere Alternative vorschlagen; keine starren Regeln nach Phase
- Ernährungshinweise flexibel (z. B. Energiebedarf, Eisenreiche Lebensmittel)

## 9. Wearables & Readiness
- HealthKit (iOS), Health Connect (Android), Strava, Garmin; später Polar, Fitbit, Suunto
- Import: Workouts, Herzfrequenz, Ruhepuls, HRV, Schlaf, Schritte
- Readiness-Score aus Schlaf, Ruhepuls, HRV, letzter Belastung → Vorschlag „Einheit wie geplant / leichter / Ruhetag“

## 10. Strecken
- Vorschläge im Umkreis des Standorts nach Disziplin, Distanz, Höhenmetern, Untergrund
- Quellen: OpenStreetMap, eigene kuratierte Strecken, Nutzer-GPX; Strava/Komoot nur nach Lizenzprüfung
- Kartenanzeige, Navigation per Export (GPX) an Uhr

## 11. Fortschritt & Motivation
- Gewicht, Körperumfänge, Fotos (privat), persönliche Rekorde, Wochenumfang, Konsistenz
- Partner-Modus: gemeinsame Einkaufsliste/Wochenplan, gegenseitige Freigaben
- Wettkampf-Countdown, Erfolge (dezent, nicht ans Gewicht gekoppelt)

## 12. Datenmodell (Kern, Postgres)
- `profiles` (user_id, sex, birth_date, height_cm, experience_level, locale)
- `body_metrics` (user_id, date, weight_kg, body_fat_pct, waist_cm …)
- `consents` (user_id, type, version, granted_at, revoked_at)
- `health_screening` (user_id, answers jsonb, flags, created_at) – sensibel
- `goals` (user_id, goal_type, discipline, target_date, sessions_per_week, minutes_per_session, preferred_days)
- `user_equipment` (user_id, location, equipment_id, weights_kg numeric[])
- `nutrition_prefs` (user_id, diet_type, eats_pork, cooking_mode, mealprep_days, meals_per_day)
- `food_preferences` (user_id, food_id, like/dislike/intolerance)
- `exercises`, `exercise_alternatives`, `equipment`
- `plan_templates`, `template_sessions`, `template_exercises` (Inhalte, status draft/published)
- `user_plans`, `planned_sessions`, `planned_exercises`
- `session_logs` (planned_session_id, status, rpe_0_10, notes, source)
- `set_logs` (session_log_id, planned_exercise_id, performed_exercise_id, set_no, reps, weight_kg, rpe, done)
- `cardio_logs` (session_log_id, distance_m, duration_s, elevation_m, avg_hr, source)
- `foods`, `recipes`, `recipe_ingredients`, `meal_plans`, `meal_plan_items`, `shopping_lists`, `shopping_list_items`
- `supplements`, `supplement_contraindications`, `affiliate_links`, `user_supplement_plans`
- `cycle_entries` – sensibel, verschlüsselt
- `wearable_connections`, `daily_metrics`
- `routes` (geometry, distance_m, elevation_m, discipline, source, license)
- `subscriptions` / Entitlements (über RevenueCat-Webhook)
- `partner_links`, später `organizations` (Fitnessstudios), `org_memberships`

## 13. Monetarisierung
- **Gratis:** Onboarding, Standard-Plan aus Vorlagen, Trainingstagebuch, Grundberechnung Kalorien/Makros, Supplement-Übersicht
- **Premium (Abo monatlich/jährlich):** individuell angepasster Plan mit Progression, Ernährungsplan + Einkaufsliste, Vor-/Nach-Training-Mahlzeiten, Wettkampfvorbereitung, Zyklus-Anpassung, Wearables & Readiness, Strecken, Partner-Modus, KI-Coach
- **Affiliate:** Supplement-Shops (gekennzeichnet, neutral)
- **B2B Fitnessstudios (später):** Studio-Branding, Geräteliste des Studios als Equipment-Profil, Trainer-Dashboard, Lizenz pro Mitglied

## 14. Rechtliches (vor Launch prüfen lassen)
- DSGVO Art. 9 Einwilligung, Datenschutzfolgenabschätzung, AV-Verträge (Supabase, Vercel, RevenueCat, Stripe)
- Abgrenzung zum Medizinprodukt (MDR): keine Diagnosen, keine Therapieaussagen
- Health-Claims-Verordnung, Kennzeichnung Werbung/Affiliate (UWG)
- App-Store-Richtlinien: In-App-Kauf für digitale Abos, HealthKit-Daten nicht für Werbung
- Impressum, AGB, Widerrufsbelehrung, Haftungsausschluss
- Schweiz (revDSG) und Österreich mitprüfen
