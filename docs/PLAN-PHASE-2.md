# Plan Phase 2 – Übungsbibliothek und Content-Pipeline

**Status:** Freigegeben mit Empfehlungen, vorbehaltlich Wächter-Prüfung, 03.10.2026 (siehe Abschnitt 15).
Überarbeitet nach dem ersten Wächter-Urteil („nachbessern“) am selben Tag.
Grundlage: `CLAUDE.md`, `docs/KONZEPT.md` (Abschnitte 3, 4, 12 und 15), `docs/PROMPTS.md` (Phase 2),
`docs/ERWEITERUNGEN.md`, `docs/PLAN-PHASE-1.md`.

---

## 1. Ziel in einem Satz

Es gibt eine geprüfte **Übungsbibliothek** und erste **Trainingsplan-Vorlagen**. Die Inhalte entstehen offline als
KI-Entwurf, werden automatisch geprüft und von euch am Handy freigegeben. Erst dann kommen sie in die Datenbank,
aus der die Plan-Engine in Phase 3 die Pläne baut.

## 2. Was ihr am Ende der Phase habt

1. Einen **Startbestand von ca. 50 Übungen** (deutsch, mit Bewegungsmuster, Muskelgruppen, Geräten,
   Technik-Hinweisen und Alternativen) – als **Entwurf**, ehrlich als KI-Entwurf gekennzeichnet.
2. **24 Plan-Vorlagen** für die kleine Matrix: 3 Ziele × 2 Level × 3 oder 4 Tage × Studio/Zuhause – ebenfalls
   als Entwurf.
3. **Automatische Prüfungen** für jede Übung und jede Vorlage (Pflichtfelder, Geräte vorhanden, Wochenvolumen,
   Pausen, Dauer, passende Alternativen, verbotene Heilversprechen) – in der CI, in jedem Workflow, der einen
   Pull Request öffnet, und vor jedem Einspielen.
4. Einen **Redaktionsbereich** auf der Website (`/admin`): Übersicht mit Filtern, Detailansicht wie in der App,
   Prüfergebnisse. Am Handy bedienbar.
5. Den Workflow **`content-generate`**: schickt neue Aufträge an die Claude Message Batches API.
   **`content-collect`** holt die Ergebnisse automatisch ab und öffnet einen Pull Request mit den Entwürfen.
6. Den Workflow **`content-review`**: gibt Inhalte per Knopfdruck frei (öffnet einen Pull Request).
7. Den Workflow **`content-seed`**: spielt nach dem Merge alle freigegebenen Inhalte automatisch in Supabase ein.
8. Die Datenbank-Tabellen `exercises`, `exercise_alternatives`, `plan_templates`, `template_sessions`,
   `template_exercises` mit RLS und automatischen Tests, dazu Studio-Geräte im Geräte-Katalog.

Alles ist **jetzt schon sichtbar**, auch ohne Supabase und ohne Anthropic-Schlüssel (Abschnitt 12).
Noch **nicht** in Phase 2: Pläne für Nutzer (Phase 3), Übungsvideos/Bilder, Ausdauer-Blöcke (Phase 10),
Rezepte (Phase 5 – die Pipeline ist dafür vorbereitet).

---

## 3. Grundidee: Das Repository ist die „Redaktion“

**Entscheidung:** Alle Inhalte liegen als **JSON-Dateien im Repository** – eine Datei pro Übung und pro Vorlage:

- `content/exercises/kniebeuge-langhantel.json`
- `content/plan-templates/muskelaufbau-einsteiger-3t-studio.json`

Jede Datei hat einen **Status**: `draft` (Entwurf), `published` (freigegeben) oder `archived` (zurückgezogen).

**Warum so (Bewertung des Vorschlags):**

1. **Funktioniert sofort** – ohne Supabase und ohne Schlüssel. Die Website zeigt die Dateien direkt an.
2. **Eine einzige Wahrheit.** Würde der Admin-Bereich direkt in die Datenbank schreiben, gäbe es zwei Stände
   (Repo und Datenbank), die auseinanderlaufen. Deshalb fließen Inhalte **nur in eine Richtung**:
   Repo → Datenbank.
3. **Lückenloser Nachweis:** Jede Änderung und jede Freigabe ist ein Pull Request – wer, wann, was. Das ist
   genau die „menschliche Freigabe“ aus `CLAUDE.md`.
4. **Prüfen am Handy:** Jeder Pull Request bekommt einen Vercel-Vorschau-Link. Im Redaktionsbereich dieser
   Vorschau seht ihr die neuen Entwürfe schön dargestellt – nicht als rohes JSON.
5. **Freigabe = Merge.** Erst wenn ein Mensch den Pull Request in der GitHub-App mergt, ist ein Inhalt
   freigegeben. Danach spielt `content-seed` ihn automatisch ein.

**Verbesserung gegenüber dem Vorschlag:** Auch „Freigeben“ und „Bearbeiten“ im Admin-Bereich schreiben **nicht**
in die Datenbank, sondern erzeugen einen Pull Request (Abschnitt 6). So bleibt es bei einer Wahrheit – auch
später mit Supabase.

---

## 4. Ablauf der Content-Pipeline (Bild in Worten)

```
 ① Auftrag            ② Abholen + Prüfen       ③ Freigeben            ④ Einspielen
 content-generate  →  content-collect      →   Vorschau ansehen,  →   content-seed
 (Batch absenden,     (alle 3 Std.; prüft,     Status „published“,    (prüft erneut,
  sofort fertig)       öffnet Pull Request,     Pull Request mergen    nur „published“)
                       startet ci)
```

1. **Auftrag.** Ihr startet in der GitHub-App **Actions → content-generate → Run workflow** und wählt, was
   erzeugt werden soll (Übungen oder Plan-Vorlagen). Das Skript in `packages/content`:
   1. baut pro Inhalt eine Anfrage mit einer kurzen, eindeutigen **`custom_id`** (z. B.
      `tpl-muscle_gain-beginner-3-gym`),
   2. **schätzt vorher die Kosten** (schlimmster Fall) und bricht ab, wenn der Kostendeckel überschritten würde
      (Abschnitt 10),
   3. schickt alles als **einen Batch** an die Claude Message Batches API (halber Preis, Ergebnis meist in unter
      einer Stunde, spätestens nach 24 Stunden) und erzwingt das Antwortformat per **Structured Outputs**
      (JSON-Schema),
   4. legt einen Arbeits-Branch `content/batch-<Datum>-<kurz>` mit einer kleinen Merkdatei an (Batch-Nummer, Art,
      Modell, Kostenschätzung) – und **endet sofort**. Es wird nicht stundenlang gewartet (spart
      GitHub-Actions-Minuten).
2. **Abholen und Prüfen.** `content-collect` läuft **alle 3 Stunden per Zeitplan** (statt stündlich: GitHub rundet jeden Lauf auf eine volle Minute auf) und zusätzlich per Hand. Gibt es
   keinen offenen Batch-Branch, endet es nach wenigen Sekunden, ohne Schlüssel zu brauchen. Ist ein Batch fertig:
   1. Ergebnisse werden **nur über die `custom_id`** zugeordnet, nie über die Reihenfolge.
   2. Jede Antwort wird geprüft: Ergebnis-Art `succeeded` → weiter; `errored`, `expired`, `canceled` → nicht
      gespeichert, im Bericht als „erneut versuchen“; Stopp-Grund `refusal` (Ablehnung) oder `max_tokens`
      (abgeschnitten) → nicht gespeichert, im Bericht.
   3. Gültiges JSON wird zusätzlich mit **Zod** geprüft – auch die Grenzen (Mindest-/Höchstwerte, Längen), die
      das JSON-Schema der Structured Outputs nicht erzwingen kann – und danach mit den Plausibilitäts-Checks.
   4. Gültige Antworten werden `draft`-Dateien; ungültige landen **nicht** im Repository, sondern nur im Bericht.
   5. **Vor dem Pull Request läuft `content:validate` über alle Inhalte** (dazu Formatierung und Typprüfung der
      geänderten Dateien). Hat ein **freigegebener** Inhalt einen roten Fehler, bricht der Workflow ab und
      öffnet keinen Pull Request.
   6. Der Pull Request „Neue Entwürfe: …“ enthält Prüfbericht und tatsächliche Kosten im Text.
   7. **CI für Bot-Pull-Requests:** Pull Requests, die ein Workflow mit dem eingebauten `GITHUB_TOKEN` öffnet,
      starten `ci` **nicht** von selbst. Deshalb startet der Workflow danach `ci` ausdrücklich für den Branch
      (`gh workflow run ci --ref <branch>`; `ci` bekommt dafür den Auslöser „Run workflow“). Das Ergebnis
      erscheint im Pull Request wie gewohnt. Sauberere Alternative für später: eine eigene **GitHub App** als
      Absender (Abschnitt 6) – deren Pull Requests starten `ci` automatisch.
3. **Freigeben.** Passt ein Inhalt, wird sein Status auf `published` gesetzt – per Workflow `content-review`
   (Abschnitt 6) oder später per Knopf im Admin-Bereich. `content-review` setzt den Status nur, wenn **keine
   roten Fehler** vorliegen und eingetragen ist, **wer** geprüft hat; es läuft wie `content-collect`:
   `content:validate` vorher, Bericht im Pull-Request-Text, danach `ci` starten. Merge = Freigabe.
4. **Einspielen.** Nach dem Merge in `main` startet `content-seed` automatisch. **Es prüft vorher selbst alle
   Inhalte** (`content:validate`); bei einem einzigen roten Fehler an einem freigegebenen Inhalt wird **nichts**
   eingespielt. Sonst schreibt es alle `published`-Inhalte in einer Transaktion in Supabase. Mehrfaches
   Ausführen ändert nichts (idempotent). Fehlt Supabase noch, endet der Workflow grün mit Hinweis.

**Probelauf ohne KI:** `content-generate` hat die Option **„Probelauf (ohne KI, kostenlos)“**. Dann nimmt das
Skript fest hinterlegte Beispiel-Antworten (inkl. einer absichtlich fehlerhaften und einer „abgelehnten“), legt
den Batch-Branch an, und `content-collect` verarbeitet sie wie echte Ergebnisse bis zum Pull Request. So prüft
ihr den kompletten Ablauf, bevor ein Schlüssel eingetragen ist.

**Kein `fallbacks` im Batch:** Die automatische Ausweich-Funktion der API bei Ablehnungen gibt es in der
Batch-API nicht. Abgelehnte Anfragen werden nur gemeldet; ihr könnt sie mit einem neuen Lauf wiederholen.

---

## 5. Datenmodell

Alle Tabellen bekommen eine Migration in `supabase/migrations`, **RLS** und pgTAP-Tests. Spaltennamen englisch,
wie bisher. Inhaltstabellen enthalten **keine Nutzerdaten**.

| Tabelle                 | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                            | Lesen / Schreiben                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `exercises`             | `id` (lesbarer Schlüssel), `version`, `status`, `name_de`, `aliases_de[]`, `movement_pattern`, `primary_muscles[]`, `secondary_muscles[]`, `equipment_ids[]` (alle nötig), `mechanics` (Grund-/Isolationsübung), `load_type` (Gewicht, Körpergewicht, Band, Zeit), `unilateral`, `difficulty` (1–3), `caution_tags[]`, Texte (Beschreibung, Schritte, Technik-Tipps, typische Fehler, Sicherheitshinweis), `meta` | `authenticated`: nur `published` lesen. Schreiben nur Seed (service_role)        |
| `exercise_alternatives` | `exercise_id`, `alternative_id`, `reason` (anderes Gerät / leichter / schwerer / Zuhause), `priority`                                                                                                                                                                                                                                                                                                             | nur sichtbar, wenn **beide** Übungen `published` sind (RLS-Regel mit `exists`)   |
| `plan_templates`        | `id`, `version`, `status`, `title_de`, `description_de`, `goal_type`, `experience_level`, `sessions_per_week`, `minutes_min`/`minutes_max`, `location` (Studio/Zuhause), `required_equipment_ids[]`, `optional_equipment_ids[]`, `sex` (meist leer = für alle), `meta`                                                                                                                                            | `authenticated`: nur `published` lesen                                           |
| `template_sessions`     | `template_id`, `day_index` (1…n), `name_de` (z. B. „Ganzkörper A“), `focus`, `estimated_minutes`, Aufwärm- und Cool-down-Hinweis                                                                                                                                                                                                                                                                                  | lesbar, wenn die Vorlage `published` ist                                         |
| `template_exercises`    | `session_id`, `order_no`, `exercise_id`, `sets`, `reps_min`/`reps_max` **oder** `duration_s`, `rest_s`, `rpe_target`, `superset_group`, `notes_de`                                                                                                                                                                                                                                                                | lesbar, wenn die Vorlage `published` ist                                         |
| `admin_users`           | `user_id`, `role` (`content_admin`), `created_at` – wer in den Redaktionsbereich darf (ab Supabase, Abschnitt 6)                                                                                                                                                                                                                                                                                                  | nur eigene Zeile lesbar; Eintragen nur per Workflow `admin-grant` oder Dashboard |

Ergänzungen:

1. **Neue Aufzählungen** (in `packages/core/src/enums.ts` **und** als Postgres-Enum, abgeglichen durch
   `db-sync.test.ts` wie in Phase 1):
   - `content_status`: `draft`, `published`, `archived`
   - `movement_pattern`: `squat`, `hinge`, `lunge`, `horizontal_push`, `vertical_push`, `horizontal_pull`,
     `vertical_pull`, `elbow_flexion`, `elbow_extension`, `shoulder_isolation`, `knee_flexion`,
     `knee_extension`, `hip_extension`, `calf_raise`, `core_anti_extension`, `core_anti_rotation`,
     `core_flexion`, `carry`, `conditioning`, `mobility`
   - `muscle_group`: `chest`, `lats`, `upper_back`, `front_delts`, `side_delts`, `rear_delts`, `biceps`,
     `triceps`, `forearms`, `abs`, `obliques`, `lower_back`, `glutes`, `quadriceps`, `hamstrings`,
     `adductors`, `calves`
2. **Geräte-Katalog für das Studio erweitern.** Bisher enthält `equipment` nur Geräte für Zuhause. Studio-Übungen
   brauchen z. B. `cable_station` (Kabelzug), `lat_pulldown` (Latzug), `leg_press` (Beinpresse),
   `machine_chest_press`, `leg_curl_machine`, `leg_extension_machine`, `dip_station`. Umsetzung:
   1. **Neue Migration** (die alte Seed-Migration aus Phase 1 bleibt unverändert): Spalte `home_selectable`
      (Standard `true`), neue Studio-Geräte mit `home_selectable = false`, eingefügt mit
      `on conflict do update`.
   2. `packages/core`: `EQUIPMENT` bekommt das Feld `homeSelectable`; `db-sync.test.ts` liest die neue
      Migration mit.
   3. Die Prüfung für Nutzer-Geräte (`equipmentItemSchema`) erlaubt beim Ort „Zuhause“ **nur auswählbare**
      Geräte; die Datenbank prüft dasselbe. Die Onboarding-Frage „Equipment zu Hause“ zeigt Studio-Geräte nicht.
   4. Annahme bis Phase 9b: **Studio = gut ausgestattetes Standard-Studio**.
3. **`caution_tags`** beschreiben Eigenschaften einer Übung, **keine** Diagnosen: z. B. `high_impact` (Sprünge),
   `spinal_loading` (schwere Last auf der Wirbelsäule), `overhead`, `long_supine` (lange Rückenlage),
   `high_skill`. Die Plan-Engine (Phase 3) nutzt sie beim Flag `conservative_plan`, um vorsichtigere Übungen
   und niedrigere Intensität zu wählen.
4. **Nur Freigegebenes in die Datenbank.** `content-seed` schreibt nur `published` (und setzt Zurückgezogenes auf
   `archived`, statt es zu löschen – spätere Pläne können darauf verweisen). Entwürfe liegen nie in Supabase.
5. **Einspielen in einem Rutsch:** Die Datenbank-Funktion `seed_content(...)`:
   - schreibt alles in **einer Transaktion** – entweder alles oder nichts,
   - ist nur für `service_role` ausführbar (`revoke` für `public`, `anon`, `authenticated`), mit festem
     `search_path = ''` wie die Phase-1-Funktionen,
   - prüft zusätzlich: Eine freigegebene Vorlage darf nur freigegebene Übungen enthalten; eine Alternative darf
     nicht auf sich selbst zeigen.
6. **Versionen:** Ändert sich ein freigegebener Inhalt, steigt `version` (prüft `content:validate` gegen `main`).
   Die Plan-Engine **kopiert** in Phase 3 die Vorlage in den Nutzerplan („Schnappschuss“). Spätere Änderungen an
   Vorlagen verändern also keine laufenden Pläne.
7. **Herkunft (`meta`)**: `origin` (`claude_session` = Startbestand aus der Umsetzungs-Sitzung, `batch` =
   Batch-API, `manual`), Modell, Batch-Nummer, Erstelldatum, `reviewed_by`, `reviewed_at`, `expert_reviewed`
   (fachlich von Trainer/in geprüft: ja/nein), Prüfnotiz.
8. **Pflichtfelder für die Plan-Engine (Phase 3):** Matching über `goal_type`, `experience_level`,
   `sessions_per_week`, Minuten-Spanne, `location`, Geräte (Pflicht/optional). Geräte-Tausch über
   `exercise_alternatives` mit **gleichem Bewegungsmuster**. Laststeuerung über Wiederholungsbereich,
   RPE-Ziel und `load_type`.
9. **Vorbereitet für Rezepte (Phase 5):** Die Pipeline arbeitet mit „Inhaltsarten“. Jede Art bringt mit:
   Zod-Schema, daraus erzeugtes JSON-Schema, Anfrage-Text, Höchstlänge der Antwort, Plausibilitäts-Checks,
   Ordner und Seed-Abbildung. Rezepte (inkl. Trainings-Tags vor/während/nach dem Training und
   Makro-Rechenprüfung) werden in Phase 5 als weitere Art ergänzt – ohne die Pipeline umzubauen.

**RLS kurz:** `anon` sieht nichts. `authenticated` liest nur `published`. Schreiben darf nur `service_role`
(Seed). pgTAP-Tests prüfen: Entwürfe unsichtbar, Alternativen zu unveröffentlichten Übungen unsichtbar, Schreiben
als Nutzer verboten, `seed_content` für Nutzer gesperrt, Seed zweimal hintereinander ergibt denselben Stand,
Vorlage mit unveröffentlichter Übung wird abgelehnt, Studio-Gerät „Zuhause“ wird abgelehnt.

---

## 6. Redaktionsbereich (`/admin` auf der Website)

### Was man sieht

1. **Übersicht** mit zwei Reitern: **Übungen** und **Plan-Vorlagen**. Zähler je Status
   („12 Entwürfe · 38 freigegeben“).
2. **Filter:** Status, Bewegungsmuster, Gerät, Ziel, Level, Tage pro Woche, Studio/Zuhause, „hat Fehler“.
   Suche nach Namen.
3. **Detailansicht Übung:** so dargestellt wie später in der App (Name, Beschreibung, Schritte, Tipps,
   typische Fehler, Sicherheitshinweis), dazu Geräte, Muskeln, Alternativen (mit Link), Herkunft
   („KI-Entwurf, Claude, 03.10.2026“).
4. **Detailansicht Vorlage:** Wochenübersicht mit allen Einheiten und Übungen (Sätze × Wiederholungen, Pause,
   RPE), geschätzte Dauer je Einheit, **Wochensätze pro Muskelgruppe** als einfache Balken mit Zielbereich.
5. **Prüfergebnisse** oben in jeder Detailansicht: rot = Fehler (blockiert die Freigabe), gelb = Hinweis.
6. Kennzeichnung **„KI-Entwurf – fachlich prüfen“** auf jedem Inhalt ohne Trainer-Prüfung.
7. Für Handys gebaut (eine Spalte, große Knöpfe), heller und dunkler Modus, Lade-, Leer- und Fehlerzustände.
   Für Suchmaschinen gesperrt (`noindex`), nicht zwischengespeichert.
8. Die Inhalte kommen beim Bauen der Website aus den Repository-Dateien. Darum zeigt die Vercel-Vorschau jedes
   Content-Pull-Requests genau die Entwürfe dieses Pull Requests.

### Wer darf hinein? (Entscheidung)

Der Redaktionsbereich zeigt **nur Inhalte, keine Nutzerdaten**. Trotzdem sollen unfertige Entwürfe nicht
öffentlich sein. Darum zwei Stufen:

1. **Stufe A – jetzt, ohne Supabase: Passwort aus Vercel.**
   1. Ihr tragt im Vercel-Projekt **Web** zwei geheime Werte ein: `ADMIN_PASSWORD` (mindestens **20 zufällige
      Zeichen** aus dem Passwort-Manager) und `ADMIN_SESSION_SECRET` (mindestens 32 zufällige Zeichen) – für
      **Production und Preview**. Nichts davon steht im Code.
   2. **Fehlt einer der Werte oder ist das Passwort kürzer als 20 Zeichen, ist `/admin` gesperrt**
      („Redaktionsbereich nicht eingerichtet“) – sicherer Standard.
   3. Passwort-Vergleich auf dem Server in **konstanter Zeit** (beide Seiten zuerst per HMAC auf gleiche Länge
      gebracht, dann `timingSafeEqual`).
   4. Nach dem Login ein **Sitzungs-Cookie**: HMAC-signiert mit `ADMIN_SESSION_SECRET`, mit Ablaufzeit
      (8 Stunden), `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/admin`. Die Prüfung läuft auf dem Server vor
      jeder Admin-Seite und jeder Admin-Aktion.
   5. **Schreibende Aktionen** (Login, später Freigeben/Speichern) prüfen zusätzlich die Herkunft der Anfrage
      (`Origin` muss die eigene Adresse sein).
   6. **Ehrlich zu „Fehlversuche bremsen“:** Ohne Datenbank kann die Website Fehlversuche nicht zuverlässig über
      alle Server hinweg zählen. Schutz bieten das **lange Zufallspasswort** (praktisch nicht zu erraten) und
      eine **Verzögerung** von ca. 1 Sekunde je Fehlversuch. Optional zusätzlich eine Rate-Limit-Regel in der
      **Vercel Firewall** für `/admin` (Klick-Schritte in SETUP Teil G).
   7. **Abmelden für alle:** Wird `ADMIN_SESSION_SECRET` geändert (Redeploy), sind alle Sitzungen ungültig
      (SETUP Teil G). **Deployment Protection** für Vorschau-Links bleibt in Vercel eingeschaltet (Standard).
   8. Hinweis oben: **„Testansicht – Inhalte aus dem Repository“**.
2. **Stufe B – sobald Supabase verbunden ist: eigenes Konto + Rolle** (erst bei Bedarf, Etappe D).
   - Login wie in der App per 6-stelligem E-Mail-Code, danach Prüfung **auf dem Server**, ob euer Konto in
     `admin_users` steht. Eintragen per Workflow **admin-grant** (E-Mail eingeben, fertig) oder im Supabase
     **Table Editor**.
   - Ist Supabase eingerichtet, gilt **nur noch** Stufe B; das Passwort wird ignoriert und kann aus Vercel
     gelöscht werden.
   - Warum eine Tabelle statt `app_metadata`? `app_metadata` lässt sich am Handy im Supabase-Dashboard kaum
     bearbeiten; eine Tabellenzeile schon.

### Freigeben und Bearbeiten

1. **Freigeben per Workflow (geht immer, ab Etappe B):** In der GitHub-App **Actions → content-review → Run
   workflow**: IDs einfügen (im Admin-Bereich gibt es dafür „IDs kopieren“), Aktion `freigeben` /
   `zurückziehen` / `zurück auf Entwurf`, euer Kürzel als Prüfer. Der Workflow ändert die Dateien, prüft sie
   (Abschnitt 4) und öffnet einen Pull Request. Merge = Freigabe.
2. **Freigeben und Bearbeiten direkt im Admin-Bereich (erst bei Bedarf, Etappe D):** Die Knöpfe
   **„Freigeben“** und **„Speichern“** legen selbst einen Pull Request an. Texte, Sätze, Wiederholungen, Pausen
   und Alternativen sind im Formular änderbar; vor dem Absenden prüft der Server mit denselben Regeln. Mehrere
   Änderungen sammeln sich in **einem** offenen Pull Request „Inhalts-Freigabe“.
   - **Zugang zu GitHub – ehrlich bewertet:** Ein „Fine-grained token“ mit dem Recht „Contents: write“ darf
     **alle Dateien** des Repositorys ändern, nicht nur Inhalte. Darum ist die **Schutzregel für `main`**
     (Änderungen nur per Pull Request) **Voraussetzung**, bevor ein solcher Zugang eingerichtet wird.
   - **Empfehlung:** eine eigene **GitHub App** (nur dieses Repository, Rechte „Contents“ und „Pull requests“,
     ihr Schlüssel nur im Vercel-Projekt **Web**, nie im Browser). Vorteile: kein Ablauf alle 90 Tage, an keine
     Person gebunden, und ihre Pull Requests starten `ci` automatisch. Ein Fine-grained token ist die einfachere
     Notlösung.
3. Ohne diesen Zugang zeigen die Knöpfe stattdessen kurz, wie es per Workflow geht.
4. **Workflows öffnen Pull Requests, genehmigen aber nie.** Freigabe ist immer der Merge durch einen Menschen.

---

## 7. Automatische Prüfungen (Plausibilitäts-Checks)

Schemas und Checks liegen in `packages/core` (`content/…`), die Grenzwerte in `constants.ts` mit Quelle. Alles
mit Unit-Tests inkl. Grenzfällen. Das Prüfskript `content:validate` (in `packages/content`) läuft an **vier
Stellen**: in `ci` bei jedem Push, in jedem Workflow **vor** dem Öffnen eines Pull Requests (`content-collect`,
`content-review`), im Admin-Bereich vor dem Speichern und in `content-seed` **vor** dem Einspielen.

**Rot** = Fehler, blockiert Freigabe und Einspielen. **Gelb** = Hinweis, wird angezeigt, blockiert nichts.

| Nr. | Regel                                                                                                                                                    | Stufe                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Ü1  | Schema korrekt (Zod, inkl. Mindest-/Höchstwerte und Textlängen)                                                                                          | rot (auch bei Entwürfen) |
| Ü2  | Alle `equipment_ids` existieren im Katalog                                                                                                               | rot                      |
| Ü3  | Alternative existiert, ist nicht die Übung selbst, kein Doppel                                                                                           | rot                      |
| Ü4  | Alternative hat **dasselbe Bewegungsmuster**                                                                                                             | rot                      |
| Ü5  | Jedes Bewegungsmuster hat eine Variante **ohne Geräte oder nur mit Band**                                                                                | gelb                     |
| Ü6  | **Textregeln:** keine Heilversprechen oder medizinischen Aussagen („heilt“, „Therapie“, „Diagnose“, „garantiert“, „schmerzfrei“, „Reha“ …), keine Marken | rot                      |
| V1  | Anzahl Einheiten = Tage pro Woche, `day_index` eindeutig, jede Übung existiert                                                                           | rot                      |
| V2  | Zuhause-Vorlage nutzt nur ihre Pflicht-/Optional-Geräte (bzw. Alternativen dazu)                                                                         | rot                      |
| V3  | Freigegebene Vorlage enthält nur freigegebene Übungen                                                                                                    | rot                      |
| V4  | Wiederholungen 3–30, Sätze 1–6 pro Übung, RPE 5–9 (Einsteiger höchstens 8); **keine Maximaltests** (RPE 10, 1RM)                                         | rot                      |
| V5  | Pausen: Grundübungen 90–240 s, Isolationsübungen 45–120 s                                                                                                | gelb                     |
| V6  | Geschätzte Dauer je Einheit (Aufwärmen + Sätze + Pausen) in der Minuten-Spanne ±15 %                                                                     | gelb                     |
| V7  | Drücken : Ziehen pro Woche etwa 1 : 1 (mehr als ±30 % Abweichung)                                                                                        | gelb                     |
| V8  | Höchstens 8 Übungen pro Einheit                                                                                                                          | rot                      |
| V9  | **Wochensätze pro Muskelgruppe** (siehe unten): Obergrenze überschritten                                                                                 | rot                      |
| V10 | Wochensätze unter der Untergrenze – **große** Muskelgruppen (Brust, Latissimus, oberer Rücken, Quadrizeps, Beinbeuger, Gesäß)                            | rot                      |
| V11 | Wochensätze unter der Untergrenze – **kleine** Muskelgruppen (z. B. Bizeps, Trizeps, Waden, seitliche Schulter)                                          | gelb                     |

**Wochensätze zählen:** Ein Satz zählt für jeden **Hauptmuskel 1,0** und für jeden **Nebenmuskel 0,5**.
**Startwerte** (Sätze pro Muskelgruppe und Woche, fachlich zu prüfen):

| Ziel               | Einsteiger | Fortgeschritten |
| ------------------ | ---------- | --------------- |
| Muskelaufbau       | 6–14       | 10–22           |
| Fettverlust        | 6–14       | 8–20            |
| Allgemeine Fitness | 4–12       | 6–16            |

Quelle für die Untergrenzen: Schoenfeld BJ, Ogborn D, Krieger JW (2017), „Dose-response relationship between
weekly resistance training volume and increases in muscle mass“, J Sports Sci 35(11):1073–1082 (mehr
Wochensätze → mehr Muskelzuwachs, deutlicher Effekt ab ca. 10 Sätzen). Die Obergrenzen sind eine
Produktentscheidung gegen zu viel Umfang und werden mit der fachlichen Prüfung (Frage 5) bestätigt.

**Was liegen darf:** Ü1 gilt immer – schema-ungültige Dateien kommen gar nicht ins Repository (die Pipeline
speichert sie nicht, die CI lehnt sie ab). Entwürfe dürfen andere rote Fehler haben, damit man sie korrigieren
kann. Ein **freigegebener** Inhalt mit rotem Fehler lässt `ci` fehlschlagen, wird von `content-review` nicht
freigegeben, verhindert das Öffnen eines Pull Requests durch `content-collect` und stoppt `content-seed`
komplett.

---

## 8. Haftung und Sicherheit der Inhalte

1. Übungstexte beschreiben **Technik**, keine Behandlung. Keine Diagnosen, keine Heil- oder Erfolgsversprechen
   (MDR-Abgrenzung, `docs/KONZEPT.md` Abschnitt 14). Die Textregeln aus Abschnitt 7 prüfen das automatisch,
   die Anfrage an Claude verlangt es ausdrücklich.
2. **`conservative_plan`:** Inhalte bekommen Merkmale (`caution_tags`, `difficulty`). Wie vorsichtiger geplant
   wird (leichtere Varianten, RPE höchstens 7, keine Sprünge), entscheidet die Plan-Engine in Phase 3. In der
   App erscheint bei diesem Flag zusätzlich ein Hinweis, dass der Plan bewusst vorsichtig aufgebaut ist und
   Training vorher ärztlich abgeklärt werden sollte (Text kommt in Phase 3).
3. **Schwangerschaft:** Wir erzeugen in Phase 2 **keine** speziellen Inhalte dafür; das braucht fachliche
   Begleitung (Frage 5).
4. **Fachliche Freigabe:** Für den Test reicht eure Freigabe. **Vor dem öffentlichen Start** sollte eine
   qualifizierte Person (z. B. Trainer/in mit Lizenz oder Sportwissenschaftler/in) alle freigegebenen Inhalte
   prüfen; das wird mit `expert_reviewed` festgehalten (`docs/KONZEPT.md` Abschnitt 3).

---

## 9. Startbestand (ohne API-Schlüssel)

**Entscheidung:** Claude erstellt den Startbestand **in der Umsetzungs-Sitzung** – also mit demselben Modell,
das auch die Batch-API nutzen würde, aber ohne API-Kosten:

1. **ca. 50 Übungen**, verteilt auf alle Bewegungsmuster, jeweils mit Varianten für Langhantel, Kurzhantel,
   Kettlebell, Kabel/Maschine (Studio), Band und Körpergewicht – inkl. Alternativen.
2. **24 Plan-Vorlagen** der Matrix (Ganzkörper an 3 Tagen, Oberkörper/Unterkörper an 4 Tagen; Ziel und Level
   über Satzzahl, Wiederholungsbereich, Pausen und RPE).
3. Alles mit Status **`draft`**, Herkunft `claude_session` und Kennzeichnung „KI-Entwurf – fachlich prüfen“.

**Warum auch die Vorlagen jetzt?** Dann lässt sich die Plan-Engine in Phase 3 sofort mit echten Daten bauen und
testen, und die App kann im Testmodus einen Plan zeigen – ohne auf Schlüssel zu warten. Die Batch-API kommt
danach für **mehr** Inhalte zum Einsatz (weitere Minuten-Varianten, Ziele, Ausdauer, Rezepte) und ist an
diesem Startbestand bereits erprobt.

**Ehrlich gesagt:** Der Startbestand ist ein KI-Entwurf wie jeder Batch-Entwurf auch. Er ersetzt **nicht** die
Durchsicht durch euch und vor dem Start durch eine Fachperson.

---

## 10. Kosten der Batch-Läufe (Preise laut Anthropic, Stand 25.09.2026)

**Modell:** einstellbar über die GitHub-Variable `CONTENT_MODEL`, Standard **Claude Opus 5.5**
(`claude-opus-5-5`). Normalpreis 4 $ je 1 Mio. Eingabe-Token und 20 $ je 1 Mio. Ausgabe-Token; die Batch-API
kostet **die Hälfte: 2 $ / 10 $**. Opus 5.5 „denkt“ immer mit; diese Denk-Token zählen als Ausgabe.
Denktiefe über `CONTENT_EFFORT` (Standard `high`, weil Qualität hier wichtiger ist als Cent-Beträge).

**Höchstlänge pro Antwort (`max_tokens`) je Inhaltsart:** Plan-Vorlage **24.000**, Übung **12.000** Token.

| Lauf                    | Anfragen | erwartet (Eingabe / Ausgabe je Anfrage) | erwartete Kosten | schlimmster Fall (volle Ausgabelänge)             |
| ----------------------- | -------: | --------------------------------------- | ---------------: | ------------------------------------------------- |
| 24 Plan-Vorlagen        |       24 | ca. 8.000 / 10.000                      |       ca. 2,80 $ | 24 × 24.000 × 10 $/Mio. + Eingabe 0,38 $ ≈ 6,15 $ |
| 50 Übungsbeschreibungen |       50 | ca. 3.000 / 4.000                       |       ca. 2,30 $ | 50 × 12.000 × 10 $/Mio. + Eingabe 0,30 $ ≈ 6,30 $ |
| Probelauf (ohne KI)     |        – | –                                       |              0 $ | 0 $                                               |

Ein typischer erster Lauf kostet also **unter 3 $ pro Inhaltsart**; selbst im schlimmsten Fall bleibt jeder Lauf
unter dem Deckel.

**Kostendeckel (dreifach):**

1. **Vor dem Absenden** zählt das Skript die Eingabe-Token (Token-Zähl-Funktion der API, kostenlos) und rechnet
   den **schlimmsten Fall** wie in der Tabelle. Liegt der über `CONTENT_MAX_USD` (Standard **15 $** pro Lauf),
   bricht es ab, ohne etwas zu senden.
2. **Pro Lauf** höchstens 200 Anfragen; `max_tokens` je Inhaltsart fest im Code.
3. **Monatslimit in der Anthropic Console** (Empfehlung 30 $, `docs/SETUP.md` Teil E, Schritt 2).

Nach jedem Lauf stehen die **tatsächlichen** Token und Kosten in der Zusammenfassung und im Pull-Request-Text.
Diese Kosten sind Betriebskosten der Redaktion, keine Nutzer-KI – `ai_usage` (Phase 7) bleibt dafür unberührt.
Der regelmäßige `content-collect` (alle 3 Stunden) kostet ohne offenen Batch nur wenige Sekunden Actions-Zeit.

---

## 11. Was ihr einrichten müsst (alles optional, Reihenfolge egal)

Klick-Schritte für den Handy-Browser ergänzt Claude in `docs/SETUP.md`.

1. **GitHub – Workflows dürfen Pull Requests öffnen** (nötig für `content-collect`, `content-review`), neuer
   SETUP-Teil H: Repository → **Settings → Actions → General** → „Workflow permissions“: **Read and write
   permissions** und **Allow GitHub Actions to create and approve pull requests** anhaken → **Save**.
   Unsere Workflows **öffnen** nur Pull Requests und genehmigen nie. Schaltet ihr später Pflicht-Genehmigungen
   ein, darf eine Bot-Genehmigung nicht als Freigabe zählen – Freigabe bleibt der Merge durch einen Menschen.
2. **Schutzregel für `main`** (SETUP Teil H): „Require a pull request before merging“. Ihr könnt weiter selbst
   mergen.
3. **Admin-Passwort (Stufe A)**, neuer SETUP-Teil G: Vercel-Projekt **Web** → Environment Variables:
   `ADMIN_PASSWORD` (≥ 20 Zufallszeichen) und `ADMIN_SESSION_SECRET` (≥ 32 Zufallszeichen), Environments
   **Production und Preview** → Redeploy. Dazu: wie man im Passwort-Manager Zufallsfolgen erzeugt, wie man alle
   abmeldet (Secret ändern + Redeploy) und optional die Rate-Limit-Regel in der Vercel Firewall.
4. **Anthropic-Schlüssel:** wie bisher `docs/SETUP.md` Teil E → GitHub Secret `ANTHROPIC_API_KEY`. Neu:
   `content-generate` und `content-collect` brauchen **nur** diesen Schlüssel (nicht mehr die Supabase-Werte).
   Optional als GitHub **Variables** (nicht geheim): `CONTENT_MODEL`, `CONTENT_EFFORT`, `CONTENT_MAX_USD`.
5. **Supabase** (wenn so weit): Teile A–C, dazu `SUPABASE_URL` + `SUPABASE_SECRET_KEY` als GitHub Secrets für
   `content-seed` und `admin-grant`.
6. **Erst bei Bedarf (Etappe D):** GitHub App für Bearbeiten im Admin-Bereich und `admin-grant` für den
   Supabase-Login.

---

## 12. So testet ihr es am Handy

**Ohne Supabase und ohne Schlüssel (sofort):**

1. Im Pull Request den Vercel-Link der **Website** öffnen → `/admin` aufrufen. Ohne `ADMIN_PASSWORD` erscheint
   „Redaktionsbereich nicht eingerichtet“ – das ist richtig.
2. `ADMIN_PASSWORD` und `ADMIN_SESSION_SECRET` in Vercel eintragen → Redeploy → `/admin` → Passwort eingeben.
3. Übungen durchblättern, nach „Zuhause“ oder „Kurzhanteln“ filtern, eine Übung öffnen: Texte verständlich?
   Alternativen sinnvoll?
4. Eine Plan-Vorlage öffnen: Passt die Woche? Balken „Sätze pro Muskelgruppe“ im grünen Bereich?
5. Falsches Passwort eingeben → Zugang verweigert. Im privaten Tab ohne Login `/admin/...` öffnen → Login-Seite.
6. **Actions → content-generate → Run workflow → Probelauf** → kurz darauf **content-collect → Run workflow**
   (oder bis zu 3 Stunden warten) → neuer Pull Request mit Beispiel-Entwürfen. Im Text steht der Prüfbericht
   (eine Antwort absichtlich ungültig, eine „abgelehnt“), darunter läuft `ci`; die Vercel-Vorschau zeigt die
   Entwürfe im Admin-Bereich.
7. **Actions → content-review → Run workflow** mit einer Übungs-ID und Aktion `freigeben` → Pull Request prüfen
   (`ci` grün) und mergen → die Übung steht danach als „freigegeben“ im Admin-Bereich.
8. **Actions → content-seed** läuft nach dem Merge, prüft alles und endet grün mit „übersprungen – Supabase
   fehlt“.

**Mit Anthropic-Schlüssel:** `content-generate` **ohne** Probelauf starten → Zusammenfassung zeigt die
Kostenschätzung und endet sofort → `content-collect` öffnet nach Fertigstellung des Batches den Pull Request mit
echten Entwürfen und tatsächlichen Kosten.

**Mit Supabase:** Nach dem Merge zeigt `content-seed` „X Übungen, Y Vorlagen eingespielt“; im Supabase
**Table Editor** stehen nur freigegebene Inhalte.

---

## 13. Umsetzung in Etappen

Jede Etappe wird ein eigener Pull Request mit Vorschau-Link und bekommt eine **Wächter-Prüfung**, bevor die
nächste beginnt. Innerhalb einer Etappe kleine, nachvollziehbare Commits.

**Etappe A – Fundament: Fachlogik, Datenbank, Startbestand**

1. `packages/core`: neue Aufzählungen, `EQUIPMENT.homeSelectable` + Studio-Geräte, `equipmentItemSchema` lässt
   Zuhause nur auswählbare Geräte zu, Zod-Schemas für Übungen und Vorlagen, Plausibilitäts-Checks (Abschnitt 7),
   Grenzwerte mit Quellen in `constants.ts` – alles mit Tests.
2. Datenbank: neue Migrationen (Enums, Inhaltstabellen, Geräte-Ergänzung mit `home_selectable`, `admin_users`,
   `seed_content`), RLS, pgTAP-Tests; `db-sync.test.ts` mitziehen; Typen in `packages/db` neu erzeugen.
   Onboarding zeigt weiter nur Heim-Geräte.
3. Startbestand: ca. 50 Übungen und 24 Vorlagen als `draft` in `content/`.
4. Prüfskript `content:validate` als neuer Schritt in `ci`.

**Etappe B – Pipeline und Workflows (mit Probelauf)**

1. `packages/content`: Inhaltsarten, Anfrage-Texte, JSON-Schema aus Zod (nicht unterstützte Schema-Angaben
   entfernt, Grenzen danach per Zod geprüft), Batch absenden, Ergebnisse über `custom_id` abholen und alle
   Ergebnis-Arten behandeln, Kostenschätzung und -deckel, Probelauf, Freigabe-Skript, Seed – mit Tests (API
   dabei simuliert).
2. Workflows: `content-generate` (absenden, sofort fertig), `content-collect` (alle 3 Stunden + per Hand, prüft,
   öffnet PR, startet `ci`), `content-review` (prüft, öffnet PR, startet `ci`), `content-seed` (prüft erst,
   automatisch nach Merge und nach `db-migrate`); `ci` bekommt „Run workflow“. Alle enden ohne Secrets grün
   mit Hinweis.

**Etappe C – Redaktionsbereich Stufe A**

1. `apps/web`: Login Stufe A (Abschnitt 6), Übersicht, Filter, Detailansichten, Prüfergebnisse,
   Volumen-Balken, Lade-/Leer-/Fehlerzustände; Klick-Test (Playwright) in der CI.

**Etappe D – erst bei Bedarf**

1. Freigeben/Bearbeiten direkt im Admin-Bereich über eine GitHub App (Voraussetzung: Schutzregel für `main`).
2. Login Stufe B mit Supabase und `admin_users`, Workflow `admin-grant`.

**Doku (in jeder Etappe mitgezogen):** `docs/SETUP.md` (Teile E, G, H), `docs/KONZEPT.md` (Abschnitt 3
Content-Pipeline und Abschnitt 12 Datenmodell/Abweichungen), `.env.example`, Umsetzungsstand in diesem Plan.

---

## 14. Offene Fragen mit Empfehlung

1. **Welche 3 Ziele in der Matrix?** _Empfehlung:_ Muskelaufbau, Fettverlust, Allgemeine Fitness.
   „Definition“ nutzt bis auf Weiteres die Muskelaufbau-Vorlagen (Kalorien regelt Phase 5); „Ausdauer“ bekommt
   eigene Blöcke in Phase 10.
2. **Welche 2 Level?** _Empfehlung:_ Einsteiger und Fortgeschritten. „Leistungssport“ nutzt im Krafttraining
   vorerst die Fortgeschrittenen-Vorlagen.
3. **Was heißt „Zuhause“?** _Empfehlung:_ Pflicht: Kurzhanteln und Widerstandsbänder; optional: Flachbank,
   Klimmzugstange. Fehlt etwas, tauscht die Plan-Engine über Alternativen (bis hin zu Körpergewicht).
4. **Wie lang ist eine Einheit in der Vorlage?** _Empfehlung:_ 45–60 Minuten. Kürzere Zeitbudgets kürzt die
   Plan-Engine (weniger Sätze/Übungen); eigene 30-Minuten-Vorlagen später per Batch-API.
5. **Wer prüft fachlich?** _Empfehlung:_ Für die Testphase ihr selbst; vor dem öffentlichen Start eine
   qualifizierte Fachperson (Häkchen `expert_reviewed`), die auch die Volumen-Startwerte bestätigt. Inhalte für
   Schwangerschaft nur mit Fachperson.
6. **Welches Modell?** _Empfehlung:_ Claude Opus 5.5 (Standard, `CONTENT_MODEL`). Die Kosten sind klein
   (Abschnitt 10). Claude Sonnet 5.5 wäre noch günstiger (1 $ / 5 $ im Batch) – nur wenn ihr das ausdrücklich
   wollt.
7. **Kostendeckel?** _Empfehlung:_ 15 $ pro Lauf im Skript, 30 $ pro Monat in der Anthropic Console.
8. **Admin-Zugang ohne Supabase per Passwort?** _Empfehlung:_ Ja, wie in Abschnitt 6 (Stufe A), gesperrt ohne
   langes Passwort, abgelöst durch Supabase-Login (Stufe B), sobald gebraucht.
9. **Schutzregel für `main` in GitHub?** _Empfehlung:_ Ja, „Require a pull request before merging“ – Pflicht,
   bevor irgendein Schreibzugang für den Admin-Bereich eingerichtet wird.
10. **Bearbeiten direkt im Admin-Bereich?** _Empfehlung:_ Erst bei Bedarf (Etappe D), dann über eine GitHub App
    statt eines persönlichen Schlüssels. Bis dahin Freigabe per `content-review`.
11. **Übungsnamen?** _Empfehlung:_ Deutscher Name, gängige englische Bezeichnung als Zweitname
    („Kreuzheben (Deadlift)“), damit man Übungen im Studio wiedererkennt.
12. **Bilder/Videos zu Übungen?** _Empfehlung:_ In Phase 2 nur Text. Bilder/Animationen später mit klarer Lizenz
    (eigene Produktion oder lizenzierte Bibliothek), nicht KI-generiert für Technikdarstellungen.
13. **Übungsbibliothek schon in der App zeigen?** _Empfehlung:_ Nein, sie erscheint mit Plan und Tagesansicht
    (Phase 3/4). In Phase 2 ist der Redaktionsbereich die Oberfläche.

---

## 15. Entscheidung

**Status: Freigegeben mit Empfehlungen, vorbehaltlich Wächter-Prüfung, 03.10.2026.**

Die Gründer haben vorab erlaubt, dass Claude mit den Empfehlungen aus Abschnitt 14 fortfährt. Damit gilt:

1. Inhalte als JSON-Dateien im Repository, Repository = einzige Wahrheit, Freigabe = Merge eines Pull Requests
   durch einen Menschen, Datenbank enthält nur Freigegebenes (Abschnitte 3 und 5).
2. Prüfung an vier Stellen (ci, vor jedem Bot-Pull-Request, Admin-Bereich, vor dem Einspielen); Bot-Pull-Requests
   starten `ci` ausdrücklich (Abschnitte 4 und 7).
3. Batch absenden und sofort beenden, Abholen alle 3 Stunden per `content-collect` (Abschnitt 4; angepasst in Etappe B).
4. Redaktionsbereich mit Passwort-Zugang (Stufe A) jetzt; Supabase-Login und Bearbeiten über GitHub App erst bei
   Bedarf (Abschnitt 6).
5. Startbestand (ca. 50 Übungen, 24 Vorlagen) von Claude in der Umsetzungs-Sitzung als `draft` (Abschnitt 9).
6. Matrix: Muskelaufbau, Fettverlust, Allgemeine Fitness × Einsteiger, Fortgeschritten × 3/4 Tage ×
   Studio/Zuhause (Kurzhanteln + Bänder), Einheiten 45–60 Minuten.
7. Batch-API mit Claude Opus 5.5 (per Variable änderbar), `max_tokens` 24.000 (Vorlage) / 12.000 (Übung),
   Kostendeckel 15 $ pro Lauf.

Claude setzt die Etappen A bis C aus Abschnitt 13 nacheinander um, jede mit Wächter-Prüfung. Weicht eine
Wächter-Prüfung ab, wird dieser Abschnitt angepasst, bevor die betroffene Etappe beginnt.

---

## Umsetzungsstand (03.10.2026)

**Etappe A – Fundament: Fachlogik, Datenbank, Startbestand: erledigt** (wartet auf Wächter-Prüfung).

1. **`packages/core`**
   - Neue Aufzählungen (`enums.ts`): `content_status`, `movement_pattern`, `muscle_group`, `exercise_mechanics`,
     `load_type`, `caution_tag`, `alternative_reason`, `session_focus`, `admin_role`, dazu `CONTENT_ORIGINS` und die
     Vorlagen-Matrix (`TEMPLATE_GOAL_TYPES`, `TEMPLATE_EXPERIENCE_LEVELS`).
   - Geräte-Katalog: Feld `homeSelectable`, 8 Studio-Geräte (`power_rack`, `cable_station`, `lat_pulldown`,
     `leg_press`, `machine_chest_press`, `leg_curl_machine`, `leg_extension_machine`, `dip_station`), neue Kategorie
     `machines`; `equipmentItemSchema` lehnt Studio-Geräte beim Ort „home“ ab.
   - `src/content/`: Zod-Schemas für Übungen und Vorlagen (Ü1), Textregeln (Ü6), Wochensätze/Dauer/Drücken-Ziehen,
     Checks Ü2–Ü6 und V1–V11 mit Stufen exakt laut Regeltabelle, `validateContent()` für einen ganzen Inhaltsstand.
   - Grenzwerte mit Quellen in `constants.ts` (`CONTENT_SCHEMA_LIMITS`, `TEMPLATE_DOSAGE_LIMITS`, `REST_RANGES_S`,
     `SESSION_DURATION_ESTIMATE`, `PUSH_PULL_TOLERANCE`, `WEEKLY_SETS_PER_MUSCLE`, große/kleine Muskelgruppen).
2. **Datenbank** (neue Migrationen `20261003130000`–`20261003130600`, die Phase-1-Migrationen bleiben unverändert):
   Kategorie `machines`, Spalte `equipment.home_selectable` + Studio-Geräte + Trigger gegen Studio-Geräte „zu Hause“,
   Inhalts-Enums, `exercises`, `exercise_alternatives`, `plan_templates`, `template_sessions`, `template_exercises`,
   `admin_users`, `seed_content()`. pgTAP: `09_equipment_home_selectable`, `10_content_rls`, `11_seed_content`
   (Entwürfe unsichtbar, Alternativen nur bei zwei freigegebenen Übungen, Schreiben als Nutzer verboten,
   `seed_content` für Nutzer gesperrt, zweimal einspielen = derselbe Stand, Vorlage mit unveröffentlichter Übung und
   Studio-Gerät „Zuhause“ abgelehnt, Archivieren statt Löschen). `packages/db/src/database.types.ts` ergänzt.
3. **Startbestand** unter `content/`: 52 Übungen (17 Bewegungsmuster, jedes mit einer Variante ohne Geräte oder nur
   mit Band) und alle 24 Plan-Vorlagen der Matrix, alle `draft`, `meta.origin = claude_session`,
   `expert_reviewed = false`. Keine roten Fehler (geprüft durch `packages/content/src/startbestand.test.ts`).
4. **`pnpm content:validate`** (`packages/content/src/validate.ts`): Bericht auf Deutsch (ROT/GELB), Exit 1 bei
   Schema-/Dateifehlern und roten Fehlern an freigegebenen Inhalten, Zusammenfassung in GitHub Actions. Neuer Schritt
   in `ci` (mit `--base origin/main` für die Versionsregel); `ci` hatte „Run workflow“ bereits.
5. **App:** Der Onboarding-Schritt „Equipment zu Hause“ zeigt nur `homeSelectable`-Geräte; der Testmodus lehnt
   Studio-Geräte „zu Hause“ ab wie die Datenbank. Klick-Test prüft, dass „Kabelzug“ und „Beinpresse“ fehlen.

**Entscheidungen beim Umsetzen (zur Wächter-Prüfung):**

1. Dateiformat = Spaltennamen (snake_case); ID = Dateiname (Kleinbuchstaben, Ziffern, Bindestriche). Englischer
   Zweitname als eigenes Feld `name_en` (Frage 11). Alternativen stehen in der Übungsdatei (`alternatives`).
2. Kennzeichnung KI-Entwurf über `meta.origin` (`claude_session`/`batch`) + `meta.expert_reviewed` – kein zusätzliches
   Feld `ai_generated`. `published` verlangt `meta.reviewed_by` und `meta.reviewed_at` (Schema, Ü1).
3. Schema-Grenzen (Ü1) sind bewusst weiter als die fachlichen Regeln (z. B. RPE 1–10 im Schema, 5–9 in V4), damit ein
   fehlerhafter Entwurf als Datei liegen und korrigiert werden kann. Dieselben Schema-Grenzen stehen als CHECK in der
   Datenbank (`db-sync.test.ts`).
4. Zusätzliche Datei-Regeln ohne Nummer im Plan: **DATEI** (gültiges JSON, Dateiname = ID, ID eindeutig, nur
   `.json`) und **VERSION** (Abschnitt 5, Punkt 6) – beide blockieren immer. Die Versionsregel vergleicht den
   fachlichen Inhalt ohne `status`/`version`/`meta`; Zurückziehen braucht also keine neue Version.
5. Ü6 (Textregeln) gilt auch für die Texte der Vorlagen. V2 gilt für Zuhause-Vorlagen: eine Übung ist erlaubt, wenn
   ihre Geräte in Pflicht/Optional stehen **oder** eine Alternative damit machbar ist; Studio-Geräte in den Gerätelisten
   einer Zuhause-Vorlage und unbekannte Geräte (alle Vorlagen) sind rot.
6. Wochensätze: kleine Muskelgruppen (V11, gelb) = Bizeps, Trizeps, Waden, seitliche und hintere Schulter, gerade
   Bauchmuskeln; für vordere Schulter, Unterarme, schräge Bauchmuskeln, unteren Rücken und Adduktoren gilt nur die
   Obergrenze (V9).
7. Dauer-Schätzung (V6): 8 min Aufwärmen + Sätze (4 s je Wiederholung bzw. Haltedauer) + Pausen zwischen den Sätzen
   - 60 s Wechsel je Übung (`SESSION_DURATION_ESTIMATE`). Die Datenbank speichert die Schätzung je Einheit
     (`estimated_minutes`); das Einspiel-Skript (Etappe B) berechnet sie mit `estimateSessionMinutes()`.
8. `template_sessions`/`template_exercises` haben stabile zusammengesetzte Schlüssel statt `session_id` (siehe
   `docs/KONZEPT.md` Abschnitt 12).
9. Kniebeuge/Bankdrücken/Schulterdrücken mit Langhantel brauchen das Studio-Gerät `power_rack`
   (`home_selectable = false`). Zu Hause tauscht die Plan-Engine über Alternativen (z. B. Goblet-Kniebeuge). Ob ein
   Rack später unter „Equipment zu Hause“ auswählbar sein soll, ist eine offene Produktfrage.

**Gelbe Hinweise im Startbestand (10, blockieren nicht):**

- V11 bei Muskelaufbau · Fortgeschritten (Untergrenze 10 Wochensätze auch für kleine Muskelgruppen):
  3 Tage Studio: seitliche Schulter 7,5 · Trizeps 9,5 · gerade Bauchmuskeln 8,5 · Waden 9,5;
  3 Tage Zuhause: seitliche Schulter 8,5 · Waden 9,5; 4 Tage Studio: seitliche Schulter 9,5 · gerade Bauchmuskeln 9,5;
  4 Tage Zuhause: seitliche Schulter 9,5. Mehr Sätze würden die Einheiten über 60 Minuten verlängern.
- V6 bei Allgemeine Fitness · Einsteiger · 4 Tage · Zuhause, „Unterkörper B“: geschätzt 37 min (Fenster 38,25–69).

**Etappe B – Pipeline und Workflows (mit Probelauf): erledigt** (wartet auf Wächter-Prüfung).

1. **`packages/content/src/pipeline/`**
   - **Inhaltsarten** (`kinds/`): `exercise` und `plan_template` mit Ordner, `max_tokens` (12.000 / 24.000), Auswahl-
     Matrix, Anfrage-Texten, Antwort-Schema (Zod), Datei-Schema (Ü1) und Abbildung „Antwort → Datei“. Rezepte werden in
     Phase 5 ein weiterer Eintrag in `CONTENT_KINDS` – generate/collect/review bleiben unverändert.
   - **Matrix:** Vorlagen = Ziel × Level × 3/4 Tage × Studio/Zuhause × Minuten `30-45`/`45-60`/`60-75` (72 Zellen; die
     24 Vorlagen des Startbestands = `45-60` werden übersprungen). Übungen = Bewegungsmuster × Geräte-Schwerpunkt
     (Langhantel, Kurzhantel, Kettlebell, Kabel/Maschine, Band, Körpergewicht; 120 Zellen). Auswahl per Begriffen
     (z. B. `muskelaufbau 30-45`), Anzahl 1–200.
   - **Anfrage-Texte** deutsch mit den Regeln aus Abschnitt 7/8 (Dosierung, Pausen, Dauer-Formel, Wochensätze je Ziel
     und Level, Drücken/Ziehen, keine Maximaltests), Textregeln Ü6 mit denselben Begriffslisten wie die Prüfung, keine
     Marken. **Katalog-IDs als erlaubte Werte:** Übungs-IDs (Vorlagen; zu Hause nur mit Heim-Geräten machbare),
     Alternativen nur mit gleichem Bewegungsmuster, Geräte aus dem Katalog (ohne „Sonstiges“); Matrix-Werte als feste
     Konstanten.
   - **JSON-Schema aus Zod** (`json-schema.ts`): nicht unterstützte Angaben (minimum/maximum/multipleOf, minLength/
     maxLength, pattern, minItems/maxItems/uniqueItems, nicht unterstützte Formate) werden entfernt, Typ-Listen werden
     `anyOf`; danach prüft Zod alle Grenzen (Antwort-Schema und Datei-Schema Ü1).
   - **Kosten** (`pricing.ts`, `requests.ts`): Eingabe-Token per `count_tokens` (je Anfrage), schlimmster Fall =
     Eingabe + Anfragen × `max_tokens` × Ausgabepreis (Batch-Preis Opus 5.5: 2 $ / 10 $ je Mio.). Über
     `CONTENT_MAX_USD` (Standard 15) → Abbruch, **bevor** etwas gesendet wird. Unbekanntes Modell → Abbruch (kein Preis
     hinterlegt). Tatsächliche Kosten aus den gemeldeten Token im Pull-Request-Text und in der Merkdatei.
   - **Anfragen:** Modell `CONTENT_MODEL` (Standard `claude-opus-5-5`), Denktiefe `CONTENT_EFFORT` (Standard `high`),
     Structured Outputs über `output_config.format`, adaptives Denken (Standard bei Opus 5.5), keine `fallbacks`
     (gibt es im Batch nicht).
   - **`content-generate`** (`generate.ts`): setzt immer auf `origin/main` auf, sendet EINEN Batch, legt
     `content/batch-<Datum>-<kurz>` mit Merkdatei `content/batches/<Datum>-<kurz>.json` an (Batch-ID, Art, Modell,
     Denktiefe, Auswahl, Anzahl, Kostenschätzung, Liste der Anfragen) und endet. Probelauf: feste Anfragen, keine API.
   - **`content-collect`** (`collect.ts`, `results.ts`): findet Branches über die Merkdatei (`status: submitted`),
     Zuordnung nur per `custom_id`; `succeeded` + `end_turn` → JSON → Antwort-Schema → Datei-Schema → Entwurf
     (`origin: batch`, `expert_reviewed: false`); `errored`/`expired`/`canceled`, `refusal`, `max_tokens`, anderer
     Stopp-Grund, kein JSON, ungültig, ID schon vergeben/doppelt, unbekannte oder fehlende `custom_id` → nicht
     gespeichert, im Bericht. Danach `content:validate` (alle Inhalte, Versionsregel gegen `origin/main`), Prettier der
     geänderten Dateien und Typprüfung; rot → kein Pull Request (Branch bleibt unverändert). Sonst Pull Request mit
     Prüfbericht, Kosten und „So testest du es am Handy“, danach `gh workflow run ci.yml --ref <branch>`. Fehlt ein
     Pull Request (z. B. gh-Fehler), holt der nächste Lauf ihn nach.
   - **`content-review`** (`review.ts`): IDs, Zielstatus `published`/`archived`/`draft`, Prüfer → Status,
     `reviewed_by`/`reviewed_at` (bei `draft` geleert), eigene Prüfung wie oben, Pull Request, `ci` starten.
   - **`content-seed`** (`seed.ts`): prüft ALLES, bei einem blockierenden Fehler nichts; Paket nur `published`, je Einheit
     `estimated_minutes` (`estimateSessionMinutes`); Aufruf `rpc/seed_content` mit `SUPABASE_URL` + `SUPABASE_SECRET_KEY`
     (neuer Secret Key nur im `apikey`-Header, alter `service_role`-JWT zusätzlich als Bearer); ohne Secrets grün mit
     Hinweis.
   - git/gh laufen ohne Shell (Argument-Listen); Workflow-Eingaben kommen nur über Umgebungsvariablen in die Skripte.
2. **Workflows:** `content-generate` (Eingaben Art, Auswahl, Anzahl, Probelauf; ohne Schlüssel und ohne Probelauf grün
   übersprungen), `content-collect` (alle 3 Stunden + per Hand; Vorprüfung per `git ls-remote` + `jq` ohne Installation
   und ohne Schlüssel; Rechte `contents`, `pull-requests`, `actions: write`), `content-review` (manuell),
   `content-seed` (Push auf `main` mit `content/**`, nach erfolgreichem `db-migrate` per `workflow_run`, per Hand).
   `ci` behält „Run workflow“. Secrets stehen jeweils nur im ausführenden Schritt. Kein Workflow genehmigt Pull
   Requests.
3. **Tests** (Vitest, ohne Netz und ohne Schlüssel): Schema-Bau und Anfrage-Texte, Kosten und Deckel, Auswahl, alle
   Ergebnis-Arten und Stopp-Gründe, `custom_id`-Zuordnung bei vertauschter Reihenfolge, Probelauf Ende-zu-Ende
   (generate → collect im temporären git-Repository mit lokalem origin, gh gefälscht), echter Lauf mit gemocktem Client
   (läuft noch / kein Schlüssel / fertig), Abbruch bei roter Prüfung, Nachholen eines fehlenden Pull Requests,
   content-review (Freigabe, V3-Blockade, ungültige Eingaben), Seed-Paket und -Aufruf (nur published, Abbruch bei Rot).
4. **Doku:** `docs/SETUP.md` Teil E (Monatslimit 30 $, Variablen), Teil H (Pull Requests durch Workflows, Schutzregel
   `main`), „Inhalte erzeugen und freigeben am Handy“ (inkl. Probelauf); `.env.example`.

**Entscheidungen beim Umsetzen (zur Wächter-Prüfung):**

1. `content-collect` läuft **alle 3 Stunden** (Minute 17) statt stündlich – GitHub rechnet jeden Lauf mit mindestens
   einer Minute ab. Per Hand geht es jederzeit sofort. Abschnitte 4, 10, 12, 13 und 15 sind entsprechend angepasst.
2. Herkunft der Batch-Entwürfe: `meta.origin = "batch"` (vorhandener Enum-Wert aus Etappe A, auch in der Datenbank),
   `meta.batch_id` = Batch-ID. Probelauf: `model = "probelauf-ohne-ki"`, `batch_id = "probelauf_…"`, Prüfnotiz
   „Probelauf – … nicht freigeben“; der Pull Request heißt „Probelauf: … – nicht mergen“.
3. Die Merkdatei bleibt nach dem Merge als Protokoll unter `content/batches/` (nicht Teil von content:validate).
4. Übungs-Zellen werden nie übersprungen (pro Bewegungsmuster/Gerät gibt es mehrere sinnvolle Übungen); das Modell
   wählt die ID, Kollisionen mit vorhandenen IDs werden nicht gespeichert. Vorlagen-IDs ergeben sich aus der Zelle
   (`…-30-45min`; `45-60` ohne Zusatz wie im Startbestand).
5. „Typprüfung der geänderten Dateien“: Die geänderten Dateien sind JSON – ihre Typprüfung ist das Datei-Schema (Ü1)
   in content:validate. Zusätzlich läuft `tsc` für `packages/content`.
6. `content-review` kann auch „zurück auf Entwurf“ (`draft`, Abschnitt 6). Die Version bleibt bei Statuswechseln
   gleich (Etappe A, Entscheidung 4).
7. `content-seed` prüft auch ohne Supabase-Secrets alle Inhalte (Plan Abschnitt 12, Schritt 8) und endet dann grün mit
   Hinweis; bei roten Fehlern wird er rot.
8. Modelle mit hinterlegtem Batch-Preis: Opus 5.5, Sonnet 5.5, Opus 5, Fable 5.1. Ein anderes `CONTENT_MODEL` bricht
   ab, bis ein Preis in `pricing.ts` steht – der Deckel fällt nie stillschweigend aus.

**Noch offen (Etappe C):** Redaktionsbereich `/admin`, SETUP-Teil G.
