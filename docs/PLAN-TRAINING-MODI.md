# Trainings-Modi: Schon-Modus, Reise-Modus, Aufwärmen & Dehnen

Stand 25.10.2026 · Gründer-Freigabe 25.10.2026 (drei Funktionen) · Nachtrag Gründer: Schlingentrainer als Reise-Gerät.
Umgesetzt auf Branch `claude/training-modi` (kein PR, kein Merge). Fachlogik in `packages/core/src/modes/`,
Grenzwerte in `packages/core/src/constants.ts` (`PAIN_REGION_LOAD`, `PAIN_MODE`, `PAIN_MODE_HEALTH_CONSENT_MIN_VERSION`,
`TRAVEL_MODE`, `WARMUP_RULES`), Datenbank `supabase/migrations/20261025120*`.

## 1. Kurzfassung

| Funktion                                  | Was die Person tut                                                                                                              | Was die App tut                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schmerz-/Verletzungsmodus („Schon-Modus“) | Stelle auf der Körperkarte (oder Liste) antippen, Stärke leicht/mittel/stark, Dauer 3/7/14 Tage                                 | tauscht Übungen, die die Stelle belasten, gegen schonendere, senkt Sätze/RPE; endet automatisch; bei „stark“, mehr als 14 Tagen am Stück oder wiederkehrend: „Bitte ärztlich abklären lassen“ + konservativer Plan |
| Reise-Modus                               | Zeitraum, Geräte (nur Körpergewicht / Kurzhanteln / Hotel-Gym / Widerstandsband / Schlingentrainer), optional kürzere Einheiten | setzt die Einheiten im Zeitraum mit den Reise-Geräten neu zusammen; Banner „Reise-Modus bis …“; danach gilt automatisch der Plan                                                                                   |
| Aufwärmen & Dehnen                        | Schalter in den Einstellungen (Standard an), im Training „Überspringen“                                                         | ~5 min Aufwärmen davor (allgemein + Beweglichkeit + leichte Aufwärmsätze der Hauptübung), ~5 min Dehnen danach – aus der Übungs-Bibliothek                                                                         |

## 2. Entscheidungen

1. **Gratis, ohne KI.** Alle drei sind feste Regeln (keine Echtzeit-KI, keine Live-Anpassung im Sinne von KONZEPT 4.1,
   die auf Tagebuch-Daten reagiert). Schon-Modus und Aufwärmen sind Sicherheitsfunktionen (wie das Zyklus-Modul,
   ZY-G1: „kein Verkaufshebel“), der Reise-Modus ist Geräte-Anpassung wie KONZEPT 4 Punkt 2 (gratis). Deshalb keine
   Premium-Prüfung; falls die Gründer anders entscheiden, wäre die Server-Prüfung über `private.has_entitlement_for`
   in den RLS-Policies nachzurüsten.
2. **Nur Anzeige, Plan bleibt gespeichert.** Alle drei wirken als Schichten in `prepareSessionForDisplay()` – der
   gespeicherte Plan, Tagebuch-Zuordnung (`planned_exercise_id`) und Folgeblöcke bleiben unverändert. „Endet
   automatisch“ heißt: am Tag nach dem letzten Tag gibt es keine Schicht mehr. Reihenfolge: Sicherheitsregeln →
   Reise-Geräte → Präferenzen → „Nur heute“ → Schon-Modus → Reise-Minuten. Der Schon-Modus läuft nach den
   Tausch-Schichten, damit keine eigene Wahl eine belastende Übung zurückbringt.
3. **Welche Übung belastet welche Stelle:** abgeleitet aus vorhandenen Übungs-Metadaten (Bewegungsmuster, ggf. nur
   bei Belastungsart – z. B. Liegestütz = Stütz auf den Händen –, Hauptmuskel, `caution_tags`) plus einzeln genannte
   Übungen (`PAIN_REGION_LOAD`). Kein neues Inhaltsfeld: keine Schema-/Datenbank-Änderung an `exercises`, neue
   Übungen werden automatisch erfasst; unbekannte Übungen gelten als belastend. „leicht“ = nur stark belastende
   Übungen, ab „mittel“ zusätzlich die übrigen belastenden.
4. **Schonender Ersatz:** dieselbe Ersatz-Kette wie beim Erzeugen (`findSubstitute`, neu mit `blocked`):
   Alternativen (leichtere zuerst) → Alternativen der Alternativen → gleiches Muster → gemeinsamer Hauptmuskel; nie
   schwerer, immer erlaubt, nie wieder belastend, nie eine Dehnung als Ersatz. Ohne Ersatz entfällt die Übung heute
   (Hinweis; ist die Einheit leer: „Heute passt keine Übung“, Start gesperrt). Belastung: leicht RPE −1, mittel RPE −1
   und Sätze −1, stark RPE −2 und Sätze −1 (nie unter 1 Satz bzw. RPE 5); im Training kein Zusatzsatz und kein
   Steigerungs-Hinweis. Ausdauer bei Knie/Hüfte/Sprunggelenk/unterem Rücken ab „mittel“: Dauer × 0,7, Anstrengung ≤ 3.
5. **Arzt-Hinweis:** „stark“ ODER dieselbe Stelle zusammenhängend länger als 14 Tage (Folge-Einträge mit ≤ 2 Tagen
   Lücke zählen als eine Phase) ODER die dritte Phase derselben Stelle binnen 90 Tagen. Dann „Bitte ärztlich abklären
   lassen“ (Vorschau schon vor dem Speichern, Banner, an jeder Einheit) und konservativer Plan (jede Stelle wie
   „stark“, RPE ≤ 6, keine Sprünge/Wirbelsäulenlast/hohe Technik). Dazu der Notruf-Satz (112) bei sehr starken oder
   plötzlichen Schmerzen. Keine Diagnose, keine Behandlungsaussagen (Textregeln-Test).
6. **Einwilligung:** Schmerz-Einträge sind Gesundheitsdaten → Einwilligung `health_data` in **Fassung ≥ 2**. Der
   unveröffentlichte Entwurf von Fassung 2 (Supplement-Modul) nennt jetzt auch den Schon-Modus
   (`20261025120300_health_consent_v2_training_modes.sql`, ändert nur den Entwurf). Folge: Im Supabase-Modus ist der
   Schon-Modus gesperrt, bis Fassung 2 juristisch geprüft und veröffentlicht ist (App: „wird gerade rechtlich
   geprüft“); im Testmodus nutzbar. Fassung 1 nennt den Modus nicht – deshalb bewusst keine Nutzung unter Fassung 1.
7. **Reise-Modus:** Hotel-Gym = Kurzhanteln, Flachbank, Laufband, Rad-Ergometer (bewusst knapp). Höchstens 42 Tage,
   Beginn höchstens 365 Tage voraus, keine Überschneidungen, Ende nur vorziehen (am ersten Tag beenden = entfernen).
   **Schlingentrainer** (markenneutral, Gerät `suspension_trainer`, Kategorie `bodyweight`, auch im Onboarding unter
   „Equipment zu Hause“ wählbar): Es gibt noch keine Übungen dafür (eigenes Paket) – bis dahin bleiben nur
   Körpergewicht-Übungen machbar, also Rückfall auf Körpergewicht (App-Hinweis). Er zählt nicht als Kraft-Gerät
   (`isStrengthEquipment`), damit wer nur ihn hat, weiterhin den Körpergewicht-Plan bekommt.
8. **Tauschen pausiert,** solange ein Modus an dem Tag wirkt (die App wählt die Übungen selbst; Hinweis an der
   Einheit). Im Trainingsmodus bleiben Alternativen möglich, aber nur schonende bzw. mit Reise-Geräten machbare.
9. **Aufwärmen & Dehnen:** allgemein = Muster `conditioning` ohne Sprünge (Zeit); dynamisch = Muster `mobility` mit
   Wiederholungen; Dehnen = `mobility` mit Haltezeit. Hauptmuskeln nach Sätzen und Reihenfolge (Hauptübung zählt am
   meisten). Leichte Aufwärmsätze der ersten Grundübung (2 × reps_min mit ~50 % Gewicht bzw. halbe Wiederholungen).
   Regeln, Geräte und Schon-Modus gelten auch hier. **Rückfall:** Fehlen freigegebene Übungen (heute in Supabase der
   Fall), zeigt die App den Aufwärm-/Cool-down-Text der Vorlage plus die Aufwärmsätze – nie ein leerer Block. Der
   Schalter liegt nur auf dem Gerät (kein Gesundheitsdatum).
10. **16 neue Übungen als ENTWURF** (`content/exercises`, `status: draft`, mit eigenen Illustrationen): Marschieren auf
    der Stelle, Armkreisen, Schulterblatt-Kreisen, Hüftkreisen im Stand, Beinpendel im Stand, Katze-Kuh,
    Brustdehnung am Türrahmen, seitliche Rumpfdehnung, Trizeps-, Unterarm-, hintere-Schulter-, Oberschenkel-
    Vorderseite-, Beinrückseite-, Waden-, Gesäß- und Adduktoren-Dehnung. **Die Gründer müssen sie prüfen und freigeben**
    (`reviewed_by`/`reviewed_at`, Status `published`, dann Workflow `content-seed`), bevor sie im Supabase-Modus
    erscheinen. Im Testmodus sind sie mit „Testinhalt“ gekennzeichnet. Ersatz-Regel: eine Dehnung ersetzt nie eine
    Kraftübung (`findSubstitute` Schritt 5).

## 3. Datenmodell (Supabase, nur additiv)

- `pain_episodes` (SENSIBEL, Art. 9): Region, Stärke, Dauer (3/7/14), Beginn, vorzeitiges Ende. RLS je Person;
  Schreiben nur mit Einwilligung (Fassung ≥ 2), Server-Trigger: Beginn heute ± 1 Tag, nur „vorzeitig beenden“ als
  Änderung, höchstens 20 neue Einträge/Tag, Sperre der Einwilligung (gleichzeitiger Widerruf wartet). Widerruf
  `health_data` löscht alle (in `private.consents_after_revoke`, Anfang und Ende), Aufräumen nach 365 Tagen
  (`private.cleanup_pain_episodes`, pg_cron täglich), Konto löschen per Kaskade.
- `travel_modes`: Zeitraum, Geräte, Minuten. RLS je Person, Trigger gegen Überschneidung/Verlängerung, ≤ 50 je Konto.
  Kein Gesundheitsdatum (bleibt beim Widerruf).
- Export: beide Tabellen in `export_my_data()` (zweites `jsonb_build_object`, die erste Fassung war an der Grenze von
  100 Argumenten).
- App: eigener geschützter Speicher (`fitnessapp.training-modes.v1`; Browser nur sessionStorage, App verschlüsselt).
  Testmodus speichert alles dort; Supabase nutzt ihn als Zwischenspeicher für offline (Schreiben braucht Verbindung).

## 4. Tests

- Core: `packages/core/src/modes/*.test.ts` – alle 8 Stellen × 3 Stärken an Studio- und Zuhause-Einheit (keine
  belastende Übung, nie schwerer, Dosierung nur gesenkt), 1 vs. 7 Trainingstage, keine Alternative vorhanden, Reise
  - Schmerz gleichzeitig, „Nur heute“ auf eine gesperrte Übung, automatisches Ende, Arzt-Hinweis-Grenzen (genau 14
    Tage, Lücke 2/3 Tage, 3 Phasen in 90 Tagen), Schlingentrainer = Körpergewicht, Aufwärmen mit/ohne Entwürfe.
- pgTAP: `supabase/tests/90_training_modes.test.sql` (Einwilligung inkl. Fassung 1, Werte, Unveränderlichkeit,
  Überschneidung, RLS A/B, Export, Widerruf, Aufräumen, Konto löschen).
- App: `apps/mobile/src/data/training-modes.test.ts`, `apps/mobile/src/i18n/training-modes-texts.test.ts`,
  Playwright `apps/mobile/e2e/training-modes.spec.ts` (Web-Export im Testmodus, 390 px).

## 5. Offene Punkte (Fachprüfung / Gründer)

1. **Physiotherapie/Sportmedizin:** Zuordnung Stelle → Übungen (`PAIN_REGION_LOAD`), Dosierung, Arzt-Hinweis-Grenzen,
   Ausdauer-Regel, Texte. Alles ist als PRODUKTENTSCHEIDUNG markiert.
2. **Juristisch:** Fassung 2 der Einwilligung „Gesundheitsdaten“ (mit Schon-Modus) prüfen und veröffentlichen;
   Medizinprodukt-Abgrenzung (MDR) des Schon-Modus (keine Diagnose, keine Therapie, nur Belastungssteuerung).
3. **Inhalte:** 16 Aufwärm-/Dehn-Entwürfe fachlich prüfen und freigeben; Schlingentrainer-Übungen (eigenes Paket).
4. **Gewicht im Schon-Modus:** Derzeit sinken Sätze und RPE-Ziel, das vorgeschlagene Gewicht folgt weiter dem Tagebuch.
   Ein automatisch leichteres Gewicht würde die Progression als „verfehlt“ werten – Entscheidung offen.
5. **Gratis/Premium** (Abschnitt 2 Nr. 1) bestätigen.
