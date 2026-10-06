# Plan Phase 4 – Tagesansicht & Trainingstagebuch (MVP-Abschluss) und erster nativer Build

**Status:** Freigegeben mit Empfehlungen (Gründer: „Ja mach weiter“; Frage 3 = verschlüsselt). Wächter-Prüfung
Runde 2: **freigegeben mit Auflagen** – alle Auflagen eingearbeitet (Tabellen am Ende). Stand 05.10.2026.

Grundlage: `CLAUDE.md`, `docs/KONZEPT.md` (Abschnitte 4, 4.1, 5, 12, 13, 15), `docs/PROMPTS.md` (Phase 4, der
nachgelagerte EAS-Prompt und Phase 4b zur Abgrenzung), `docs/PLAN-PHASE-3.md` und `docs/PLAN-PHASE-3-ERWEITERUNG.md`
(jeweils mit Umsetzungsstand und allen Vormerkungen „für Phase 4“).

---

## 1. Ziel in einfachen Worten

Bis jetzt zeigt „Heute“, **was** ihr trainieren sollt. Ab Phase 4 tragt ihr ein, **was ihr wirklich gemacht habt**:
Satz für Satz mit Gewicht und Wiederholungen, Läufe mit Distanz und Zeit, wie anstrengend es war und eine kurze
Notiz. Das klappt **auch ohne Netz** im Studio. Sobald wieder Verbindung da ist, wird alles übertragen. Auf dem
Gerät liegt das Tagebuch **verschlüsselt** (Gründer-Entscheidung Frage 3; im Browser nur bis zum Schließen des Tabs).

Aus den Einträgen rechnet die App das **nächste Ziel** aus: Habt ihr alle Wiederholungen geschafft, gibt es beim
nächsten Mal eine Wiederholung mehr und irgendwann mehr Gewicht (doppelte Progression aus Phase 3). Beim ersten
Eintrag einer Übung schätzt sie euer **Arbeitsgewicht**. Dazu kommen eine **Wochenansicht** (was ist geschafft) und
ein **Verlauf** (was habe ich wann gemacht).

Am Ende dieser Phase ist das **MVP fertig**. Danach richten wir den **ersten echten App-Build** ein: Android-App
zum Installieren und iPhone-App über TestFlight, gestartet per Knopf in der GitHub-App.

Alles läuft über feste Regeln in `packages/core`, **ohne KI**, gratis. Die automatische Live-Anpassung (Last senken,
Variation, weniger Tage) bleibt **Premium in Phase 4b**.

## 2. Umfang und Abgrenzung

### 2.1 Was in Phase 4 kommt (PROMPTS Phase 4, KONZEPT Abschnitt 5)

1. **Trainingsmodus** für die heutige Einheit, auch zum Nachholen einer verpassten Einheit dieser Woche:
   - je Übung **abhaken**, **„nicht gemacht“** (ohne Grund-Auswahl, Abschnitt 3.4 S3) oder **„Alternative
     durchgeführt“** mit Auswahl aus den erlaubten Alternativen,
   - je Satz **Gewicht** und **Wiederholungen** (Halteübungen: Sekunden), optional „Wie viele wären noch gegangen?“
     (= RPE, als Wiederholungen in Reserve erklärt),
   - **Pausentimer**, der nach jedem abgehakten Satz mit der geplanten Pause startet (Supersätze beachtet),
   - **Belastungsempfinden** der ganzen Einheit als Schieberegler 0–10,
   - **Notiz** zur Einheit (kurz, siehe Abschnitt 3.4).
2. **Ausdauer-Einträge:** Dauer (Pflicht), Distanz, Höhenmeter (optional), tatsächliche Art (Laufen, Gehen, Rad,
   Schwimmen); **Pace bzw. Geschwindigkeit** wird ausgerechnet, nicht eingegeben.
3. **Offline-first:** Jeder Tipp landet sofort im **verschlüsselten** Gerätespeicher; beim Beenden geht die Einheit
   in die eigene, verschlüsselte Tagebuch-Warteschlange und wird bei Verbindung übertragen (Abschnitt 4).
4. **Progression aus Einträgen:** doppelte Progression aus Phase 3 (`nextLoad()`), **je Übung über alle gekürzten
   Fassungen**, Arbeitsgewicht aus dem ersten Eintrag (`estimateWorkingWeight()`), optional **eigenes Startgewicht**.
5. **Status der Einheiten:** eingetragene Einheiten werden `completed`; verpasste werden nach Ende ihrer Woche per
   Server-Funktion `skipped`.
6. **Wochenansicht** (Status je Tag, Summen) und **Verlauf** (Einheiten nach Wochen, Verlauf je Übung).
7. **Datenexport** (Recht auf Auskunft) als JSON – Empfehlung Frage 8.
8. **Danach:** EAS Build und EAS Submit vollständig einrichten (Etappe E).

### 2.2 Was NICHT in Phase 4 kommt

| Thema                                                                                        | Wann / Begründung                                          |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Live-Anpassung (Last oder Umfang senken, Variation nach Stillstand, weniger Tage, Readiness) | Phase 4b, Premium, ohne KI                                 |
| `plan_adjustments`, „Warum hat sich mein Plan geändert?“                                     | Phase 4b                                                   |
| Herzfrequenz im Tagebuch (manuell oder Wearable)                                             | Phase 8 (Gesundheitsdatum, Begründung 3.4)                 |
| Automatische Einträge aus Wearables und aufgezeichneten Strecken                             | Phase 8 / Phase 10 (Datenmodell ist vorbereitet: `source`) |
| Freie Einheiten ohne Plan („zusätzlicher Lauf“)                                              | später (Frage 6); Datenmodell vorbereitet                  |
| Schalter „heute zu Hause“ für eine ganze Einheit                                             | später (Frage 7); je Übung reicht „Alternative“            |
| Übungsvideos/Animationen                                                                     | eigener Inhalts-Schritt nach Phase 4                       |
| Push-Benachrichtigung, wenn die Pause im Hintergrund endet                                   | mit den Push-Erinnerungen in Phase 4b (Frage 9)            |
| Rekorde, Diagramme, Fortschrittsfotos                                                        | Phase 11                                                   |
| KI jeder Art                                                                                 | Premium ab Phase 7 (KONZEPT 15)                            |

### 2.3 Gratis und Premium (KONZEPT 4.1 und 13)

**Alles aus Phase 4 ist gratis.** Gratis bekommt genau die einfache Progression: „alle Wiederholungen geschafft →
erst mehr Wiederholungen, dann mehr Gewicht“, mit dem 10-%-Puffer aus Phase 3. Die App **senkt nie selbst** eine
Last – das ist Live-Anpassung (4b). Einzige Ausnahme: Trainiert jemand **selbst** mit einem anderen Gewicht, gilt
dieses als neuer Ausgangspunkt (Frage 5) – das ist eine Entscheidung der Person, keine Regel der App.

Damit 4b später andocken kann, läuft **jeder** Tagebuch-Eintrag über eine einzige Server-Funktion
(`save_session_log`, Abschnitt 3.6). Dort hängt 4b später die ereignisgesteuerte Neuberechnung an (mit
Premium-Prüfung auf dem Server). Phase 4 selbst braucht keine Premium-Prüfung.

---

## 3. Datenmodell

### 3.1 Ist-Stand, auf dem wir aufbauen (geprüft am 05.10.2026)

- Tabellen `user_plans`, `planned_sessions`, `planned_exercises` (`20261004120000_training_plans.sql`,
  `20261005130100_plan_session_kinds.sql`); Nutzer dürfen nur lesen, an Einheiten nur `scheduled_on` und `status`
  ändern (Spalten-Recht `grant update (scheduled_on, status)`). Der Trigger `private.planned_sessions_before_update`
  greift nur für `current_user = 'authenticated'`, lehnt jede Änderung ab, wenn `old.status <> 'planned'`, nur im
  aktiven Plan und in der laufenden Woche – **den neuen Status prüft er aber nicht**. Bisher ist das harmlos, weil
  es nur `planned | skipped` gibt; mit `completed` könnte jemand per PostgREST `planned → completed` setzen.
  **Korrektur in Etappe B (W1):** Der Trigger wird per `create or replace` ergänzt: für `authenticated` nur
  `new.status in ('planned', 'skipped')`, sonst Fehler „Nur Datum und Status einer Einheit sind änderbar.“
  (`check_violation`). `save_session_log`/`delete_session_log`/`close_missed_sessions` laufen als `security definer`
  (Eigentümer, nicht `authenticated`) und sind davon nicht betroffen. pgTAP: `planned → completed` direkt scheitert.
- `planned_session_status` = `planned | skipped`; Phase 3 hat `completed` für Phase 4 vorgemerkt.
- `planned_exercises.target_weight_kg` ist überall leer (`adapt.ts` setzt `null`); `dosageForWeek()` und
  `deload.ts` (Gewicht × 0,9) sind dafür vorbereitet.
- `private.consents_after_revoke()` (zuletzt in `20261004120000_training_plans.sql`) löscht beim Widerruf von
  `health_data` alle Pläne mit `uses_health_data` per Kaskade; `save_training_plan` löscht ersetzte Pläne ohne
  Einheiten jenseits der neuesten 20.
- `public.delete_my_account()` löscht `auth.users` → alles mit `on delete cascade`.
- Hilfsfunktionen `private.berlin_today()`, `private.assert_json_keys()`; Fehler ohne Zeilen-Details als Muster.
- Profil zuerst: RLS-Regeln mit `exists (select 1 from public.profiles …)` bzw. Prüfung in den Funktionen.

### 3.2 Neue Tabellen

Spaltennamen englisch, `user_id … references auth.users on delete cascade`, gemeinsame Fremdschlüssel
`(…_id, user_id)` wie in Phase 3. **Wichtig (B2):** Ein einfaches `on delete set null` auf einem zusammengesetzten
Fremdschlüssel würde auch `user_id` leeren (und damit `not null` verletzen bzw. den Widerruf abbrechen). Deshalb
mit Spaltenliste (ab Postgres 15, Projekt nutzt 17): `foreign key (planned_session_id, user_id) references
public.planned_sessions (id, user_id) on delete set null (planned_session_id)`, ebenso
`on delete set null (planned_exercise_id)`. pgTAP: nach Plan-Löschung ist `user_id` erhalten, nur der Verweis
`null`. Neue Aufzählungen (Postgres + `enums.ts`, Abgleich in `db-sync.test.ts`):
`session_log_status` (`completed`, `partial`), `exercise_log_status` (`done`, `skipped`, `alternative`),
`log_source` (`manual`; später `route`, `wearable`), dazu `planned_session_status` + `completed` (eigene
Migrationsdatei **vor** der Funktions-Migration, weil neue Enum-Werte nicht in derselben Transaktion nutzbar sind).

| Tabelle                  | Spalten (Kurzform)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Regeln                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session_logs`           | `id` (vom Gerät erzeugt; beim Ersetzen behält der Server die bestehende `id`), `user_id`, `planned_session_id` (→ `planned_sessions`, **`on delete set null (planned_session_id)`**), `kind` (`planned_session_kind`), `performed_on` (date), `started_at`/`finished_at` (optional), `status`, `session_rpe` (0–10, ganzzahlig, optional), `notes` (≤ 280 Zeichen = Code-Points, optional), Schnappschuss `name_de`, `is_intro_week`, `is_deload`, **`from_health_plan`** (boolean not null, setzt nur der Server aus `user_plans.uses_health_data`, B1), **`revision`** (int not null, je Ersetzen +1, W3), **`last_write_id`** (uuid, Idempotenz-Schlüssel der zuletzt angewendeten Fassung, R4), `source`, `client_updated_at` (auf `now()` gekappt), `created_at`, `updated_at` | eindeutig `planned_session_id` (wenn gesetzt) = eine Einheit wird nur einmal eingetragen; eindeutig `(user_id, performed_on) where planned_session_id is not null` = nie zwei geplante Einheiten an einem Tag nachholen („nie stapeln“); Index `(user_id, performed_on desc)`                                                                                                                                                        |
| `exercise_logs`          | `id`, `session_log_id` + `user_id` (**`on delete cascade`** zum eigenen Eintrag), `order_no` 1–12, `planned_exercise_id` (→ `planned_exercises`, **`on delete set null (planned_exercise_id)`**), `exercise_id` = **tatsächlich gemachte** Übung (→ `exercises`, `on delete restrict`), Schnappschuss `exercise_name_de`, `load_type` (der tatsächlich gemachten Übung), `status`, **Vorgabe beim Training** (Abschnitt 3.3), **Progressions-Zustand** `state_weight_kg`, `state_target_reps`, `state_extra_set` (boolean), `state_duration_s` (roh, ortsunabhängig, W4), `weight_confirmed` (boolean, bestätigte Plausibilitäts-Warnung, W5), `target_extra_set` (boolean, angezeigter Zusatzsatz, Etappe A B1), `is_return` (boolean, Wiedereinstieg nach Pause, Etappe A C1)     | `unique (session_log_id, order_no)`; Status `skipped` ⇒ keine Sätze; Status `alternative` ⇒ `planned_exercise_id` verweist auf die geplante Übung, `exercise_id` ist eine andere; Vorgabe (`target_*`) und `state_*` sind die der **Alternativ-Übung** (deren angezeigte Vorgabe, deren eigener Verlauf); verboten ist nur die Übernahme von Vorgabe oder Zustand der geplanten Übung (R2, prüft der Client beim Bauen des Eintrags) |
| `set_logs`               | `exercise_log_id` + `user_id` (cascade), `set_no` 1–10, `reps` 0–100, `weight_kg` 0–500 (2 Nachkommastellen; je Hantel bzw. Kugel, Langhantel gesamt), `duration_s` 1–600, `rpe` 5–10 in 0,5er-Schritten, `done`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `primary key (exercise_log_id, set_no)`; Gewicht nur bei `load_type = 'weight'`, Dauer nur bei `time`                                                                                                                                                                                                                                                                                                                                |
| `cardio_logs`            | `session_log_id` (Primärschlüssel, 1:1) + `user_id` (cascade), `modality` (`endurance_modality`), `duration_s` 60–43 200, `distance_m` 0–500 000, `elevation_m` 0–10 000                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | nur bei `kind = 'endurance'`; **keine Herzfrequenz** (Phase 8)                                                                                                                                                                                                                                                                                                                                                                       |
| `exercise_start_weights` | `user_id`, `exercise_id`, `weight_kg` (CHECK 0,5–500), `updated_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `primary key (user_id, exercise_id)`; „eigenes Startgewicht“ (Phase-3-Vormerkung 5.8 Punkt 4); **bewusste Ausnahme**: direkt per PostgREST schreibbar (3.5, W14)                                                                                                                                                                                                                                                                     |

Abweichung von KONZEPT Abschnitt 12 (wird in Etappe B dort eingetragen): Zwischen `session_logs` und `set_logs`
liegt `exercise_logs`, weil „nicht gemacht“ eine Übung **ohne** Sätze ist und die Vorgabe je Übung einmal
gespeichert wird. `set_logs` verweist daher nicht selbst auf `planned_exercise_id`.

### 3.3 Schnappschuss statt Kaskade (Phase-3-Vormerkung 8.2)

Tagebuch-Einträge hängen **nie per Kaskade** an Plänen. Wird ein Plan gelöscht (Widerruf, Aufräumen ersetzter
Pläne), werden `planned_session_id` und `planned_exercise_id` per `on delete set null` leer – der Eintrag bleibt.
Damit er dann noch lesbar ist und die Progression weiterrechnen kann, kopiert jeder Eintrag die **nötigen Angaben**:

- Einheit: `name_de`, `kind`, `is_intro_week`, `is_deload`, `performed_on`.
- Übung: tatsächliche `exercise_id`, `exercise_name_de`, `load_type`.
- **Vorgabe beim Training** (genau der Stand, den die Person **gesehen** hat – nach Orts-Rundung, Erholungswoche,
  Einstiegswoche und Sicherheitsregeln): `target_sets`, `reps_min`, `reps_max`, `target_reps`, `target_extra_set`,
  `target_weight_kg`, `target_duration_s`, `target_rpe`. Für den Verlauf und den Fortschritt an einem gerundeten
  Gewicht (Umsetzungsstand, Festlegung 1).
- **Progressions-Zustand** (W4) getrennt davon: `state_weight_kg`, `state_target_reps`, `state_extra_set`,
  `state_duration_s` = roher, ortsunabhängiger Zustand **vor** dieser Einheit (ohne Abrunden auf Stufen des Orts,
  ohne Deload-Faktor 0,9, ohne RPE −1 der Einstiegswoche, ohne Klemmen auf den Wdh.-Bereich des Plans). Daraus –
  nicht aus der angezeigten Vorgabe – rechnet die Progression weiter (5.1).

**Bewusst nicht kopiert:** `source_exercise_id`, Kennzeichen „ersetzt“, `medical_notice`, Sicherheitsregeln,
Gründe für „nicht gemacht“ (es gibt keine, S3), `uses_health_data` (nur als `from_health_plan`, setzt der Server).

### 3.4 Sind Trainingseinträge Gesundheitsdaten? – Empfehlung

**Empfehlung: Das Tagebuch ist ein Trainingsheft, kein Gesundheitsdatum – mit vier Schutzregeln; auf dem Gerät
trotzdem verschlüsselt (Gründer-Entscheidung Frage 3).**

Begründung, abgeglichen mit der Phase-3-Einordnung (`docs/PLAN-PHASE-3.md` Abschnitt 9):

1. Ein Plan mit `uses_health_data` ist Gesundheitsdatum, weil **wir** ihn aus dem Gesundheits-Check **ableiten**
   (Tausch, RPE-Deckel, Arzt-Hinweis). Ein Tagebuch-Eintrag hält dagegen fest, was die Person **selbst getan** hat:
   Übung, Sätze, Gewicht, Wiederholungen, Dauer, Distanz. Das sind Leistungs- und Trainingsdaten wie in einem
   Papier-Trainingsheft; sie sagen für sich nichts über den Gesundheitszustand.
2. **Belastungsempfinden (RPE) 0–10** beschreibt, wie schwer eine Übung oder Einheit war (Steuerungsgröße wie
   Gewicht), nicht den Körperzustand. Konsistent mit Phase 3: `rpe_target` in Plänen ohne Check ist kein
   Gesundheitsdatum.
3. Phase 3 hat ausdrücklich festgelegt, dass der Widerruf das Tagebuch **nicht ungewollt** löschen darf
   (8.2) – das setzt voraus, dass das Tagebuch selbst kein Gesundheitsdatum ist.

**Einschränkung (Wächter B1):** Solange ein Eintrag zu einem Plan mit Gesundheitsbezug gehört, verrät sein
**Schnappschuss der Vorgabe** mittelbar Gesundheits-Flags: weniger Sätze, enger Wdh.-Bereich, RPE-Deckel,
vorsichtiges Gewicht oder ein Einheiten-Name wie „Zügiges Gehen“ statt „Lockerer Dauerlauf“ (mittelbare
Gesundheitsdaten im Sinne von EuGH C-184/20). Phase 3 (Abschnitt 9) löscht solche Pläne beim Widerruf – also
müssen auch diese Spuren im Tagebuch weg. Die Ist-Werte der Person (Übung, Sätze, Gewicht, Wdh., Dauer, Distanz,
RPE, Notiz) bleiben.

**Schutzregeln, damit das stimmt:**

- **S1 – Vorgaben aus Gesundheits-Plänen beim Widerruf neutralisieren (B1):**
  - `session_logs.from_health_plan` (boolean not null) setzt **nur der Server** in `save_session_log` aus
    `user_plans.uses_health_data` der geplanten Einheit; ein vom Client gesendeter Wert wird abgelehnt (Feld nicht
    in der erlaubten Feldliste).
  - Beim Widerruf `health_data` macht `consents_after_revoke()` **vor** dem Löschen der Pläne für alle eigenen
    Einträge mit `from_health_plan`: alle `target_*` und alle `state_*` in `exercise_logs` = `null`, `name_de` der
    Einheit neutral („Kraft-Einheit“ bzw. „Ausdauer-Einheit“ nach `kind`), `from_health_plan = false`. Es bleiben
    nur Ist-Werte, `exercise_id`/`exercise_name_de` der tatsächlich gemachten Übung, `kind`, Datum,
    `is_intro_week`/`is_deload`.
  - Fehlen Zustand und Vorgabe, rechnet die Progression neu aus den Ist-Werten (`estimateWorkingWeight()`, 5.2) und
    vergleicht mit dem vorsichtigen Ziel `CONSERVATIVE_PLAN_RULES.rpeMax` (7) – nie lockerer.
  - **Widerrufs-Dialog** bietet die Wahl: „Tagebuch behalten (empfohlen)“ (neutralisieren wie oben) oder
    „Einträge aus Plänen mit Gesundheits-Check auch löschen“. Beides läuft in **einer** Transaktion über
    `public.revoke_health_data(p_delete_logs boolean)` (Abschnitt 3.6 Punkt 6, R3). Hinweis im Dialog: „Öffne die
    App auf deinen anderen Geräten vorher einmal mit Verbindung – noch nicht übertragene Trainings von dort werden
    sonst ohne Vorgaben gespeichert.“
  - **Gleiche Behandlung ohne gültige Einwilligung (H-c):** Lehnt jemand die Neu-Einwilligung einer neuen
    Textfassung ab (PLAN-PHASE-3 8.2: App speichert einen Plan ohne Check über `save_training_plan`), werden die
    Einträge mit `from_health_plan` ebenso neutralisiert – `save_training_plan` ruft dafür denselben Helfer
    `private.neutralize_health_plan_logs(user_id)` auf, sobald `has_valid_consent('health_data')` falsch ist
    (Phase-3-Nachtrag in Etappe B, pgTAP).
  - Gleiche Logik im Testmodus (`applyHealthDataRevocation()`) und für **Entwurf und Warteschlange** auf dem Gerät
    (lokal als `fromHealthPlan` vermerkt, nicht gesendet): **vor** dem Widerruf sperrt die App das Senden der
    `LogQueue` und neutralisiert bzw. entfernt (bei „auch löschen“) die `fromHealthPlan`-Einträge in Warteschlange,
    Entwurf und `logCache`; erst danach `revoke_health_data` (R3). **Andere Geräte:** beim Laden ist die
    Einwilligung `health_data` ungültig **und** es gibt lokal `fromHealthPlan`-Einträge → dieselbe Bereinigung
    (neutralisieren) vor dem nächsten Senden.
  - Restmuster (z. B. dass eine bestimmte Übung nie vorkommt, `is_intro_week`) als Restrisiko in die DSFA.
  - pgTAP: nach Widerruf keine Vorgabe, kein Zustand und kein Varianten-Name mehr in Einträgen aus Gesundheits-Plänen;
    Einträge aus Plänen ohne Gesundheitsbezug unverändert.
- **S2 – Herzfrequenz erst ab Phase 8.** Puls ist ein körperlicher Messwert (Gesundheitsdatum) und gehört zu
  Wearables mit eigener Einwilligungslogik. KONZEPT 5 nennt sie „manuell oder aus Wearable“ – manuell verschieben
  wir mit nach Phase 8 (Eintrag in KONZEPT in Etappe B).
- **S3 – Notizen:** Freitext kann alles enthalten. Empfehlung (Frage 2): **kurz (280 Zeichen)** und mit festem
  Hinweis unter dem Feld: „Für Technik, Einstellungen, Gefühl – bitte keine Angaben zu Krankheiten oder
  Beschwerden.“ Keine Auswertung des Inhalts durch irgendeine Regel, nie in Logs, Analytics oder Fehlermeldungen.
  **„Nicht gemacht“ hat keine Grund-Auswahl** (insbesondere keine Option „Schmerzen/Beschwerden“) – so entsteht
  kein strukturiertes Gesundheitsdatum (6.1, Test in Etappe C: Payload enthält kein Grund-Feld). Die Alternative
  (Notizen als Gesundheitsdaten) hätte hohe Kosten: neue Textfassung der Einwilligung `health_data` → alle müssten
  neu zustimmen, Folgeblöcke würden bis dahin abgelehnt (PLAN-PHASE-3 8.2).
- **S4 – Auf dem Gerät verschlüsselt (Frage 3, B3):** Entwurf, Tagebuch-Warteschlange und Tagebuch-Zwischenspeicher
  liegen in der App verschlüsselt (wie Frage 14 aus Phase 3), im Browser nur in sessionStorage (Abschnitt 4).
  Das gilt für **alle** Einträge, nicht nur für Gesundheits-Pläne – einfacher und ohne Lücke.

Weitere Grundregeln gelten unverändert: RLS auf allen Tabellen, nie an Analytics/Werbung/Partner, keine Inhalte in
Logs. Die juristische Bestätigung (inkl. Restmuster aus S1) gehört in die Datenschutz-Folgenabschätzung (Phase 12)
– mit dieser Einordnung ist sie kein Blocker. Der **Einwilligungstext** `health_data` bleibt unverändert (H6); der
Hinweis „Vorgaben aus dem Gesundheits-Check werden beim Widerruf aus dem Tagebuch entfernt“ kommt in Einstellungen,
Widerrufs-Dialog und Datenschutzerklärung.

### 3.5 Rechte (RLS) und Profil zuerst

- `authenticated` darf auf `session_logs`, `exercise_logs`, `set_logs`, `cardio_logs` nur **lesen** (eigene
  Zeilen). Schreiben nur über die Funktionen in 3.6 – wie bei den Plänen, damit niemand per PostgREST Prüfungen
  umgeht und damit das Ersetzen einer ganzen Einheit atomar ist. `anon` darf nichts.
- `exercise_start_weights` – **bewusste Ausnahme (W14)** von „Schreiben nur über Funktionen“: ein einzelner Wert
  ohne Zusammenhang zu anderen Zeilen, deshalb direkt per PostgREST wie `training_preferences`. `select`,
  `insert`, `update`, `delete` für eigene Zeilen; `insert`/`update` nur mit vorhandenem Profil (Ergänzung in
  `06_profile_required`); CHECK `weight_kg between 0.5 and 500`; im Export (3.7) und in `04_account_deletion`
  geprüft.
- Zusätzliche Lese-Regel auf `exercises`: **archivierte** Übungen sind lesbar, wenn sie in einem eigenen
  `exercise_logs`-Eintrag stehen (wie Phase 3 für Pläne).

### 3.6 Server-Funktionen (`security definer`, `search_path = ''`, `revoke … from public, anon`)

1. **`public.save_session_log(p_log jsonb) returns jsonb`** – einziger Schreibweg für Einträge:
   - Login, Profil, nur bekannte Felder (`private.assert_json_keys`, entspricht `.strict()` in Zod), `user_id`
     immer aus `auth.uid()`.
   - Geplante Einheit gehört der Person; Status `planned`, `completed` oder `skipped` – `skipped → completed` ist
     ausdrücklich erlaubt, auch für Einheiten, die `close_missed_sessions()` gestrichen hat (W8), solange das
     Datumsfenster passt und der Tag frei ist; Art passt (`strength` ⇒ Übungen, `endurance` ⇒ `cardio_logs`).
   - **Verwaiste Einträge (B4):** Gibt es die geplante Einheit nicht mehr (Plan ersetzt oder per Widerruf gelöscht,
     während der Eintrag in der Warteschlange lag) – oder ist die `planned_session_id` erfunden bzw. gehört einer
     anderen Person (H-a: **gleich behandelt wie „nicht gefunden“**, ohne unterscheidbare Meldung, damit sich nicht
     erraten lässt, welche IDs existieren) –, wird der Eintrag trotzdem gespeichert: `planned_session_id = null`,
     Art, Datumsfenster (gegen das mitgesendete ursprüngliche Datum) und alle Grenzen gelten; alle `target_*` und
     `state_*` leer, `name_de` neutral („Kraft-Einheit“/„Ausdauer-Einheit“ – zusätzliche Vorsicht, weil der Server
     den früheren Gesundheitsbezug nicht mehr kennt), `from_health_plan = false`; Antwort `orphaned` (mit `id`). Die App zeigt: „Dein Plan hat sich
     geändert – dein Training wurde trotzdem gespeichert.“ Verwaiste Einträge zählen nicht für den 10-%-Bezug der
     Ausdauer (5.3, Test). Gleiches in `local-rules.ts` + Test.
   - **Datum (W2):** `performed_on` liegt in **derselben ISO-Woche** wie `coalesce(original_date, scheduled_on)`
     (1 Tag Toleranz an beiden Rändern wegen Zeitzonen), ≤ heute + 1 Tag und ≥ heute −
     `SESSION_LOG_LIMITS.backdateDays` (14). Dieselbe Regel in `canCatchUp()` (5.6) und `local-rules.ts`.
   - Jede `exercise_id` existiert (freigegeben oder über eigenen Plan/Eintrag archiviert lesbar);
     `planned_exercise_id` gehört zu dieser Einheit.
   - Alle Grenzen aus `SESSION_LOG_LIMITS`/`CARDIO_LOG_LIMITS` – zusätzlich als CHECK in den Tabellen.
   - `from_health_plan` setzt der Server aus `user_plans.uses_health_data` (S1); nicht in der erlaubten Feldliste.
   - **Idempotent mit optimistischer Sperre (W3):** gleicher Schlüssel (`planned_session_id`, sonst `id`) → die ganze
     Einheit wird ersetzt (Übungen, Sätze, Ausdauer in einer Transaktion), aber **nur**, wenn die mitgesendete
     `base_revision` der gespeicherten `revision` entspricht (neuer Eintrag: `base_revision = null` und noch keine
     Zeile). Dann `revision + 1`, Antwort `{ "result": "ok", "id": …, "revision": … }`. Beim Ersetzen über
     `planned_session_id` behält der Server die **bestehende** `id` und gibt sie zurück (die App übernimmt sie).
     Abweichung → `{ "result": "conflict", "revision": … }` ohne Änderung. **Idempotenz-Schlüssel (R4):** Jede
     gespeicherte Fassung trägt eine vom Gerät erzeugte `write_id` (uuid); der Server merkt sie als
     `last_write_id`. Kommt dieselbe `write_id` erneut (Antwort unterwegs verloren, erneut gesendet), antwortet er
     `ok` mit der aktuellen `revision`, ohne erneut zu ersetzen (pgTAP „Antwort verloren, erneut gesendet“).
     `client_updated_at` dient nur noch der Anzeige und als Notlösung; Werte in der
     Zukunft werden auf `now()` gekappt.
   - Setzt die geplante Einheit auf **`completed`** (als Eigentümer, am Verschiebe-Trigger vorbei; der Trigger
     verbietet `authenticated` den Status `completed` ausdrücklich, 3.1/W1).
   - **Fehler ohne Zeileninhalt (W10):** `check_violation`, `unique_violation`, `foreign_key_violation`,
     `not_null_violation`, `null_value_not_allowed`, `string_data_right_truncation`, `invalid_text_representation`,
     `invalid_datetime_format`, `datetime_field_overflow`, `numeric_value_out_of_range` und
     `invalid_parameter_value` werden abgefangen und als „Ungültige Werte im Tagebuch.“ bzw. „An diesem Tag ist
     schon eine Einheit eingetragen.“ mit festem Fehlercode gemeldet, ohne Detail (wie `save_training_plan`). Die
     Notizlänge zählen Zod (`[...text].length`) und SQL (`char_length`) gleich in Code-Points. pgTAP: Fehlerantwort
     enthält weder Notiz noch Werte.
   - Obergrenze gegen Missbrauch: höchstens `SESSION_LOG_LIMITS.maxLogsPerDay` neue Einträge je Kalendertag.
2. **`public.delete_session_log(p_id uuid, p_base_revision int)`** – nur wenn `p_base_revision` der gespeicherten
   `revision` entspricht (sonst `conflict`, R4); eigener Eintrag weg (Kaskade auf Übungen/Sätze/Ausdauer); die
   geplante Einheit wird wieder `planned`, wenn ihr Plan aktiv ist, ihre Woche läuft **und** an ihrem Tag keine
   andere geplante Einheit liegt (Wächter Etappe B, B1), sonst `skipped`. Nur online (Abschnitt 4.5).
3. **`public.close_missed_sessions() returns integer`** – setzt eigene Einheiten des aktiven Plans auf `skipped`,
   die **noch `planned`** sind und deren ISO-Woche (`coalesce(original_date, scheduled_on)`) **vorbei** ist.
   Idempotent, ruft die App beim Laden (online) auf – **erst nachdem** die normale Warteschlange und die
   Tagebuch-Warteschlange gesendet sind (W8, 4.3). Einheiten ersetzter Pläne bleiben unberührt (nur aktiver Plan,
   H1); ihre `planned`-Altlasten blendet die App in Woche/Verlauf aus bzw. zeigt sie als „entfallen“. Das erfüllt
   die Vormerkung „gestern verpasst → skipped“ mit einer Präzisierung: Weil man eine verpasste Einheit seit Phase 3
   (Nachtrag C1) innerhalb ihrer Woche noch verschieben oder nachholen darf, wird erst **nach Wochenende**
   gestrichen. Vorher zeigt die App „verpasst“. Ein später eintreffender Eintrag macht aus `skipped` wieder
   `completed` (Punkt 1).
4. **`public.recent_exercise_logs(p_per_exercise int default 2)`** (`security invoker`, RLS greift) – je
   `exercise_id` (W4) die **zwei neuesten Einträge ohne Erholungs- und Einstiegswoche** (`is_deload`,
   `is_intro_week` = false) mit Sätzen **plus den neuesten Eintrag überhaupt** (für Anzeige und Tippfehler-Vergleich)
   **plus den neuesten Einstiegswochen-Eintrag, solange es noch keinen zählenden gibt** (Kalibrierungsquelle, R1);
   liefert die Progression auch für Übungen, deren letzter Eintrag älter ist als das geladene Zeitfenster.
5. **`public.export_my_data() returns jsonb`** (`security invoker`) – alle eigenen Zeilen aller Nutzertabellen
   (Frage 8), Details 3.7.
6. **`public.revoke_health_data(p_delete_logs boolean) returns void`** (R3; `security definer`,
   `search_path = ''`, `auth.uid()`, `revoke … from public, anon`, `grant execute` nur `authenticated`) – der
   Widerruf `health_data` als **eine Transaktion**: bei `p_delete_logs` zuerst eigene Einträge mit
   `from_health_plan` löschen (Kaskade auf Übungen/Sätze/Ausdauer), dann `consents.revoked_at` setzen → der
   Trigger `consents_after_revoke()` neutralisiert die übrigen und löscht die Pläne. Ersetzt das bisherige direkte
   `update consents set revoked_at` der App für `health_data` (andere Einwilligungen unverändert). pgTAP: `anon`
   darf nicht; Einträge anderer Personen unberührt; beide Varianten; Abbruch lässt alles unverändert.

**Keine Funktion schreibt Progression in `planned_exercises`** – Begründung in Abschnitt 5.1. Die
Phase-3-Vormerkung „Progressions-Änderungen per `security definer`-Funktion“ wird damit für Gratis nicht gebraucht
und bleibt für 4b reserviert (dort ändert der Server Pläne).

### 3.7 Widerruf, Konto löschen, Aufräumen, Export

- **Widerruf `health_data`:** `consents_after_revoke()` per `create or replace` erweitert: (1) Einträge mit
  `from_health_plan` neutralisieren (alle `target_*`/`state_*` leer, `name_de` neutral, Kennzeichen `false`, S1),
  (2) dann wie bisher Pläne löschen → Verweise werden `null` (B2). Einträge, Ist-Werte, Ausdauer, Notizen und
  Startgewichte **bleiben**. pgTAP prüft genau das. Wahl „auch löschen“: in derselben Transaktion über
  `revoke_health_data(true)` (3.6 Punkt 6). Die Neutralisierung steckt in `private.neutralize_health_plan_logs()`,
  die auch `save_training_plan` bei ungültiger Einwilligung nutzt (H-c).
- **Ersetzte Pläne aufräumen** (`save_training_plan`): Verweise werden `null`, Einträge bleiben (Test).
- **Konto löschen:** alles per Kaskade über `auth.users` (Ergänzung in `04_account_deletion`, inkl.
  `exercise_start_weights`); auf dem Gerät werden Entwurf, Tagebuch-Warteschlange und Tagebuch-Zwischenspeicher
  samt Schlüsseln gelöscht (4.1).
- **Testmodus:** `applyHealthDataRevocation()` (`apps/mobile/src/data/write-ops.ts`) spiegelt beides (neutralisieren
  bzw. löschen); „Testdaten löschen“ entfernt auch Einträge, Entwürfe und die Tagebuch-Speicher.
- **Export (W9):** `export_my_data()` nimmt alle Tagebuch-Tabellen und Startgewichte auf (dazu alle bisherigen
  Tabellen inkl. Einwilligungs-Verlauf `consents`). pgTAP gleicht **alle** `public`-Tabellen mit einem
  Fremdschlüssel auf `auth.users` (aus `pg_constraint`, unabhängig vom Spaltennamen, H-f) mit den Schlüsseln des
  Exports ab – eine neue Tabelle ohne Export lässt den
  Test scheitern. Die **Konto-E-Mail** ergänzt die App aus `supabase.auth.getUser()` (die Funktion bleibt
  `security invoker` und braucht kein Leserecht auf `auth.users`). Vor dem Herunterladen/Teilen Hinweis: „Diese
  Datei enthält Gesundheitsdaten – gib sie nur weiter, wenn du das willst.“ In der App wird die Zwischen-Datei nach
  dem Teilen-Dialog gelöscht.

### 3.8 Grenzwerte: CHECK + `constants.ts` (mit Quelle bzw. PRODUKTENTSCHEIDUNG)

| Konstante                 | Werte                                                                                                                                                                   | Quelle / Einordnung                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `SESSION_LOG_LIMITS`      | Übungen je Einheit 1–12, Sätze je Übung 1–10, Wdh. 0–100, Gewicht 0–500 kg, Halten 1–600 s, Notiz 280 Zeichen, Nachtragen 14 Tage, Zukunft 1 Tag, `maxLogsPerDay` 10    | PRODUKTENTSCHEIDUNG; Gewicht = `PLANNED_LOAD_LIMITS.targetWeightKg.max`                   |
| `SET_RPE_LIMITS`          | 5–10 in 0,5er-Schritten (Eingabe als „0 / 1 / 2 / 3 / 4 / 5+ Wiederholungen in Reserve“)                                                                                | Zourdos MC et al. (2016), J Strength Cond Res 30(1):267–275 (RIR-basierte RPE-Skala)      |
| `SESSION_RPE_LIMITS`      | 0–10 ganzzahlig                                                                                                                                                         | Borg (1982) CR10; Foster C et al. (2001), J Strength Cond Res 15(1):109–115 (Session-RPE) |
| `CARDIO_LOG_LIMITS`       | Dauer 1 min–12 h, Distanz 0–500 km, Höhenmeter 0–10 000 m                                                                                                               | PRODUKTENTSCHEIDUNG (harte Grenzen, großzügig)                                            |
| `CARDIO_PLAUSIBILITY_KMH` | höchstens Gehen 10, Laufen 25, Rad 70, Schwimmen 8 km/h → nur **Warnung** „Bitte prüfen“, kein Fehler                                                                   | PRODUKTENTSCHEIDUNG, orientiert an Weltrekord-Durchschnitten                              |
| `CALIBRATION_MISSING_RPE` | 10 (ohne Angabe „keine Reserve“ annehmen = vorsichtigste Schätzung)                                                                                                     | PRODUKTENTSCHEIDUNG                                                                       |
| `REST_TIMER`              | Anpassen in 15-s-Schritten, 0–600 s                                                                                                                                     | PRODUKTENTSCHEIDUNG; Pausen selbst aus `REST_RANGES_S`                                    |
| `LOG_CACHE_WEEKS`         | 12 Wochen Einträge im Gerätespeicher                                                                                                                                    | PRODUKTENTSCHEIDUNG                                                                       |
| `WEIGHT_CONFIRM_LIMITS`   | Gewicht > 10 % über dem Zustand nur nach Bestätigung; erster Eintrag/Startgewicht mit Bestätigung über Kurzhantel/Kettlebell 50 kg je Stück, Langhantel/Maschine 200 kg | PRODUKTENTSCHEIDUNG (W5), 10 % = `LOAD_PROGRESSION.maxIncreaseFraction`                   |

`db-sync.test.ts` gleicht alle CHECKs, die neuen Enums und die Feldlisten von `save_session_log` (auch
verschachtelt: Übungen → Sätze, Ausdauer) mit den Zod-Schemas ab.

### 3.9 Typen

`packages/db/src/database.types.ts` von Hand im gen-types-Format ergänzen (5 Tabellen, 3 Enums + 1 Wert,
6 Funktionen; `database.types.test.ts` mitziehen); danach prüft der Workflow `db-types`.

---

## 4. Offline-first

### 4.1 Geschützte Speicher auf dem Gerät (Gründer-Entscheidung Frage 3 = verschlüsselt, B3)

Drei **eigene** Instanzen von `ProtectedStore` (`protected-store.ts`), je mit eigenem Daten- und Schlüssel-Namen in
`STORAGE_KEYS` (`kv.ts`) und eigener Fabrik in `device-protected-store.ts`/`.native.ts`:

| Speicher                  | `STORAGE_KEYS` (Daten / Schlüssel)                                                                     | Inhalt                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Entwurf                   | `workoutDraft` = `fitnessapp.workout-draft.v1` / `workoutDraftKey` = `fitnessapp.workout-draft-key.v1` | laufende Einheit(en), abgelehnte/Konflikt-Fassungen |
| Tagebuch-Warteschlange    | `logQueue` = `fitnessapp.log-queue.v1` / `logQueueKey` = `fitnessapp.log-queue-key.v1`                 | wartende `save_session_log`-Vorgänge                |
| Tagebuch-Zwischenspeicher | `logCache` = `fitnessapp.log-cache.v1` / `logCacheKey` = `fitnessapp.log-cache-key.v1`                 | geladene Einträge (4.5)                             |

- **App:** AES-256-GCM (expo-crypto), Schlüssel im Keychain/Keystore (expo-secure-store,
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`), Geheimtext in AsyncStorage – genau wie der Plan-Cache aus Frage 14.
- **Browser:** nur sessionStorage (endet mit dem Tab), nie localStorage.
- **Nicht** mit dem Plan-Cache (`healthPlanCache`/`healthPlanKey`) teilen: `clear()` löscht auch den Schlüssel, und
  der Plan-Cache wird bei Widerruf/Planwechsel geleert – das Tagebuch nicht.
- **Leeren** (Daten + Schlüssel): Entwurf nach erfolgreichem Übergeben an die Warteschlange bzw. Verwerfen,
  Warteschlangen-Eintrag nach erfolgreichem Senden, alles beim **Abmelden**, **Konto löschen** und **Testdaten
  löschen**. **Nicht** leeren bei Widerruf oder Planwechsel – dort nur bereinigen nach S1 (neutralisieren bzw. bei
  „auch löschen“ die Einträge aus Gesundheits-Plänen entfernen).
- **Konto-Bindung (R5):** Entwurf, `LogQueue`, `logCache` **und** die normale `SyncQueue` speichern
  `owner_user_id`. Gesendet wird nur, wenn das angemeldete Konto passt; sonst Nachfrage „Auf diesem Gerät liegen
  Einträge eines anderen Kontos – löschen?“ (nie an das falsche Konto senden). Bei **Sitzungsablauf** wird nichts
  geleert, sondern zur erneuten Anmeldung aufgefordert; danach geht es weiter. Test: Konto A trägt offline ein,
  Konto B meldet sich an → nichts gesendet, Nachfrage.
- **Abmelden mit Offenem (R6):** Die Nachfrage zählt wartende Einheiten in der `LogQueue` **und** offene Entwürfe
  bzw. Konflikt-Fassungen: „X Trainings sind noch nicht übertragen – jetzt senden / trotzdem abmelden (gehen
  verloren)“. „Jetzt senden“ versucht die Übertragung; bleibt danach etwas übrig (offline, Ablehnung, Konflikt),
  wird **nicht** abgemeldet, sondern erneut gefragt.
- **Testmodus (dokumentierte Ausnahme):** `localDb` bleibt unverschlüsselt in AsyncStorage/localStorage wie bisher
  (nur Gründer-Test, schon heute inkl. Gesundheitsdaten, siehe `kv.ts`).

### 4.2 Während des Trainings: Entwurf

- Jeder Tipp (Satz abgehakt, Gewicht geändert) schreibt den **Entwurf** der laufenden Einheit sofort in den
  geschützten Entwurfs-Speicher. App abgestürzt oder Akku leer → beim nächsten Öffnen: „Du hast ein Training vom …
  nicht beendet – fortsetzen, speichern oder verwerfen?“
- **Browser:** Der Entwurf überlebt Neu laden, aber **nicht** das Schließen des Tabs. Deshalb Hinweis im
  Trainingsmodus („Lass diesen Tab offen, bis dein Training übertragen ist“) und eine `beforeunload`-Warnung,
  solange ein Entwurf oder wartende Einheiten existieren.
- Der Entwurf enthält nur die Einträge, die Vorgabe und den Zustand aus 3.3 und lokal das Kennzeichen
  `fromHealthPlan` (nicht gesendet), **nicht** `source_exercise_id`, Arzt-Hinweis oder Sicherheitsregeln.

### 4.3 Nach dem Training: eigene Tagebuch-Warteschlange

- `save_session_log` läuft **nicht** über die bestehende `SyncQueue` (`STORAGE_KEYS.syncQueue`, unverschlüsselt)
  und **nicht** über `isSensitiveOp`/`isDirectOp`: `SyncQueue.load()` verwirft Direkt-Vorgänge beim Laden still –
  das wäre stilles Verwerfen von Trainings. Stattdessen eine eigene **`LogQueue`** (gleiche Logik wie
  `SyncQueue`: ersetzen per Schlüssel, Reihenfolge, Netzwerkfehler = später), gespeichert als ein Text im
  geschützten Speicher `logQueue`.
- Schlüssel: **`save_session_log:<planned_session_id>`** (bzw. `:<id>` ohne Planbezug) – eine neuere Fassung
  derselben Einheit ersetzt die ältere; die `base_revision` (W3) bleibt die der zuletzt bestätigten Fassung.
- `set_exercise_start_weight:<exercise_id>` (eigenes Startgewicht, kein Tagebuch-Inhalt) bleibt in der normalen
  `SyncQueue` (neuester Wert gewinnt).
- **Sende-Reihenfolge (W8):** normale `SyncQueue` (Profil-Vorgänge wie bisher am Ende) → `LogQueue` →
  `close_missed_sessions()`. So streicht der Server nie eine Einheit, deren Eintrag noch unterwegs ist. **Vor
  `save_training_plan`** (neuer Plan, Planwechsel) sendet die App ebenfalls erst die `LogQueue` (H-b), damit
  Einträge noch ihrer Einheit zugeordnet werden, statt zu verwaisen. Vor einem Widerruf wird das Senden der
  `LogQueue` gesperrt und bereinigt (S1, R3).
- Jeder Vorgang trägt eine **`write_id`** (uuid je gespeicherter Fassung, R4); Neuversuche senden dieselbe.
- **Fehlerarten (W8):** Netzwerkfehler sowie **401/abgelaufenes JWT** (Sitzung wird erneuert) = „später erneut“,
  nie verwerfen. Lehnt der Server inhaltlich ab, sichert `onDropped` den Eintrag **vor** dem Entfernen aus der
  Warteschlange als Entwurf im geschützten Entwurfs-Speicher; Meldung „Dein Training vom … konnte nicht gespeichert
  werden – bitte prüfen“ mit Knopf zum Öffnen. **Nie stilles Verwerfen von Einträgen.**
- Antwort `orphaned` (B4): Eintrag gilt als gespeichert, Meldung „Dein Plan hat sich geändert – dein Training wurde
  trotzdem gespeichert.“
- Antwort `conflict` (W3): Die lokale Fassung wird als Entwurf behalten; Wahl **„Meine Fassung behalten“** (erneut
  senden mit der neuen `base_revision`) oder **„Andere übernehmen“** (Entwurf verwerfen, neu laden).

### 4.4 Konflikte bei zwei Geräten

- **Regel:** Je Einheit wird immer eine **ganze Fassung** gespeichert; Sätze aus zwei Geräten werden nie gemischt.
  Ob eine Fassung eine andere überschreiben darf, entscheidet die **Server-Revision** (W3), nicht die Geräte-Uhr –
  bei Abweichung fragt die App (4.3).
- Zwei Geräte tragen **verschiedene** verpasste Einheiten am selben Tag nach → eindeutiger Index „nie stapeln“ →
  das spätere bekommt die Meldung aus 3.6 und behält seinen Entwurf.
- Geräte-Uhr falsch → spielt für Konflikte keine Rolle mehr; `client_updated_at` wird auf `now()` gekappt.

### 4.5 Was nur online geht

Löschen eines Eintrags (`delete_session_log` mit `base_revision`), `close_missed_sessions`, Export, Laden älterer
Verläufe, Widerruf (`revoke_health_data`). Grund beim Löschen: Ein wartendes Löschen könnte sonst einen neueren Stand eines
anderen Geräts entfernen. Offline zeigt die App „Dafür brauchst du kurz Verbindung“.

### 4.6 Gerätespeicher und Zwischenspeicher

- `UserRows` (`types.ts`) um `sessionLogs`, `exerciseLogs`, `setLogs`, `cardioLogs`, `startWeights`; Supabase lädt
  die letzten `LOG_CACHE_WEEKS` Wochen plus `recent_exercise_logs()` für die Progression.
- `cacheableRows()` gibt die Tagebuch-Zeilen **nicht** in den normalen `rowsCache`, sondern getrennt zurück; sie
  kommen als Ganzes in den geschützten Tagebuch-Zwischenspeicher `logCache` (4.1). `startWeights` dürfen in den
  normalen `rowsCache`. Test, dass im `rowsCache` keine Tagebuch-Zeilen und nirgends `source_exercise_id`,
  `safety_rules` oder `medical_notice` landen.
- **Testmodus:** `local-backend.ts` + `local-rules.ts` (`isValidLogOp()`) prüfen dieselben Regeln wie
  `save_session_log` (Datum laut W2, Art, Grenzen, nie stapeln, Revision/`conflict`, `orphaned`, `skipped` → `completed`, Status `completed`).
- **Browser nach Tab-Neustart offline (H7):** Ohne Übungs-Bibliothek und Sicherheitsregeln im Speicher ist die
  Alternativen-Auswahl nicht prüfbar → Zustand „Übungen nicht prüfbar“ (6.3), Alternative erst nach kurzem
  Online-Gehen; Abhaken und „nicht gemacht“ gehen weiter.

---

## 5. Core-Logik in `packages/core` (mit Tests)

Neuer Ordner **`packages/core/src/log/`**, Export über `src/index.ts`; Anpassungen in `plan/loads.ts`.

### 5.1 Progression aus Einträgen (`log/progression.ts`)

**Entscheidung: Die Progression wird aus dem Tagebuch berechnet, nicht in den Plan geschrieben.**

- Der nächste Stand einer Übung ergibt sich aus dem **gespeicherten Progressions-Zustand** (`state_*`, 3.3) der
  letzten Einträge derselben `exercise_id` – **nie aus der angezeigten Vorgabe** (W4: die ist auf Stufen des Orts
  gerundet, in der Erholungswoche × 0,9, in der Einstiegswoche mit RPE −1 und auf den Wdh.-Bereich geklemmt; daraus
  zurückzurechnen würde den Fortschritt verfälschen). Der `state_*` des neuesten zählenden Eintrags ist der Zustand
  vor dieser Einheit; `nextLoad()` mit den zwei neuesten zählenden Einträgen (ohne Erholungs- und Einstiegswoche,
  `recent_exercise_logs()`) liefert den nächsten Zustand. Es braucht also nur diese **zwei** Einträge je Übung plus
  den neuesten überhaupt (Anzeige, Tippfehler-Vergleich), keinen kompletten Verlauf.
- Vorteile: funktioniert offline sofort; zwei Geräte rechnen gleich, sobald die Einträge synchron sind; kein
  Schreibrecht auf `planned_exercises` nötig; ein neuer Plan, ein Folgeblock oder ein Widerruf verlieren den
  Fortschritt nicht (gleiche `exercise_id` = gleicher Fortschritt).
- **Je Übung über alle Fassungen** (Vormerkung Erweiterung 5.7, Beispiel Mo 20 min / Sa 90 min): Der Zustand ist
  fassungsunabhängig (`ExerciseProgress` = Gewicht, Ziel-Wiederholungen, Zusatzsatz ja/nein, Dauer). Die Sätze der
  Fassung kommen aus dem jeweiligen Plan-Termin. `sessionAchieved()` wird so erweitert, dass jede Einheit gegen
  **ihre eigene** geplante Satzzahl geprüft wird (heute: gegen `state.sets`). Ein kurzer Termin mit 2 Sätzen zählt
  also als geschafft, wenn beide Sätze das Ziel erreichen. **Aber (W7):** Ein **Gewichtssprung** (und der
  Zusatzsatz-Schritt) setzt voraus, dass **mindestens eine** der zwei Einheiten mindestens die Vorlagen-Satzzahl
  (`templateSets`) hatte; zwei kurze Fassungen hintereinander bringen nur den +1-Wdh.-Schritt, der bei jeder Fassung
  gilt.
- Neue Funktionen: `progressFromLogs(exerciseId, logs)`, `prescriptionForDisplay(plannedExercise, progress,
context)` (Vorgabe für heute: Gewicht auf Stufen des Orts **abgerundet**, Wdh.-Ziel in `[reps_min, reps_max + 2]`
  geklemmt, Zusatzsatz nur im Rahmen von `TEMPLATE_DOSAGE_LIMITS`/V9, `firstSessionRpeTarget` beim großen Sprung).
- **Einstiegswoche / Woche 0 (R1):** zählt **nicht** für „zweimal in Folge“, ist aber **Kalibrierungsquelle**: Der
  erste Eintrag einer Übung ohne Zustand setzt `state_*` über `estimateWorkingWeight()` (5.2) – auch in der
  Einstiegswoche. `recent_exercise_logs()` liefert dafür den neuesten Einstiegswochen-Eintrag, solange es keinen
  zählenden gibt. Die Anzeige rechnet RPE −1 nur in die Vorgabe.
- **Wiedereinstieg nach Pause (Gratis-Schutzregel, Etappe A C1, `RETURN_AFTER_PAUSE`):** Pause = mehr als 28 Tage ohne
  Training dieser Übung an mindestens dem heute gezeigten Gewicht (Uhr setzen zurück: jede Wiedereinstiegs-Einheit
  und jeder zählende Eintrag, der an mindestens W trainiert hat – angezeigtes Gewicht, ein anderes gestemmtes nur als
  bestätigtes bzw. plausibles, einheitliches Gewicht aller Arbeitssätze (Tippfehler und einzelne schwerere Sätze
  zählen nicht); ohne angezeigtes Gewicht der schwerste Satz, wenn die Kalibrierung ihn annimmt; nach einem
  Gewichtsschritt gilt das Gewicht davor (auch das Heimgewicht); ohne zählenden Eintrag der neueste
  überhaupt, z. B. Einstiegswoche; ganz ohne Eintrag kein Wiedereinstieg; gilt auch am gerundeten Ort) → die erste Einheit danach zeigt das heute wirksame Gewicht W ×0,9, Ziel-Wdh. =
  reps_min, keinen Zusatzsatz und RPE −1 (nie unter 5); nur Anzeige, der Rohwert bleibt. Diese Einheit (`is_return`)
  zählt nicht; danach geht es mit dem Rohwert weiter. In einer Erholungswoche gewinnt je Größe das Strengere (nie
  doppelt ×0,9). Quelle: Mujika I, Padilla S (2000), Sports Med 30(2):79–87; Werte PRODUKTENTSCHEIDUNG.
- **Erholungswoche:** Einträge ändern den Zustand **nicht** (kopieren ihn unverändert in `state_*`) und zählen nicht
  für „zweimal in Folge“; die Anzeige rechnet Gewicht × 0,9 (`DELOAD_DOSAGE.loadFactor`) nur in die Vorgabe.
- **Alternative (W6, R2):** Bei `status = 'alternative'` ist `state_*` der Zustand der **Alternativ-Übung** aus
  deren **eigenem** Verlauf (unter ihrer `exercise_id`); nur ohne eigenen Verlauf bleibt er leer und sie wird über
  `estimateWorkingWeight()` kalibriert (5.2). Verboten ist nur die Übernahme von Vorgabe oder Zustand der
  **geplanten** Übung; gespeichert wird die eigene angezeigte Vorgabe der Alternativ-Übung. `load_type` ist der der tatsächlich
  gemachten Übung. Die geplante Übung behält ihren Zustand (die Einheit zählt für sie nicht). Tests: erste
  Alternative → Kalibrierung; **Alternative zweimal → +Wdh.**
- **Reihenfolge in der Anzeige:** Progression zuerst, **danach** `prepareSessionForDisplay()` mit den aktuellen
  Sicherheitsregeln – die strengste Regel gewinnt immer. RPE wird nie über den Deckel gehoben.
- **Ohne Zustand und Vorgabe** (nach Widerruf, S1): neu kalibrieren aus den Ist-Werten (5.2), Vergleich mit
  `CONSERVATIVE_PLAN_RULES.rpeMax`.
- Hinweise statt Automatik: `harder_variant`, `stronger_band`, `no_heavier_weight` → feste deutsche Sätze.
- **Körpergewicht (ab Engine-Version 3, `docs/PLAN-KOERPERGEWICHT.md` §5.5, A10):** wie der Puffer beim großen
  Gewichtssprung – Wdh. bis `reps_max + 2` (≤ 30, `LOAD_PROGRESSION.extraRepsBuffer`), dann +1 Satz
  (`LOAD_PROGRESSION.extraSets`, ≤ 6, V9), erst dann `harder_variant`; nur kurze Fassungen (W7) bringen nur +Wdh. bis
  zum Puffer. Den Hinweis zeigt die App über `progressHintForDisplay(exerciseId, result, { library, profile, rules })`
  (`log/harder-variant.ts`) mit dem **Namen der Variante**: `findHarderVariant()` mit den HEUTE wirksamen
  Sicherheitsregeln und dem Geräte-Profil des Orts der Einheit – gesperrte (z. B. ab 65 Tisch-Rudern) oder nicht
  machbare Varianten werden nie vorgeschlagen; Einsteiger und vorsichtige Pläne höchstens eine Schwierigkeitsstufe
  schwerer (`HARDER_VARIANT_RULES`); gibt es keine, entfällt der Hinweis. Kein automatischer Tausch: Wer die Variante
  macht, trägt sie als Alternative ein (eigener Verlauf, R2). **Pflichtpunkt der UI-Etappe:** Der rohe Hinweis
  `harder_variant` wird in der App NIE ohne `progressHintForDisplay()` angezeigt (Test in der UI-Etappe: Hinweis mit
  Variantenname bzw. kein Hinweis bei gesperrter/nicht machbarer Variante).
- Gratis-Grenze: **nie automatisch senken**. Trainiert jemand selbst mit anderem Gewicht (alle Arbeitssätze
  gleich), wird das der neue Ausgangspunkt ohne zusätzlichen Sprung (Frage 5) – **leichter immer, schwerer nur
  begrenzt (W5):** Liegt das selbst gewählte Gewicht mehr als 10 % (`LOAD_PROGRESSION.maxIncreaseFraction`) über dem
  Zustand, übernimmt die Progression es **nur**, wenn die Person die Plausibilitäts-Warnung („Absichtlich deutlich
  schwerer als geplant?“) ausdrücklich bestätigt hat (`exercise_logs.weight_confirmed = true`). Sonst bleibt der
  bisherige Zustand und es gilt das normale `nextLoad()` – ein Tippfehler (225 statt 22,5 kg) treibt die
  Progression so nie hoch.

### 5.2 Arbeitsgewicht und eigenes Startgewicht (`log/calibration.ts`)

- Erster Eintrag einer Gewichtsübung ohne bisherigen Zustand → `estimateWorkingWeight()` (vorhanden in
  `plan/loads.ts`: Epley + Reserve, nur bis 12 Wdh. + Reserve, höchstens +10 % über dem eingetragenen Gewicht,
  auf Stufen abgerundet). Eingabesatz = schwerster geschaffter Satz; fehlt das RPE, gilt `CALIBRATION_MISSING_RPE`.
  Ziel = `reps_min` und `rpe_target` der nächsten Belastungswoche.
- **Eigenes Startgewicht:** gilt nur, solange es keinen Eintrag gibt; auf vorhandene Stufen abgerundet
  (`snapToAvailableWeight()`, `null` unter der kleinsten Stufe → „leichteste Stufe wählen“); Anzeige
  „Vorschlag aus deinem Startgewicht“; derselbe RPE-Deckel.
- **Absolute Warnschwellen (W5, `WEIGHT_CONFIRM_LIMITS`, PRODUKTENTSCHEIDUNG):** Für den ersten Eintrag einer Übung
  und für das eigene Startgewicht gibt es keinen Zustand zum Vergleichen; deshalb Bestätigung über Kurzhantel/
  Kettlebell 50 kg je Stück bzw. Langhantel/Maschine 200 kg. Ohne Bestätigung wird der Wert nicht als
  Kalibrierung bzw. Startgewicht übernommen.

### 5.3 Ausdauer (`log/cardio.ts`)

- `paceSecondsPerKm()`, `speedKmh()`, `paceSecondsPer100m()` (Schwimmen) – `null` bei Distanz 0 oder fehlend.
- `cardioPlausibility()` → Warnung bei Geschwindigkeit über `CARDIO_PLAUSIBILITY_KMH` der Art.
- **10-%-Regel mit echten Einträgen:** `enduranceReferenceFromBlock()` (`plan/schedule.ts`) zählt im Folgeblock je
  Einheit `min(geplante, eingetragene Minuten)`; ohne Eintrag (= nach Wochenende `skipped`) zählt sie nicht. Das ist
  eine **Schutzregel** (CLAUDE.md: höchstens ~10 % Steigerung gegenüber dem tatsächlich Trainierten), keine
  Live-Anpassung, und gilt deshalb gratis. Der Umfang sinkt dadurch nie unter den Startumfang.

### 5.4 Plausibilität und Schemas (`log/schemas.ts`)

- Zod-Schemas `sessionLogPayloadSchema` (strikt, verschachtelt) = Feldliste von `save_session_log`;
  `exerciseStartWeightSchema`.
- `setEntryWarnings()`: Gewicht mehr als 10 % über dem Zustand bzw. über den absoluten Schwellen (W5) →
  Bestätigung nötig, damit es für die Progression zählt (5.1); mehr als 3-mal so viele Wiederholungen wie geplant →
  „Tippfehler? Bitte prüfen“ (nur Warnung).

### 5.5 Pausentimer (`log/rest-timer.ts`)

Reine Zeitrechnung mit Zeitstempeln (nicht mit Intervallen, damit Hintergrund und Bildschirmsperre nichts
verfälschen): `startRest(restS, nowMs)`, `remainingSeconds(timer, nowMs)`, `adjustRest(timer, ±15 s)` (0–600 s),
`isRestOver()`; `restAfterSet(exercise, next)` – innerhalb eines Supersatzes (`superset_group`) keine Pause bis zur
letzten Übung der Gruppe.

### 5.6 Woche und Verlauf (`log/summary.ts`)

- `weekLogSummary(sessions, logs, weekStart, today)` – je Tag: `done`, `partial`, `missed` (vorbei, ohne Eintrag,
  Woche läuft), `skipped`, `planned`, `rest`; Summen: Einheiten geschafft/geplant, Kraft-Sätze, Ausdauer-Minuten
  und Kilometer.
- Nachgeholte Einheiten erscheinen in Woche und Verlauf am **tatsächlichen Datum** `performed_on` (H2), mit Vermerk
  „nachgeholt vom …“. `planned`-Altlasten ersetzter Pläne werden ausgeblendet bzw. als „entfallen“ gezeigt (H1).
- `historyByWeek(logs, { limit })` und `exerciseHistory(exerciseId, logs)` (je Datum: bester Satz als
  „Gewicht × Wiederholungen“, keine 1RM-Anzeige).
- `canCatchUp(session, week, today)` – Nachholen heute nur nach den Regeln von `rescheduleSession()` (gleiche
  ISO-Woche, Tag frei, 48 h zwischen Krafteinheiten) **und** dem Datumsfenster von `save_session_log` (W2: gleiche
  ISO-Woche ± 1 Tag, ≤ heute + 1, ≥ heute − 14) – eine gemeinsame Funktion für App, Testmodus und Tests.

### 5.7 Tests und Grenzfälle (CLAUDE.md)

- **Progression:** erste Einheit ohne Verlauf; „eine geschafft“ → +1 Wdh.; „zweimal ab `reps_max`“ → Gewicht;
  Kurzhantel 4 → 6 kg (> 10 %) → Puffer-Wdh. → Zusatzsatz → Sprung mit `firstSessionRpeTarget` −1; keine höhere
  Stufe → `no_heavier_weight`; Langhantel über `barbellLoadSteps()`; Halteübung 20 s/50 s/120 s;
  Körpergewicht → Puffer, Zusatzsatz, dann Hinweis mit Variante (Engine 3; UI zeigt ihn nur über
  `progressHintForDisplay()`); Band → Hinweis; Erholungswoche ohne Schritt; **zwei Erholungs-Einheiten in Folge** (Zustand
  unverändert, W4); **Studio → Zuhause → Studio** (Orts-Rundung verfälscht den Zustand nicht, W4); **Mo 20 / Sa 90**
  (2 bzw. 4 Sätze im Wechsel) **erweitert (W7):** zweimal Mo 20 hintereinander → nur +Wdh., kein Gewichtssprung;
  Mo 20 + Sa 90 → Sprung möglich; Wechsel auf neuen Plan mit anderem Wdh.-Bereich (Klemmen); Einträge in falscher
  Reihenfolge (zwei Geräte); Zustand und Vorgabe leer nach Widerruf (Neu-Kalibrierung); Alternative = eigener
  Fortschritt, geplante Übung unverändert, Alternative zweimal → +Wdh. (W6, R2); **Woche 0 → Woche 1** mit
  kalibriertem Gewicht aus dem Einstiegswochen-Eintrag (R1); selbst gewähltes leichteres Gewicht; schwereres Gewicht > 10 % ohne
  bzw. mit Bestätigung (W5).
- **Grenzen:** 0,5 kg und 500 kg, 0 Wdh., 100 Wdh., 1 und 10 Sätze, 1 vs. 7 Trainingstage je Woche,
  Personen 16 und 95 Jahre (Deckel aus `planSafetyRules()` greifen nach der Progression), vorsichtiger Plan RPE 7.
- **Kalibrierung:** 12 Wdh. + 0 Reserve (Grenze), 13 Wdh. (keine Hochrechnung), ohne RPE, Gewicht unter kleinster
  Stufe, Startgewicht über 500 kg (abgelehnt), erster Eintrag über den absoluten Warnschwellen ohne/mit
  Bestätigung.
- **Ausdauer:** Distanz 0, 1 min, 12 h, Schwimmen je 100 m, Warnung knapp über/unter der Grenze, verwaiste Einträge
  zählen nicht für den 10-%-Bezug (H-a), 10-%-Bezug mit
  halb geschafften Einheiten, ohne Einträge.
- **Timer:** Hintergrund (Zeitsprung), Anpassen unter 0/über 600 s, Supersatz.
- **Woche/Verlauf:** Sommerzeitwechsel, Jahreswechsel (ISO-Woche 53), verschobene Einheit (`original_date`),
  Nachholen am Sonntag.
- **Eigenschaftstest:** über viele zufällige Eintragsfolgen – **auch mit eingestreuten Ausreißern** (Tippfehler
  × 10, unbestätigt) – nie ein Gewichtssprung > 10 % ohne vorherigen Puffer oder Bestätigung, nie ein Gewicht über
  500 kg, nie RPE über dem Deckel, nie automatisch weniger Gewicht.
- **Wiedereinstieg (C1):** genau 4 Wochen (noch normal) und 4 Wochen + 1 Tag, Pause im Studio, lange Phase zu Hause
  und dann Studio, Erholungswoche direkt nach der Pause (nicht doppelt ×0,9), Übung erstmals nach Pause im neuen Plan;
  Eigenschaftstest: nach Ortswechsel gegen den schwersten gestemmten Satz der letzten 4 Wochen, älter →
  Wiedereinstiegs-Anzeige, gleicher Ort strenge Regel.
- **Pause = 28 Tage ohne Training an mindestens dem heute gezeigten Gewicht (D1):** nur zu Hause + 3 Monate →
  Wiedereinstieg zu Hause; Rohwert 21/angezeigt 20 + Pause → Wiedereinstieg; Studio kürzlich, zu Hause nach 5 Wochen
  → kein Wiedereinstieg; zu Hause kürzlich, Studio nach 5 Wochen → Wiedereinstieg im Studio; nur Einstiegswoche +
  5 Wochen → Wiedereinstieg; erster Tag nach Gewichtsschritt keine Pause (auch Anheben vom gerundeten Ort 20 →
  22,5); Tippfehler-Satz (200 kg unbestätigt, 1 × 22,5, 10 × 22,5 statt 20) setzt die Uhr nicht zurück; Eintrag ohne
  angezeigtes Gewicht nur bei gestemmtem Gewicht ≥ W. Eigenschaftstest „gemessen am Gestemmten“ (nur bestätigtes
  bzw. plausibles, einheitliches Gewicht): Wiedereinstieg nur ohne solches Training ≥ W in den letzten 28 Tagen,
  sonst W ≤ dessen Gewicht + 10 %.
- **Datumsfenster (W2):** `canCatchUp()` an den Rändern (Sonntag/Montag ± 1 Tag, heute − 14/− 15, heute + 1/+ 2).
- **CI-Zusammenfassung:** `packages/content/src/plan-examples.ts` bekommt „Beispiel-Progression“: für drei
  Test-Personen 8 ausgedachte Einheiten und die jeweils nächste Vorgabe – so seht ihr Etappe A am Handy.

---

## 6. App (`apps/mobile`, Web-Export und nativ gleich)

### 6.1 Bildschirme

1. **„Heute“** (`app/today.tsx`): Knopf **„Training starten“** auf der heutigen Einheit; bei verpasster Einheit
   dieser Woche **„Heute nachholen“** (nur wenn `canCatchUp()`); erledigte Einheit mit Haken und „Ansehen/Ändern“.
   Die Vorgaben in `SessionCard` (`components/plan.tsx`) zeigen ab jetzt das berechnete Ziel („3 × 10 mit 22,5 kg“,
   „je Hantel“ bei Kurzhanteln).
2. **Trainingsmodus** (neu `app/workout/[sessionId].tsx`):
   - Kopf: Name, Fortschritt „Übung 2 von 5“, Arzt-Hinweis (wenn `medical_notice`) wie auf „Heute“.
   - Je Übung eine Karte: Vorgabe, Satz-Zeilen mit **Gewicht −/+** (Schritt = nächste eigene Stufe bzw. 2,5 kg),
     **Wiederholungen −/+**, großer Haken „Satz geschafft“; danach startet der Pausentimer.
   - Menü je Übung: **„Nicht gemacht“** (ein Tipp, **ohne** Grund-Auswahl, S3), **„Alternative durchgeführt“** (Liste aus `exercise_alternatives`, nur
     Übungen, die die aktuellen Sicherheitsregeln erlauben und nicht schwerer sind – gleiche Regeln wie
     `findSubstitute()`), **„Eigenes Startgewicht“** (nur ohne Eintrag).
   - Optional je Satz: „Wie viele Wiederholungen wären noch gegangen?“ (0 / 1 / 2 / 3 / 4 / 5+).
   - **Pausentimer** als Leiste unten: Restzeit groß, −15 s / +15 s / Überspringen; am Ende Vibration (App) und
     sichtbarer Hinweis; Bildschirmleser-Ansage.
   - **Training beenden:** Belastungsempfinden 0–10, Notiz (Hinweis aus S3), Speichern.
   - **Browser:** fester Hinweis „Lass diesen Tab offen, bis dein Training übertragen ist“ und `beforeunload`-Warnung
     (4.2); Gewicht > 10 % über Zustand bzw. über den Warnschwellen → Bestätigungs-Dialog (5.1/5.2).
3. **Ausdauer-Eintrag** (gleicher Bildschirm, andere Ansicht): Dauer (Std/Min), Distanz in km mit Komma, Höhenmeter,
   tatsächliche Art; Pace bzw. km/h erscheint live; Anstrengung 0–10 mit Gesprächstest-Erklärung.
4. **Woche** (neu `app/week.tsx`): Mo–So mit Status-Symbol **und** Text, Summen, Blättern zu früheren Wochen.
5. **Verlauf** (neu `app/history.tsx`, `app/history/[exerciseId].tsx`): Einheiten nach Wochen (je 20 nachladen),
   Antippen öffnet den Eintrag (ansehen, ändern, löschen); Verlauf je Übung.
6. **Einstellungen:** „Meine Daten exportieren“ (Web: Datei herunterladen, App: Teilen-Dialog, Zwischen-Datei danach
   gelöscht) mit Hinweis „Diese Datei enthält Gesundheitsdaten“ (W9). Beim Widerruf: „Dein Tagebuch bleibt;
   Vorgaben aus dem Gesundheits-Check werden daraus entfernt“ (H6) und der Widerrufs-Dialog mit der Wahl aus S1.
   **Abmelden** mit wartenden Einheiten, offenen Entwürfen oder Konflikten → Nachfrage aus 4.1 (R6).

Navigation: Links von „Heute“ zu Woche und Verlauf; eine Tab-Leiste kommt, wenn Ernährung dazukommt (Phase 5).

### 6.2 Bedienung im Studio

- Touch-Ziele mindestens 48 × 48 dp, Haken und −/+ größer; Zahlen groß; Einhand-Bedienung (wichtige Knöpfe unten).
- **Bildschirm bleibt an**, solange der Trainingsmodus offen ist (`expo-keep-awake`; im Browser über die Wake-Lock-
  Schnittstelle, wo verfügbar), mit Schalter in den Einstellungen.
- **Vibration** am Pausenende über `expo-haptics` (App); im Browser nur sichtbar.
- Neue Pakete `expo-keep-awake`, `expo-haptics`, `expo-sharing`/`expo-file-system` (Export) – laufen in Expo Go und
  im EAS-Build, kein Development Build nötig.

### 6.3 Zustände

| Zustand                     | Anzeige                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laden                       | `LoadingState`                                                                                                                                            |
| Leer                        | Ruhetag → „Heute ist Ruhetag“ + nächste Einheit; Verlauf leer → „Noch keine Einträge – dein erstes Training erscheint hier.“                              |
| Offline                     | Hinweis „Offline – deine Einträge werden später übertragen“ + Zahl wartender Einheiten (vorhandenes `pendingChanges`)                                     |
| Speichern gescheitert       | Eintrag bleibt als Entwurf, „Erneut versuchen“, Texte aus `t.errors`                                                                                      |
| Entwurf gefunden            | „Fortsetzen / Speichern / Verwerfen“ (Verwerfen mit Nachfrage)                                                                                            |
| Konflikt (anderes Gerät)    | „Diese Einheit wurde auf einem anderen Gerät geändert.“ – „Meine Fassung behalten“ / „Andere übernehmen“ (4.3)                                            |
| Plan hat sich geändert      | „Dein Plan hat sich geändert – dein Training wurde trotzdem gespeichert.“ (`orphaned`, B4)                                                                |
| Abmelden mit Wartendem      | „X Trainings sind noch nicht übertragen – jetzt senden / trotzdem abmelden (gehen verloren)“; Rest nach Senden → erneut fragen (R6)                       |
| Fremdes Konto auf dem Gerät | „Auf diesem Gerät liegen Einträge eines anderen Kontos – löschen?“ (R5)                                                                                   |
| Sitzung abgelaufen          | „Bitte melde dich erneut an“ – Einträge bleiben erhalten (R5)                                                                                             |
| Browser-Tab schließen       | `beforeunload`-Warnung, solange Entwurf oder Wartendes existiert                                                                                          |
| Tag schon belegt            | „An diesem Tag ist schon eine Einheit eingetragen.“                                                                                                       |
| Übungen nicht prüfbar       | wie Phase 3 (Bibliothek fehlt) – Training starten erst nach kurzem Online-Gehen; im Browser nach Tab-Neustart offline: Alternativen-Auswahl gesperrt (H7) |
| Nur online (Löschen/Export) | „Dafür brauchst du kurz Verbindung.“                                                                                                                      |

### 6.4 Barrierefreiheit

- Schieberegler 0–10 als eigenes Bauteil mit `accessibilityRole="adjustable"`, Erhöhen/Verringern-Aktionen und
  Pfeiltasten im Browser; jede Stufe mit Wort („0 – Ruhe, 3 – locker, 5 – mittel, 7 – schwer, 10 – maximal“).
- −/+-Knöpfe mit Ansage („Gewicht 22,5 Kilogramm, erhöhen“); Status nie nur über Farbe; Schriftvergrößerung ohne
  abgeschnittene Zahlen; Pausenende per `AccessibilityInfo.announceForAccessibility`.

### 6.5 Texte

Alle Texte deutsch in `src/i18n/de.ts` (neue Bereiche `workout`, `week`, `history`; ergänzt `today`, `settings`,
`errors`). RPE immer als „Wiederholungen in Reserve“ erklärt, Anstrengung bei Ausdauer mit Gesprächstest, Zahlen
mit Komma, km und kg ausgeschrieben im Bildschirmleser. Hinweise der Progression als feste Sätze, z. B. „Du hast
zweimal alle Wiederholungen geschafft – heute 2,5 kg mehr.“

---

## 7. EAS Build und Submit (eigene Etappe nach dem MVP)

### 7.1 Ziel

In der GitHub-App den Workflow **`eas-build`** starten → Android-APK zum Installieren und iPhone-Build in
**TestFlight**. Vorhanden: `.github/workflows/eas-build.yml` (überspringt freundlich ohne Secrets/Projekt-ID),
`apps/mobile/eas.json` (Profile `development`, `preview` = APK, `production` mit `autoIncrement`),
`apps/mobile/app.config.ts` (`EAS_PROJECT_ID` noch leer, Bundle-ID/Paket `de.fitnessapp.app`), `docs/SETUP.md` Teil D.

### 7.2 Änderungen im Code (Etappe E)

1. Workflow `eas-build.yml` (W12): neue Auswahl **„Nach dem Build einreichen“** (nein / ja); prüft je Plattform
   die nötigen Secrets und überspringt mit verständlichem Hinweis. Regeln im Schritt „Voraussetzungen prüfen“:
   - **ios + preview** wird abgefangen und übersprungen („iPhone-Tests laufen über production + TestFlight“), weil
     `preview` (`distribution: internal`) beim iPhone registrierte Geräte bräuchte; bei **all + preview** wird nur
     Android gebaut.
   - **Einreichen nur mit `production`** (`--auto-submit`): iOS → TestFlight, Android → Play intern. Android
     `preview` ist eine APK und **nicht** einreichbar (Play nimmt nur AAB) – Auswahl wird dann mit Hinweis ignoriert.
2. `eas.json`: `submit.production.ios.ascAppId` (App-ID aus App Store Connect, kein Geheimnis),
   `submit.production.android.track = "internal"` und **`releaseStatus = "draft"`**, solange die App bei Google nie
   veröffentlicht war (Google lehnt sonst ab); je Build-Profil `environment` (`preview` → `preview`, `production` →
   `production`), damit EAS die passenden Expo-Umgebungsvariablen nimmt.
3. `app.config.ts`: Projekt-ID eintragen (Gründer liefern sie), `ios.infoPlist.ITSAppUsesNonExemptEncryption`
   (Empfehlung `false`: nur Standard-Verschlüsselung zum Datenschutz auf dem Gerät (AES über das Betriebssystem/
   expo-crypto) und HTTPS – passt laut Wächter (H4); Bestätigung in der Rechts-Checkliste Phase 12).
4. **Apple-Schlüssel ohne Terminal (W11):** Claude legt in Etappe E gegen die **aktuelle** Expo-Dokumentation fest,
   wie der erste iOS-Build ohne Terminal klappt, und schreibt es in SETUP.md. Bevorzugt: **.p8 direkt auf expo.dev
   im Handy-Browser hochladen** (Konto bzw. Projekt → Credentials → App Store Connect API Key – Datei-Auswahl aus
   „Downloads“, kein Kopieren von Text); EAS erzeugt dann Zertifikat und Profil selbst. Alternative, falls die
   Webseite das nicht abdeckt: Schlüssel als GitHub-Secrets, der Workflow schreibt die Datei mit `umask 077` in ein
   Temp-Verzeichnis, übergibt sie per Expo-Umgebungsvariablen (Namen laut aktueller Doku) und löscht sie im
   `always()`-Schritt. **DoD-Punkt von Etappe E.**
5. Expo-Umgebungsvariablen `EXPO_PUBLIC_*` (Supabase-URL, Anon-Key) mit Sichtbarkeit „Plain text“ oder
   „Sensitive“, **nicht** „Secret“ – sie stehen ohnehin lesbar im App-Paket (genaues Verhalten in Etappe E gegen die
   Expo-Doku prüfen).

### 7.3 Klick-Anleitung (neuer Teil „D2 – Apple und Google verbinden“ in `docs/SETUP.md`)

**Secrets nie in den Chat.** Schlüssel kommen nur in **GitHub → Settings → Secrets** oder in **expo.dev →
Credentials** bzw. **Environment variables**.

_Expo (falls noch nicht erledigt, Teil D):_ Projekt anlegen, Projekt-ID an Claude geben (kein Geheimnis),
`EXPO_TOKEN` als GitHub-Secret, Supabase-Werte als Expo-Variablen.

_Apple (TestFlight):_

1. developer.apple.com → **Account** → Apple Developer Program beitreten (99 USD/Jahr; als Firma mit D-U-N-S-Nummer,
   Frage 10).
2. appstoreconnect.apple.com → **Apps → +** → Neue App: Name „Alpha5“, Sprache Deutsch, Bundle-ID
   `de.fitnessapp.app`, SKU `alpha5`. Die **Apple-ID der App** (Zahl unter „App-Informationen“) an Claude geben –
   kein Geheimnis.
3. **Benutzer und Zugriff → Integrationen → App Store Connect API → Schlüssel erzeugen** (Rolle „App-Manager“).
   **Key-ID** und **Issuer-ID** notieren, die **.p8-Datei** herunterladen (geht nur einmal; landet in „Downloads“).
4. expo.dev → Projekt → **Credentials** → iOS → **App Store Connect API Key → hinzufügen** → .p8 aus „Downloads“
   auswählen, Key-ID, Issuer-ID und Team-ID eintragen (genaue Klick-Namen prüft Claude in Etappe E; falls nur die
   Workflow-Variante geht, stehen dort die GitHub-Secret-Namen). Kein Text-Kopieren aus der Dateien-App.
5. TestFlight → **Interne Tests** → Gruppe anlegen, euch beide hinzufügen (interne Tester brauchen keine
   Beta-Prüfung durch Apple).

_Google (für den Play Store; zum Testen reicht die APK):_

1. play.google.com/console → Konto anlegen (25 USD einmalig; Firma empfohlen, Frage 10).
2. **App erstellen** → Name „Alpha5“, Deutsch, App, kostenlos.
3. Google Cloud → Dienstkonto mit JSON-Schlüssel anlegen und in der Play Console unter **Nutzer und Berechtigungen**
   einladen; JSON bei **expo.dev → Projekt → Credentials → Android → Google Service Account Key** hochladen.
4. **Wichtig:** Den **allerersten** App-Upload verlangt Google von Hand: Build-Seite auf expo.dev → **AAB
   herunterladen** → Play Console → **Testen → Interner Test → Neuer Release → hochladen**. Danach geht es
   automatisch.

_Kosten (H3):_ Apple 99 USD/Jahr, Google 25 USD einmalig. Der **Expo-Gratisplan** hat eine begrenzte Zahl Builds
pro Monat (iOS getrennt gezählt) und eine längere Warteschlange; die aktuellen Werte trägt Claude in Etappe E von der
Expo-Preisseite in SETUP.md ein.

_Ablauf danach:_ GitHub-App → Repository → **Actions → eas-build → Run workflow** → Plattform und Profil wählen →
Link zu expo.dev in der Zusammenfassung → Android: APK auf dem Handy öffnen und installieren („Unbekannte Apps
zulassen“ einmal erlauben); iPhone: TestFlight-App → Alpha5 → Installieren.

---

## 8. Etappen (je ein Pull Request, jede mit Wächter-Prüfung)

**A – Core: Progression aus Einträgen, Ausdauer, Timer, Woche/Verlauf.** Ordner `log/` (5.1–5.6), Anpassung
`sessionAchieved()`/`nextLoad()` (Sätze je Fassung), `enduranceReferenceFromBlock()` mit Einträgen, neue
Konstanten mit Quellen, Zod-Schemas, Beispiel-Progression in der CI-Zusammenfassung.
_DoD:_ alle Tests aus 5.7 grün inkl. Eigenschaftstest mit Ausreißern; Progression nur aus `state_*` (W4), Sprung nur
mit voller Satzzahl (W7), Bestätigungsregel (W5), Alternative (W6), `canCatchUp()` mit Datumsfenster (W2),
Orts-Rundung nur in der Rechnung (B1), Wiedereinstieg nach Pause (C1); keine
Migration, keine App-Änderung; `docs/` nachgezogen (H5): KONZEPT 4 „Umsetzung ab Phase 4“, Umsetzungsstand hier.

**B – Datenbank.** Migrationen (Enums inkl. `completed` in eigener Datei; Tabellen, RLS, CHECKs, Indizes;
Spalten aus Etappe A vormerken: `exercise_logs.target_extra_set` und `exercise_logs.is_return` (beide in
`sessionLogPayloadSchema`, Abgleich der Feldliste in `db-sync.test.ts`); Funktionen aus 3.6 inkl. `revoke_health_data()` und `private.neutralize_health_plan_logs()`;
`consents_after_revoke()` erweitert; Phase-3-Nachtrag `save_training_plan` (H-c); Verschiebe-Trigger ergänzt (W1); Lese-Regel archivierter Übungen), pgTAP
`17_training_logs.test.sql` und `18_training_log_rpcs.test.sql` plus Ergänzungen in `04_account_deletion`,
`06_profile_required`, Widerrufs- und Plan-Tests; `database.types.ts`; `db-sync.test.ts`.
_DoD:_ `db-test` grün mit u. a.: fremde Einträge unsichtbar; direktes Schreiben scheitert (auch
`planned → completed` per PostgREST, W1); idempotentes Speichern, Revision und `conflict`, bestehende `id` beim
Ersetzen (W3); nie stapeln; Datumsfenster gleiche ISO-Woche (W2); `skipped → completed` (W8); verwaiste Einträge
`orphaned` (B4); `from_health_plan` nur vom Server; **Wächter-Punkt B1:** nach Widerruf keine Vorgabe, kein Zustand,
kein Varianten-Name in Einträgen aus Gesundheits-Plänen, Ist-Werte erhalten; `revoke_health_data(true)` löscht nur
diese in einer Transaktion, `anon` darf nicht, fremde Einträge unberührt (H5, R3); Neutralisierung auch bei
abgelehnter Neu-Einwilligung (H-c); `write_id` „Antwort verloren, erneut gesendet“ und `delete_session_log` mit
`base_revision` (R4); erfundene/fremde `planned_session_id` = `orphaned` ohne unterscheidbare Meldung (H-a); nach Plan-Löschung `user_id` erhalten, nur Verweis `null` (B2); Aufräumen ersetzter Pläne behält Einträge;
`close_missed_sessions` nur aktiver Plan, nur nach Wochenende und nur `planned`; Fehler ohne Detail für alle Codes aus
3.6 (W10); Export deckt alle Tabellen mit Fremdschlüssel auf `auth.users` ab (W9, H-f); Startgewicht: Profil-Pflicht, CHECK, Konto löschen (W14);
`docs/` nachgezogen: KONZEPT 12 „Abweichungen ab Phase 4“, Umsetzungsstand hier.

**C – App: Trainingsmodus und Tagebuch offline.** `write-ops.ts`, `sync-queue.ts`, `local-rules.ts`,
`local-backend.ts`, `supabase-backend.ts`, `types.ts`, `kv.ts` (neue `STORAGE_KEYS` aus 4.1), neue `log-queue.ts`,
`protected-store.ts`/`device-protected-store*.ts` (drei weitere Instanzen), `state/app-state.tsx` (neue Aktionen
`startWorkout`, `saveWorkout`, `discardDraft`, `setStartWeight`, Abmelden mit Nachfrage), Bildschirme 6.1 Punkte
1–3, Texte. Frage 3 ist entschieden (verschlüsselt). Falls der PR zu groß wird: C1 Kraft, C2 Ausdauer +
Pausentimer.
_DoD:_ Vitest für `LogQueue` (Schlüssel, Reihenfolge normale Queue → Tagebuch → `close_missed_sessions`, `LogQueue`
vor `save_training_plan` (H-b), gleiche `write_id` bei Neuversuch (R4), Senden gesperrt + Bereinigung vor Widerruf
und auf anderen Geräten bei ungültiger Einwilligung (R3), `owner_user_id` / fremdes Konto / Sitzungsablauf (R5),
Abmelde-Nachfrage zählt Queue und Entwürfe, Rest → nicht abmelden (R6), 401 = später, Ablehnung sichert Entwurf **vor** dem Entfernen, `conflict`, `orphaned`), getrennte geschützte Speicher
(Widerruf/Planwechsel leeren sie nicht, Abmelden/Konto löschen/Testdaten löschen schon, inkl. Schlüssel), nichts vom
Tagebuch im `rowsCache`/localStorage, Widerruf im Testmodus (neutralisieren und „auch löschen“), „nicht gemacht“ ohne
Grund-Feld; Playwright mit festem Datum: Kraft-Einheit komplett, Alternative, „nicht gemacht“, offline eintragen
(`context.setOffline`) und später senden, **Entwurf nach Neu laden** (nicht Tab schließen – sessionStorage),
`beforeunload`-Warnung, Progression nach zwei Einheiten sichtbar, Ausdauer mit Pace, Widerruf behält Tagebuch ohne
Vorgaben; Screenshots hell/dunkel; alle Zustände aus 6.3; `docs/` nachgezogen (H5).

**D – Woche, Verlauf, Export.** Bildschirme 6.1 Punkte 4–6, `export_my_data()` in der App.
_DoD:_ Playwright für Woche (Status, Summen, Blättern, nachgeholt am tatsächlichen Datum, „entfallen“) und Verlauf
(ändern, löschen nur online), Export-Datei enthält Tagebuch, Konto-E-Mail und Einwilligungs-Verlauf, Hinweis vor dem
Herunterladen; **Live-Test mit Supabase (W13)** als Bedingung für „MVP fertig“: zwei Handys mit demselben Konto,
Eintrag im Flugmodus, Übertragung, Konflikt-Dialog, Widerruf (Tagebuch bleibt ohne Vorgaben), Abmelden mit
Wartendem – Ergebnis im Umsetzungsstand festgehalten; DoD-Punkt 7: `docs/` aktualisiert (KONZEPT 5 „Umsetzung“,
Umsetzungsstand hier).

**E – EAS Build und Submit.** Abschnitt 7, SETUP.md Teil D2.
_DoD:_ Workflow überspringt ohne Secrets freundlich (getestet ohne Secrets); ios + preview wird abgefangen,
Einreichen nur mit production (W12); **erster iOS-Build ohne Terminal** nach dem in 7.2 Punkt 4 festgelegten Weg
(W11); mit Secrets: APK installierbar, iOS in TestFlight sichtbar; Kosten/Build-Kontingent in SETUP.md (H3);
Anleitung von den Gründern einmal am Handy durchgespielt.

Reihenfolge A → B → C → D; E kann nach C parallel starten, sobald die Gründer die Konten haben (Konto-Prüfungen bei
Apple/Google dauern Tage).

---

## 9. So testet ihr es am Handy

**Etappe A:** Pull Request → **Checks → ci → Summary** → Tabelle „Beispiel-Progression“ lesen.

**Etappe B:** Nichts zum Ansehen; Workflow `db-test` muss grün sein.

**Etappen C und D – Testmodus, keine Supabase nötig:** Vorschau-Link aus dem Pull Request (nach dem Merge:
**https://fitnessapp-alpha-five.vercel.app**).

1. „Ohne Konto testen“ → Onboarding mit 3 Kraft-Tagen im Studio → „Zum Plan“.
2. „Heute“ → **Training starten** → Sätze eintragen und abhaken; die Pause läuft unten mit.
3. Bei einer Übung **„Alternative durchgeführt“** wählen, bei einer anderen **„Nicht gemacht“**.
4. **Flugmodus an**, weitertrainieren, **Training beenden** (Belastung, Notiz) → Hinweis „wird später übertragen“.
   Im Testmodus wird sofort lokal gespeichert; die Warteschlange zeigt ihr am besten mit Supabase (unten).
5. Seite **neu laden** → die Einheit ist erledigt; mitten im Training neu laden → „Fortsetzen?“. (Im Browser liegt
   das Tagebuch nur bis zum Schließen des Tabs auf dem Gerät – deshalb Neu laden statt Tab schließen.)
6. Bei einer Übung in allen Sätzen die Ziel-Wiederholungen eintragen → in der Wochenübersicht den nächsten Tag mit
   derselben Übung antippen: Das Ziel zeigt eine Wiederholung mehr.
7. Ausdauer-Tag: 5 km in 30 min → „6:00 min/km“.
8. **Woche** und **Verlauf** öffnen; Eintrag ändern; Export herunterladen.
9. Einstellungen → Einwilligung Gesundheitsdaten widerrufen → „Tagebuch behalten“ wählen → Plan wird neu
   angeboten, **Tagebuch bleibt**; Einträge aus einem Plan mit Gesundheits-Check zeigen keine Vorgaben mehr.

**Mit Supabase** (Pflicht vor „MVP fertig“, W13): Schritte 2–5 mit echtem Konto; im Flugmodus speichern, Flugmodus
aus → nach wenigen Sekunden verschwindet „wartet auf Übertragung“; zweites Handy zeigt den Eintrag nach dem
Neuladen; dieselbe Einheit auf beiden Handys ändern → Konflikt-Dialog; mit wartendem Training abmelden →
Nachfrage; Widerruf wie Schritt 9.

**Etappe E:** GitHub-App → Actions → **eas-build** → Run workflow (Plattform android, Profil preview, Einreichen:
nein) → nach ca. 15–20 Minuten auf expo.dev die APK öffnen und installieren. iPhone: Workflow mit Plattform ios,
Profil production, **Einreichen: ja** → TestFlight-App.

---

## 10. Abgrenzung zu Phase 4b in einem Satz

Phase 4 **berechnet** das nächste Ziel aus dem Tagebuch und kann nur **steigern**; Phase 4b **ändert den Plan auf
dem Server** (auch nach unten), protokolliert jede Änderung in `plan_adjustments` und ist Premium.

---

## 11. Offene Fragen mit Empfehlung

1. **Sind Trainingseinträge Gesundheitsdaten?** _Empfehlung:_ Nein, mit den Schutzregeln S1–S4 (Abschnitt 3.4;
   Vorgaben aus Gesundheits-Plänen werden beim Widerruf neutralisiert); Herzfrequenz erst Phase 8; Bestätigung und
   Restmuster in der DSFA.
2. **Notizen frei für alle?** _Empfehlung:_ Ja, 280 Zeichen mit festem Hinweis, keine Auswertung, nie in Logs
   (S3). Notizen als Gesundheitsdaten würden eine neue Einwilligungsfassung für alle erzwingen.
3. **Tagebuch auf dem Gerät verschlüsselt? – ENTSCHIEDEN: verschlüsselt** (Gründer, 05.10.2026). Entwurf,
   Tagebuch-Warteschlange und Tagebuch-Zwischenspeicher liegen in der App verschlüsselt (AES-256-GCM, Schlüssel im
   Keychain/Keystore, wie Frage 14 aus Phase 3), im Browser nur in sessionStorage (offline im Browser nur bis
   Tab-Ende, mit Hinweis und `beforeunload`-Warnung). Gelöscht nach erfolgreichem Senden, beim Abmelden (mit
   Nachfrage bei Wartendem), Konto löschen und Testdaten löschen; bei Widerruf/Planwechsel nur bereinigt (S1).
   Ausnahme: Testmodus (`localDb`) bleibt unverschlüsselt. Umsetzung Abschnitt 4.1–4.3.
4. **Progression in den Plan schreiben oder aus dem Tagebuch berechnen?** _Empfehlung:_ berechnen (5.1); keine
   Schreibfunktion auf `planned_exercises` in Phase 4.
5. **Selbst gewähltes anderes Gewicht übernehmen?** _Empfehlung:_ Ja, als neuen Ausgangspunkt (auch leichter –
   das entscheidet die Person, nicht eine Regel); schwerer ohne zusätzlichen Sprung.
6. **Freie Einheiten ohne Plan?** _Empfehlung:_ nicht in Phase 4 (beeinflussen 10-%-Regel und Erholung); Datenmodell
   vorbereitet, kommt mit Strecken (Phase 10) bzw. Wearables (Phase 8).
7. **Schalter „heute zu Hause“ (Phase-3-Frage 7)?** _Empfehlung:_ später; je Übung „Alternative durchgeführt“ deckt
   den Fall ab.
8. **Export schon jetzt?** _Empfehlung:_ Ja, einfacher JSON-Export aller eigenen Daten (CLAUDE.md: Auskunft für alle
   Nutzerdaten); Feinschliff (lesbares Format) in Phase 12.
9. **Pausen-Benachrichtigung im Hintergrund?** _Empfehlung:_ später mit Push (Phase 4b); jetzt Zeitstempel-Timer,
   Vibration und Bildschirm-an.
10. **Apple/Google als Firma oder Privatperson?** _Empfehlung:_ als Firma, sobald es eine gibt (Name im Store passt
    zum Impressum; neue private Google-Konten müssen vor dem Store-Start 14 Tage mit 12 Testern testen). Bis dahin
    reicht für Tests die Android-APK ohne Google-Konto.
11. **Verpasste Einheiten wann streichen?** _Empfehlung:_ erst nach Ende ihrer Woche (`close_missed_sessions`),
    vorher Anzeige „verpasst“ mit Nachholen/Verschieben.

---

## 12. Wie die Phase-3-Vormerkungen gelöst sind

| Vormerkung                                                  | Lösung                                                                                                                                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set_logs.planned_exercise_id` `on delete set null` + Kopie | Verweise in `session_logs`/`exercise_logs` `on delete set null (spalte)` (B2), Schnappschuss 3.3                                                                     |
| Widerruf darf Tagebuch nicht ungewollt löschen              | Einträge bleiben, Vorgaben/Zustand/Varianten-Name aus Gesundheits-Plänen werden neutralisiert; Löschen nur auf ausdrückliche Wahl (S1); pgTAP + Handy-Test Schritt 9 |
| Aufräumen ersetzter Pläne löscht keine Einträge             | gleiche `set null`-Verweise, Test                                                                                                                                    |
| „gestern verpasst → skipped“ per Server-Funktion            | `close_missed_sessions()` nach Wochenende (Präzisierung 3.6 Punkt 3)                                                                                                 |
| `completed` in `planned_session_status`                     | eigene Enum-Migration; gesetzt nur von `save_session_log`                                                                                                            |
| Progressions-Änderungen per `security definer`              | nicht nötig – Progression wird berechnet (5.1); bleibt für 4b reserviert                                                                                             |
| Eigenes Startgewicht                                        | `exercise_start_weights` + `calibration.ts` (5.2)                                                                                                                    |
| Arbeitsgewicht aus erstem Eintrag (Epley + Reserve)         | `estimateWorkingWeight()` beim ersten Eintrag (5.2)                                                                                                                  |
| Progression je Übung über verschieden gekürzte Fassungen    | fassungsunabhängiger Zustand, Sätze je Termin (5.1), Test Mo 20 / Sa 90                                                                                              |
| 10-%-Regel / Gewichtssprung-Puffer, `firstSessionRpeTarget` | unverändert aus `nextLoad()`, Anzeige der ersten Einheit mit RPE −1                                                                                                  |
| `no_heavier_weight`                                         | fester Hinweis „schwerere Gewichtsstufe eintragen oder schwerere Variante wählen“                                                                                    |
| Ausdauer-Bezug ohne `skipped`                               | zusätzlich: nur tatsächlich eingetragene Minuten (5.3)                                                                                                               |

---

## 13. Risiken

1. **Einordnung „kein Gesundheitsdatum“ hält nicht** → Gerätespeicher ist schon verschlüsselt (Frage 3), Vorgaben
   aus Gesundheits-Plänen werden beim Widerruf neutralisiert (S1); bleibt ein Restmuster, ist der nächste Schritt
   „Einträge aus Gesundheits-Plänen beim Widerruf immer löschen“ – betrifft nur `consents_after_revoke()`, nicht das
   Datenmodell.
2. **Falsche Progression macht Gewichte zu schwer** → Sprünge > 10 % nie direkt, vorsichtige Kalibrierung, Deckel
   aus den Sicherheitsregeln wirken zuletzt, Eigenschaftstest, Beispiel-Progression im CI.
3. **Tippfehler** (225 statt 22,5 kg) → Plausibilitäts-Warnung, harte Grenzen, Eintrag änderbar; die Progression
   übernimmt ein Gewicht > 10 % über dem Zustand nur nach ausdrücklicher Bestätigung (W5), sonst normales `nextLoad()`.
4. **Datenverlust offline** → Entwurf bei jedem Tipp gespeichert, nie stilles Verwerfen (eigene Warteschlange,
   Ablehnung → Entwurf), Wiederherstellen nach Absturz. Restrisiko **Browser**: sessionStorage endet mit dem Tab →
   Hinweis und `beforeunload`-Warnung; **Abmelden** mit Wartendem nur nach Nachfrage.
5. **Zwei Geräte / falsche Uhr** → ganze Einheit, Server-Revision entscheidet, bei Abweichung fragt die App (W3);
   die Geräte-Uhr spielt für Konflikte keine Rolle mehr; Neuversuche sind über `write_id` idempotent (R4).
   Dazu **Widerruf mit zweitem Gerät (R3)** → Restrisiko: Ein zweites Gerät, das noch Einträge aus einem Gesundheits-Plan
   in der Warteschlange hat, sendet sie nach dem Widerruf. Sie kommen als `orphaned` an (Plan gelöscht) und werden
   ohne Vorgaben, Zustand und Varianten-Name gespeichert – bei „auch löschen“ also nachträglich wieder ein
   (neutraler) Eintrag. Gegenmittel: Hinweis im Widerrufs-Dialog, Bereinigung beim Laden auf dem zweiten Gerät.
6. **Speicher wächst** → nur 12 Wochen auf dem Gerät, Verlauf online nachladen, Index nach Datum.
7. **Timer ungenau im Hintergrund** → Zeitstempel statt Zähler; keine Benachrichtigung bis 4b (bewusst).
8. **Bildschirm-an kostet Akku** → nur im Trainingsmodus, abschaltbar.
9. **Abgrenzung zu 4b verschwimmt** → Gratis rechnet nur nach oben; einzige Schreibstelle `save_session_log` als
   Andockpunkt; `plan_adjustments` erst 4b.
10. **Konten und Store-Regeln (Kosten, D-U-N-S, Googles 14-Tage-Test, erster manueller Upload)** → früh anlegen
    (Etappe E parallel), Tests zunächst nur APK und interne TestFlight-Gruppe.
11. **iPhone-Schlüssel am Handy einrichten ist fummelig** (.p8-Datei) → bevorzugt Upload direkt auf expo.dev, Weg in
    Etappe E gegen die aktuelle Expo-Doku festgelegt (DoD, W11).
12. **Supabase-Modus noch nicht live erprobt** (offen seit Phase 1) → pgTAP und gemockte Tests; Live-Test mit zwei
    Handys ist **Pflicht** vor „MVP fertig“ (DoD Etappe D, W13).
13. **Inhalte noch fachlich ungeprüft** → Kennzeichnung bleibt; Progressions-Konstanten gehen in die fachliche
    Prüfung (PRODUKTENTSCHEIDUNG markiert).

---

## Umsetzungsstand

**Etappe A – umgesetzt (05.10.2026, Pull Request folgt):** neuer Ordner `packages/core/src/log/`:

- `progression.ts` – `progressFromLogs()` (Zustand aus `state_*`, zwei neueste zählende Einträge, Einstiegswoche als
  Kalibrierungsquelle, Erholungswoche ohne Änderung, Alternative mit eigenem Verlauf, eigenes Gewicht mit
  Bestätigungsregel), `prescriptionForDisplay()`, `buildExerciseLogEntry()`/`stateToStore()` für Etappe C.
- `calibration.ts` (Arbeitsgewicht, eigenes Startgewicht), `plausibility.ts` (`setEntryWarnings()`, absolute
  Schwellen), `cardio.ts` (Pace, km/h, Plausibilität, `loggedEnduranceMinutes()`), `rest-timer.ts`, `summary.ts`
  (`weekLogSummary()`, `historyByWeek()`, `exerciseHistory()`, `canCatchUp()`, `isWithinLogDateWindow()`),
  `schemas.ts` (`sessionLogPayloadSchema` strikt inkl. `write_id`, `base_revision`, `planned_date`;
  `exerciseStartWeightSchema`).
- `plan/loads.ts`: `sessionAchieved()` gegen die Satzzahl der Fassung, W7 in `nextLoad()`, keine Stufe über 500 kg
  (→ `no_heavier_weight` statt „Sprung“ auf dasselbe Gewicht). `plan/schedule.ts`: `enduranceReferenceFromBlock()` und
  `nextPlanBlock()` optional mit eingetragenen Minuten (`loggedEnduranceMinutes`); ohne Angabe Phase-3-Verhalten.
- Neue Konstanten mit Quelle bzw. PRODUKTENTSCHEIDUNG (3.8) und Enums `SESSION_LOG_STATUSES`,
  `EXERCISE_LOG_STATUSES`, `LOG_SOURCES` (Postgres-Abgleich ab Etappe B). `planned_session_status` bekommt `completed`
  erst mit der Migration in Etappe B.
- Tests: alle Fälle aus 5.7 plus Eigenschaftstest über 300 zufällige Folgen mit Ausreißern (unabhängige Erwartungen);
  CI-Zusammenfassung „Beispiel-Progression“ (Anna, Ben, Clara; `packages/content/src/plan-examples.ts`); KONZEPT 4
  „Umsetzung ab Phase 4“ ergänzt.

Festlegungen bei der Umsetzung (Wächter-Prüfung Etappe A eingearbeitet):

1. **Orts-Rundung nur in der Rechnung, nie im Rohwert (Wächter Etappe A, Runden 2–3, B1):** `state_*` bleibt roh und
   wird nie auf ein angezeigtes Gewicht gesenkt; nur ein Gewichtsschritt (`increase_weight`) setzt einen neuen Rohwert.
   Wirksam ist heute W = `snapToAvailableWeight(Rohwert, Stufen am heutigen Ort)` (`ProgressResult.effective`).
   - W = Rohwert: Es zählen nur Einträge, deren angezeigtes Gewicht den Rohwert erreichte; leichtere (z. B. zu Hause)
     werden übersprungen wie eine Erholungswoche → weiter mit dem letzten Stand am vollen Gewicht.
   - W < Rohwert: gerechnet wird mit Basis W und nur den Einträgen mit angezeigtem Gewicht W (dafür speichert jeder
     Eintrag zusätzlich das angezeigte Wdh.-Ziel und den Zusatzsatz: `target_reps`, neu `target_extra_set`). Dieser
     Wdh./Zusatzsatz-Fortschritt gilt nur für diesen Ort und wandert nicht ins Studio. Ein Gewichtsschritt von W
     läuft normal über den Puffer; liegt das neue Gewicht über dem Rohwert, wird es neuer Rohwert (kalibriert 21 →
     angezeigt 20 → mit Puffer 22,5 → Rohwert 22,5; Langhantel 61 → W 60 → 62,5).
   - Beispiele/Tests: Studio → eine verpatzte Einheit zu Hause → Studio zeigt wieder 22,5 mit Studio-Stand; Studio →
     viele Einheiten zu Hause → Studio höchstens 22,5 mit gleichem Wdh.-Stand; Eigenschaftstests „gemessen am
     Gestemmten“ (zufällige Stufen-Raster je Ort, Ortswechsel; am gleichen Ort nie > 10 % über dem schwersten Satz
     der letzten zählenden Einheit, nach Ortswechsel nie > 10 % über dem schwersten je gestemmten Satz bzw. dem
     eigenen Startgewicht – Ausnahmen: geschaffter Puffer, bestätigtes eigenes Gewicht) und „es geht weiter“;
     CI-Beispiel „Dana“.
2. Ein eigenes Gewicht wird gegen das ANGEZEIGTE Gewicht erkannt (Orts-Rundung ist kein eigener Wunsch): schwerer
   über 10 % von max(Zustand, Anzeige) nur mit Bestätigung, deutlich leichter (unter 50 % des Zustands oder unter
   der kleinsten eigenen Stufe, `WEIGHT_CONFIRM_LIMITS.relativeDecrease`) ebenfalls nur mit Bestätigung
   („Absichtlich deutlich leichter?“, Warnung `confirm_lighter`).
3. „Zweimal in Folge“ verlangt zwei zählende Einträge mit **demselben** Zustand (nach +1 Wdh. oder Zusatzsatz beginnt
   die Zählung neu – wie in Phase 3 gegen `state.sets`).
4. Das Ziel-Wdh. wird für die Bewertung auf den Wdh.-Bereich des aktuellen Plans geklemmt; der Zustand bleibt roh.
   Kalibrierung und Startgewicht runden nur auf 0,5 kg, die Stufen des Orts kommen erst in der Anzeige – Punkt 1
   sorgt dafür, dass das trotzdem vorangeht (Eigenschaftstest „es geht weiter“ über 200 zufällige Stufen-Raster).
5. W7 mit nur kurzen Fassungen: +Wdh. bis `reps_max`; über `reps_max` hinaus (Puffer) nur, wenn kein direkter
   Gewichtsschritt ≤ 10 % möglich ist.
6. 5.3 „nie unter den Startumfang“ gilt nur ohne Bezug. Mit eingetragenen Minuten bleibt es bei höchstens +10 % auf
   das tatsächlich Trainierte (wie Phase 3 bei gestrichenen Einheiten); ein Bezug bzw. Deckel je Einheit unter dem
   Einheiten-Minimum (10 min) gilt wie „ohne Bezug“ (sonst fielen alle Einheiten dauerhaft weg).
7. Alternative: Vorgabe (`target_*`) und Zustand der Alternativ-Übung werden gespeichert; die frühere Regel „Alternative
   ohne Vorgabe-Gewicht“ entfällt (Prüfregel R2 = keine Übernahme von der geplanten Übung).
8. `canCatchUp()` nutzt `rescheduleSession()` (früheste erlaubte Tag ab heute muss heute sein, keine Erholungseinheit)
   plus das Datumsfenster.
9. Schema: `exercise_id` höchstens 100 Zeichen; Gewichtsübung mit abgehaktem Satz braucht Wiederholungen.
10. **Wiedereinstieg nach Pause (C1):** `RETURN_AFTER_PAUSE` (28 Tage, ×0,9, RPE −1; Mujika & Padilla 2000,
    PRODUKTENTSCHEIDUNG, fachliche Prüfung) – Anzeige-Regel in `progressFromLogs()` (`returnAfterPause`, braucht
    `options.today`) und `prescriptionForDisplay()`; die Einheit wird mit `is_return` gespeichert und zählt nicht
    (`isCountingEntry`). Wächter-Auflage D1 umgesetzt: Pause = 28 Tage ohne Training an mindestens dem heute
    gezeigten Gewicht W (`effective`, am gerundeten Ort die abgerundete Stufe); Uhr = letzte Wiedereinstiegs-Einheit
    oder letzter zählender Eintrag mit trainiertem Gewicht ≥ W (angezeigt; gestemmt nur als bestätigtes bzw.
    plausibles, einheitliches Gewicht; ohne Anzeige der von der Kalibrierung angenommene schwerste Satz; ohne zählenden Eintrag der neueste
    überhaupt); auch am gerundeten Ort, ×0,9 auf `effective`; `options.today` ist Pflicht.
11. **Für Etappe B vorgemerkt (C3):** neue Spalten `exercise_logs.target_extra_set` (boolean, nullable) und
    `exercise_logs.is_return` (boolean not null default false) in der Migration, in `save_session_log`
    (`assert_json_keys`) und im Feldlisten-Abgleich von `db-sync.test.ts`.

**Für Etappe C festgehalten:** Die 10-%-Warnung im Trainingsmodus vergleicht gegen max(Zustand, angezeigtes Gewicht);
bei einer Alternative ist `stateWeightKg` der Zustand der Alternativ-Übung (deren eigener Verlauf), nie der der
geplanten Übung. Die Leichter-Warnung vergleicht gegen den Zustand und die Stufen des Orts.

**Etappe B – umgesetzt (06.10.2026, Pull Request folgt):** drei Migrationen

- `20261006120000_training_log_enums.sql` – `session_log_status`, `exercise_log_status`, `log_source` und
  `planned_session_status` + `completed` (eigene Datei vor den Funktionen); `PLANNED_SESSION_STATUSES` in `enums.ts`
  ergänzt.
- `20261006120100_training_logs.sql` – Tabellen aus 3.2 mit CHECKs (= `constants.ts`, Abgleich in `db-sync.test.ts`),
  Indizes, RLS auf allen fünf Tabellen (nur eigene Zeilen; Tagebuch nur lesen, Startgewichte direkt mit Profil-Pflicht),
  `on delete set null (spalte)` (B2; dafür `unique (id, user_id)` auf `planned_exercises`), Lese-Regel archivierter
  Übungen aus eigenen Einträgen, Verschiebe-Trigger mit `new.status in ('planned', 'skipped')` (W1).
- `20261006120200_training_log_rpcs.sql` – `save_session_log`, `delete_session_log`, `close_missed_sessions`,
  `recent_exercise_logs`, `export_my_data`, `revoke_health_data`, `private.neutralize_health_plan_logs()`,
  `consents_after_revoke()` (neutralisiert vor **und nach** dem Löschen der Pläne) und `save_training_plan` mit
  Nachtrag H-c; Tageszähler `private.session_log_daily_counts`.
- pgTAP `17_training_logs` (61), `18_training_log_rpcs` (143) und `19_training_log_fresh_connection` (4), Ergänzungen in `04_account_deletion` (Tagebuch und
  Startgewichte) und `06_profile_required`; `database.types.ts` (5 Tabellen, 3 Enums + `completed`, 6 Funktionen);
  `db-sync.test.ts` (Enums, Grenzen, Datumskonstanten, Feldlisten inkl. null-Erlaubnis je Feld, Reihenfolge der
  Migrationen); KONZEPT 5 (Herzfrequenz erst Phase 8) und 12 („Abweichungen ab Phase 4, Etappe B“).

Festlegungen bei der Umsetzung:

1. **„Nie stapeln“ der geplanten Einheiten nur noch für `planned`:** Der Index `planned_sessions_one_per_day_idx` gilt
   jetzt `where status = 'planned'` (vorher `<> 'skipped'`, bei nur zwei Werten gleichbedeutend). Sonst würde eine
   erledigte Einheit ihren Tag dauerhaft belegen: Ein neuer Plan mit einer Einheit am Tag einer heute erledigten
   Einheit des alten Plans wäre nicht speicherbar, und `skipped → completed` (W8) könnte an einer inzwischen dorthin
   verschobenen Einheit scheitern. Das Tagebuch stapelt weiterhin nie (`session_logs_one_per_day_idx`). pgTAP: B
   speichert heute einen neuen Plan, obwohl seine erledigte Einheit heute liegt. **Folge (Wächter B1):** Weil eine
   `completed`-Einheit ihren Tag nicht mehr belegt, setzt `delete_session_log` sie nur auf `planned` zurück, wenn ihr
   Plan aktiv ist, ihre Woche läuft und an `scheduled_on` keine andere geplante Einheit liegt – sonst `skipped`; ein
   `unique_violation` (gleichzeitiges Verschieben) wird ohne Detail gemeldet. pgTAP: (a) andere Einheit auf den
   erledigten Tag verschoben, dann gelöscht; (b) Eintrag → neuer Plan → Eintrag gelöscht → ein weiterer Plan mit
   Einheit an diesem Tag lässt sich speichern.
2. **Feldlisten als Typ-Liste:** `save_session_log` prüft je Ebene genau die Felder **und** ihre JSON-Typen
   (`log_fields`/`exercise_fields`/`set_fields`/`cardio_fields`, z. B. `"number|null"`); alle Felder sind Pflicht (wie
   Zod: nullable, nicht optional). `db-sync.test.ts` gleicht Namen und null-Erlaubnis mit den Zod-Schemas ab.
3. **Server-Wahrheit bei bekannter Einheit:** `is_intro_week`/`is_deload` übernimmt der Server aus der geplanten Einheit,
   das Datumsfenster rechnet mit deren `coalesce(original_date, scheduled_on)`; `planned_date` gilt nur für verwaiste
   Einträge.
4. **Gesundheits-Plan ohne gültige Einwilligung** (z. B. Neu-Einwilligung abgelehnt, Eintrag kommt danach): Der Eintrag
   bleibt mit der Einheit verknüpft (`ok`, Einheit `completed`), wird aber wie beim Widerruf ohne `target_*`/`state_*`,
   mit neutralem Namen und `from_health_plan = false` gespeichert – „Vorgaben aus Gesundheits-Plänen nur mit
   Einwilligung“ gilt damit auch für spät eintreffende Einträge (passt zu H-c und R3).
5. **Ohne `planned_session_id`** (in Phase 4 nur das erneute Senden eines verwaisten Eintrags): wie verwaist ohne
   Vorgaben gespeichert, Antwort `ok`. `orphaned` kommt nur, wenn eine gesendete `planned_session_id` nicht (mehr) zur
   Person gehört – auch beim erneuten Senden derselben `write_id`.
6. **Übungen:** `load_type` muss zur Übung passen; mit `planned_exercise_id` ist `done`/`skipped` genau die geplante
   Übung und `alternative` eine andere; zusätzliche Übungen ohne `planned_exercise_id` sind erlaubt, eine Alternative
   braucht den Verweis. Gewichte (2 Nachkommastellen) und RPE (0,5er-Schritte) werden **vor** der Rundung der Spalten
   geprüft (7,49 wird nicht still zu 7,5).
7. **Vergebene ids:** Ist die vom Gerät erzeugte `id` eines neuen Eintrags (oder einer Übung) schon vergeben (fremde
   Zeile), vergibt der Server eine neue und gibt sie zurück – ohne unterscheidbare Meldung (wie H-a). Die Einheit steht
   in `id`; neu vergebene Übungs-ids stehen nur dann in `exercise_ids` (`{"<id vom Gerät>": "<gespeicherte id>"}`), wenn
   es welche gibt (Wächter S5). Doppelte Übungs-ids oder dieselbe `planned_exercise_id` zweimal in einer Einheit lehnt
   der Server ab (wie Zod, K5).
8. **Antworten:** neuer Eintrag mit `base_revision` ohne gespeicherte Zeile → `{"result": "conflict", "id": null,
"revision": null}` (anderswo gelöscht). `delete_session_log` meldet für einen nicht (mehr) vorhandenen bzw. fremden
   Eintrag `ok` (idempotent, nichts Unterscheidbares). Datumsfenster: eigene Meldung „Das Datum liegt außerhalb des
   erlaubten Zeitraums.“ (22023), Tageslimit „Heute wurden schon zu viele Trainings gespeichert.“ (54000); alle übrigen
   Fehler der Klassen 22 und 23 „Ungültige Werte im Tagebuch.“ mit dem ursprünglichen Code, ohne Detail (Wächter S1).
   **Reihenfolge (S3):** Die Idempotenz (gleiche `write_id` → `ok`) und `conflict` kommen **vor** Art- und
   Datumsprüfung – eine verlorene Antwort bleibt auch nach Ablauf des 14-Tage-Fensters `ok`.
   **Tageslimit (K1):** gezählt werden Erstellungen je Person und Tag in `private.session_log_daily_counts` (auch später
   gelöschte; die Zählerzeile serialisiert gleichzeitige Aufrufe); Ändern bestehender Einträge zählt nicht. Der Zähler
   enthält keinen Tagebuch-Inhalt, ist nicht über die API lesbar, nicht im Export und wird mit dem Konto gelöscht.
   **Zeitformate (K2):** Datum nur `JJJJ-MM-TT`, Zeitstempel nur ISO mit Zeitzone (`Z` oder `±hh:mm`) wie Zod – kein
   `infinity`/`epoch`, keine Zeit ohne Zone.
9. **`recent_exercise_logs()`** liefert `{session_logs, exercise_logs, set_logs}` in Tabellenform (direkt in `UserRows`
   übernehmbar); „zählend“ wie `isCountingEntry()` (ohne Erholungs-, Einstiegswoche und Wiedereinstieg `is_return`);
   `p_per_exercise` wird auf 1–10 begrenzt.
10. **`export_my_data()`** liefert `{format_version, exported_at, user_id, data: {<tabelle>: [...]}}`; enthält auch
    `admin_users` (Fremdschlüssel auf `auth.users`). pgTAP prüft zusätzlich jede `public`-Tabelle mit Spalte `user_id`
    (K3). **Bewusst nicht im Export:** die Konto-E-Mail aus `auth.users` (ergänzt die App, 3.7) und `waitlist` (nur
    E-Mail ohne Verknüpfung zum Konto, eigene Auskunft per E-Mail) – in Datenschutzerklärung/Auskunft erwähnen (Phase 12).
11. **Neutralisieren** ändert die `revision` nicht (die Geräte bereinigen selbst, 3.4 S1; eine danach gesendete Fassung
    eines gelöschten Gesundheits-Plans kommt als `orphaned` ohne Vorgaben an, pgTAP). `revoke_health_data()`
    neutralisiert auch, wenn keine aktive Einwilligung mehr bestand.
12. **Gleichzeitiges Speichern während des Widerrufs (Wächter B2, S2):** `consents_after_revoke()` neutralisiert ein
    zweites Mal **nach** dem Löschen der Pläne – das Löschen wartet auf die Sperre eines laufenden `save_session_log`,
    dessen Eintrag erst danach sichtbar ist. `revoke_health_data()` sperrt vor dem Löschen (`p_delete_logs`) die
    Einheiten der Gesundheits-Pläne (`for update`), damit ein gleichzeitig gespeicherter Eintrag mitgelöscht wird.
    pgTAP stellt den Ablauf per Trigger nach; die Race-Probe des Wächters mit zwei Verbindungen (direkter Widerruf,
    `revoke_health_data(false)` und `(true)`) ergibt jeweils einen neutralen bzw. gelöschten Eintrag.
13. **Robustheit (Wächter Runde 2, N1/N2):** Record-Variablen (`planned`, `session`) werden nur innerhalb eines
    eigenen `if linked then`/`if session_found then` gelesen – PL/pgSQL wertet `and` nicht verkürzt aus, sonst je nach
    Verbindung Fehler 55000 (`db-sync.test.ts` prüft das Muster; pgTAP `19_training_log_fresh_connection` ruft
    `save_session_log` ohne `planned_session_id` als ersten Aufruf einer frischen Verbindung auf). Sperr-Reihenfolge
    überall erst Einheit, dann Eintrag: `delete_session_log` liest den Verweis ohne Sperre, sperrt die Einheit, dann
    den Eintrag und prüft `revision` erneut; `revoke_health_data` sperrt die Einheiten `order by id` (keine Deadlocks,
    Probe d1/d2: gleichzeitiges Ändern und Löschen ergibt `conflict` statt `40P01`).
14. **Neutralisierte Einträge (K4):** Nach einem Widerruf „Tagebuch behalten“ oder H-c steht `from_health_plan = false`
    – ein späteres „auch löschen“ trifft diese Einträge nicht mehr (das Kennzeichen ist die einzige Quelle). Gehört in
    den Widerrufs-Dialog (Etappe C: Hinweis „Einträge aus früheren Widerrufen sind schon ohne Vorgaben und werden nicht
    mehr erkannt“) und in die DSFA.

**Für Etappe C festgehalten (aus Etappe B):** Die App ruft für den Widerruf `health_data` künftig
`revoke_health_data(p_delete_logs)` statt `update consents`; `apps/mobile/src/data/backend.ts`
(`status: 'planned' | 'skipped'`) kennt `completed` noch nicht; die Wiedereinstiegs-Uhr rechnet mit dem
Tagebuch-Zwischenspeicher (12 Wochen) – `recent_exercise_logs()` liefert je Übung nur die Progressions-Grundlage.
**Pflichtpunkt Etappe C (Wächter S4):** In der Datenbank belegt eine `completed`-Einheit ihren Tag nicht mehr
(Festlegung 1). `packages/core/src/plan/reschedule.ts`, `plan/view.ts` (`sessionOn()` liefert bei `completed` und
`planned` am selben Tag nur die erste) und `apps/mobile/src/data/local-rules.ts` behandeln „belegt“ noch als
`status !== 'skipped'`. Entscheidung in Etappe C: Der Client darf konservativ bleiben (erledigte Tage gelten als
belegt, Verschieben dorthin bietet die App nicht an) – dann den Unterschied dokumentieren und `sessionOn()` für zwei
Einheiten an einem Tag (erledigt + geplant aus einem neuen Plan) korrekt machen; Test in Etappe C.

Wächter-Prüfung Etappe B: freigegeben mit Auflagen; B1, B2, S1–S3, S5, S6, K1–K3, K5 umgesetzt, S4 und K4 als
Pflichtpunkte Etappe C festgehalten (in C1 erledigt, siehe unten).

**Etappe C – geteilt in C1 und C2 (06.10.2026).** Der Plan sieht die Teilung ausdrücklich vor („C1 Kraft, C2
Ausdauer + Pausentimer“). **C1 ist umgesetzt** (Pull Request folgt): die gesamte Offline-/Sync-Grundlage für ALLE
Einträge plus der Trainingsmodus für Kraft. **C2** bringt Ausdauer-Eintrag (6.1 Punkt 3, Pace/km/h live,
Gesprächstest), Pausentimer-Leiste (5.5, Vibration `expo-haptics`, Bildschirmleser-Ansage), Bildschirm-an
(`expo-keep-awake`/Wake-Lock, Schalter in den Einstellungen) und die E2E-Abläufe „Ausdauer mit Pace“. Bis dahin zeigt
„Heute“ an Ausdauer-Tagen „Ausdauer eintragen kommt mit dem nächsten Update.“ (in C2 ersetzt) – das Datenmodell (`cardio`, Status
`completed` für Ausdauer) ist in C1 schon durchgängig vorhanden.

Umgesetzt in C1:

- **Core** (`packages/core/src/log/workout.ts`, Tests `workout.test.ts`): `planWorkout()`/`planWorkoutExercise()`
  (Progression zuerst, dann `rules.rpeMax`; Vorgabe, `state_*` über `stateToStore()`, Hinweis NUR über
  `progressHintForDisplay()`), `referenceDosage()` (Vorlagen-Satzzahl/RPE der Belastungswoche, W7),
  `weightStepsFor()` (Stufen nur zu Hause), `extraSetAllowed()` (V9 gegen `WEEKLY_SETS_PER_MUSCLE` der Vorlage),
  `allowedAlternatives()` (Regeln wie `findSubstitute()`, plus die vorgeschlagene schwerere Variante),
  `alignShownExercises()` (ausgeblendete Übungen), `initialSets()`, `adjustWeight()`/`adjustReps()`,
  `rpeFromReserve()`/`reserveFromRpe()`, `exerciseLogStatusFor()` (Sicherheits-Ersatz zählt als `alternative`, wie der
  Server es verlangt), `sessionLogStatus()`, `neutralSessionName()`/`neutralizeSessionLogPayload()` (S1).
- **Wächter S4 (Pflichtpunkt) – Entscheidung:** Der Client bleibt beim **Verschieben konservativ**
  (`rescheduleSession()`: eine erledigte Einheit belegt ihren Tag, die App verschiebt nie dorthin – dokumentiert im
  Typ, Test). `sessionOn()` liefert bei erledigter + geplanter Einheit am selben Tag die **offene** (neu
  `completedOn()`), Test. `local-rules.ts` `noCollisions()` folgt der Datenbank (nur `planned` belegt), sonst wäre ein
  neuer Plan am Tag eines erledigten Trainings im Testmodus nicht speicherbar (Test). Zusätzlich bietet „Heute“ kein
  zweites Training an, wenn am Tag schon eine andere geplante Einheit eingetragen ist (`startKind()`, „nie stapeln“).
- **Speicher (4.1):** drei weitere geschützte Speicher (`STORAGE_KEYS.workoutDraft/logQueue/logCache` + je eigener
  Schlüssel, `PROTECTED_STORE_KEYS`, `createDeviceProtectedStores()` für App/Browser). `DraftStore`
  (`draft-store.ts`), `LogQueue` (`log-queue.ts`), Tagebuch-Zwischenspeicher im Supabase-Backend. `cacheableRows()` gibt
  das Tagebuch getrennt zurück (`logs`), nie im `rowsCache`. Leeren bei Abmelden/Konto löschen/Testdaten löschen,
  NICHT bei Widerruf (nur bereinigen).
- **LogQueue (4.3):** Schlüssel `save_session_log:<planned_session_id>`, Ersetzen behält die `base_revision`, gleiche
  `write_id` bei Neuversuch, Netz/401 = später (Meldung „Bitte melde dich erneut an“), Konflikt/Ablehnung → Entwurf
  VOR dem Entfernen, `orphaned` → Meldung, Konto-Bindung, Sperre + Bereinigung vor dem Widerruf, neuere Fassung
  während des Sendens baut auf der bestätigten Revision auf. Sende-Reihenfolge `SyncQueue` → `LogQueue` →
  `close_missed_sessions()`; vor `save_training_plan` wird die `LogQueue` gesendet (H-b); liegen Einträge aus
  Gesundheits-Plänen in der Warteschlange, prüft die App vorher `has_valid_consent('health_data')` und neutralisiert
  (anderes Gerät, R3).
- **Konto-Bindung (R5):** `owner_user_id` in Entwurf, `LogQueue`, `logCache` und – neu – der normalen `SyncQueue`
  (altes Listenformat wird weiter gelesen); fremdes Konto → nichts gesendet, „Heute“ fragt „…löschen?“.
- **Supabase-Backend:** RPCs `save_session_log`, `delete_session_log` (nur online, Fehler `online_only`),
  `recent_exercise_logs`, `close_missed_sessions`, `revoke_health_data` (statt `update consents` für health_data),
  Startgewicht direkt per PostgREST (`set_exercise_start_weight` über die normale `SyncQueue`, Schlüssel je Übung).
  Laden: 12 Wochen Tagebuch (`in`-Filter in Paketen) + `recent_exercise_logs()`, wartende Trainings werden für die
  Anzeige darübergelegt (nie in den Zwischenspeicher).
- **Testmodus:** `checkSessionLog()` (`local-rules.ts`) mit denselben Regeln und derselben Reihenfolge wie
  `save_session_log` (Zod, Idempotenz/Konflikt vor Art und Datum, W2, Tageslimit, nie stapeln, Übungen und
  `alternative`, verwaist, `skipped → completed`, Gesundheits-Plan ohne Einwilligung neutral); `log-rows.ts` bildet
  Eintrag ⇄ Zeilen ab (Löschen wie `delete_session_log`, `on delete set null`, `close_missed_sessions` beim Laden,
  Neutralisieren/Löschen beim Widerruf, H-c bei `save_training_plan` ohne gültige Einwilligung).
- **App:** `app/workout/[sessionId].tsx` (Satz-Zeilen mit −/+ und Ansage, großer Haken, Gewicht gilt für folgende
  offene Sätze, „Wiederholungen in Reserve“ 0–5+, „Nicht gemacht“ ohne Grund, Alternative, eigenes Startgewicht mit
  Bestätigung über der Schwelle, Gewichts-Bestätigung W5, „Tippfehler?“, Belastung 0–10 als `adjustable`-Regler mit
  Pfeiltasten, Notiz mit Hinweis S3 und Code-Point-Zähler, Verwerfen mit Nachfrage, Ändern eines Eintrags ohne
  Übungstausch); „Heute“: berechnetes Ziel in der Einheit („3 × 10 Wiederholungen mit 22,5 kg je Hantel“),
  „Training starten“/„Heute nachholen“ (`canCatchUp()`), „✓ Erledigt“ + „Ansehen/Ändern“, Entwurf gefunden
  (Fortsetzen/Speichern/Verwerfen), Konflikt (Meine Fassung behalten / Andere übernehmen), abgelehnt, „wird
  übertragen“; Browser: Tab-Hinweis und `beforeunload` solange Entwurf oder Wartendes; Einstellungen: Widerrufs-Dialog
  mit Wahl „Tagebuch behalten (empfohlen)“ / „auch löschen“ und den Hinweisen H6, R3 und **K4**; Abmelden mit
  Nachfrage (R6, „Jetzt senden“ → Rest → erneut fragen).
- **Tests:** Vitest `log-queue.test.ts`, `workout.test.ts` (Testmodus-Ablauf, `checkSessionLog`, Widerruf,
  Speicher), `log-rows.test.ts`, Ergänzungen in `supabase-backend.test.ts` (W8-Reihenfolge, H-b, R3, R5, 401,
  Konflikt/Ablehnung/orphaned, logCache offline, Löschen nur online), `protected-store.test.ts`,
  `sync-queue.test.ts`, `workout-format.test.ts` (Pflichtpunkt `harder_variant` nur mit Variantenname); Playwright
  `e2e/workout.spec.ts` mit festem Datum (Kraft-Einheit komplett mit Alternative und „nicht gemacht“, Progression nach
  zwei Einheiten sichtbar, Entwurf nach Neu laden, `beforeunload`, Abmelde-Nachfrage, offline eintragen, Widerruf
  behält das Tagebuch ohne Vorgaben); Bildschirmfotos `training-*` und `heute-erledigt` (hell/dunkel).

Festlegungen bei der Umsetzung von C1:

1. Ein neuer Entwurf wird erst beim ersten Tipp gespeichert (Hineinschauen hinterlässt nichts); nach Neu laden auf dem
   Trainingsbildschirm geht es direkt weiter, „Heute“ zeigt „Fortsetzen / Speichern / Verwerfen“.
2. Beim **Ändern** eines gespeicherten Eintrags bleibt der Schnappschuss der Vorgabe (was damals gezeigt wurde);
   Übungen sind dann nicht tauschbar. Nach einer Neutralisierung (Widerruf) gilt dasselbe für offene Entwürfe.
3. Ein beim Speichern als nicht bestätigt erkanntes Gewicht über den Warnschwellen blockiert das Speichern mit Hinweis
   – die Person bestätigt („Ja, stimmt so“) oder korrigiert.
4. Im Testmodus wird `close_missed_sessions` beim Laden nachgebildet (Gleichstand mit dem Server).
5. Die Bestätigung eines gespeicherten Startgewichts gilt als erteilt (die App speichert es erst nach der Nachfrage).

Offen für C2/D: Ausdauer + Pausentimer + Bildschirm-an (C2); Woche, Verlauf, Löschen-UI, Export (D); Live-Test mit
Supabase (W13, D).

**Wächter-Prüfung C1: mit Auflagen – eingearbeitet (06.10.2026):**

- **B1 (blockierend):** `createEncryptedProtectedStore` führt `read`/`write`/`clear` je Speicher über eine
  Promise-Kette nacheinander aus; ein Generationszähler verhindert, dass ein Schlüssel von vor `clear()` weiterverwendet
  wird; der gemerkte Schlüssel wird erst NACH `secrets.remove` vergessen. `LogQueue`/`DraftStore` schreiben ihren Stand
  über eine eigene Kette in Auftragsreihenfolge (Momentaufnahme beim Auslösen), gleichzeitiges erstes Laden überschreibt
  keinen inzwischen geänderten Stand. `saveDraft` im Trainingsmodus meldet Fehler („Zwischenstand konnte nicht gesichert
  werden“). Vitest „gleichzeitig clear() und write() → neue Instanz liest die Daten“; die Wächter-Skripte `race.ts`/
  `race2.ts` liefern jetzt die Daten nach dem Neustart.
- **S1:** `classifyLogError()`/`isTransientError()`: PGRST301–303 bzw. „JWT expired“, 401, 42501, 429, PGRST000–003,
  Klassen 08/53/57 (u. a. 57014), 40001/40P01, ≥ 500 und unlesbare Antworten = später erneut (der HTTP-Status wird an den
  PostgREST-Fehler angehängt). Tests mit echten Fehlerformen.
- **S2:** In Zwischenspeicher kommt nur Bestätigtes: `writeCache(…, 'server')` merkt sich den bestätigten Stand; Aufrufe
  mit Anzeige-Zeilen entfernen die Überlagerung wartender Trainings (Tagebuch und `completed`). Test.
- **S3:** `cleanHealthIfConsentInvalid()` prüft beim Laden/Senden und nach `save_training_plan` (H-c) Warteschlange UND
  Entwürfe; bei ungültiger Einwilligung werden beide neutralisiert. Test.
- **S4:** Sende-Ereignisse tragen Schlüssel und `write_id`; „Training speichern“ wertet nur das eigene Ergebnis. Test
  mit zwei wartenden Fassungen.
- **S5 → Pflicht-Prüfpunkte für den Live-Test W13 (Etappe D):** App offline mit wartendem Training und offenem Entwurf
  hart beenden und neu starten (Warteschlange und Entwurf sind noch da und werden übertragen); Sitzung/Token ablaufen
  lassen, während ein Training wartet (bleibt wartend, Hinweis „erneut anmelden“, nach Anmeldung übertragen); Konflikt
  und Ablehnung auf echtem Server; Browser im privaten Fenster (Hinweis „Offline-Speicher nicht verfügbar“).
- **K1:** Testmodus zählt Erstellungen je Tag in `localDb.logCounter` (auch gelöschte), wie der Server.
  **K2:** Testmodus vergibt bei schon vergebener Eintrags- bzw. Übungs-id eine neue (Festlegung 7).
  **K4:** „Heute“ erklärt „Heute ist schon ein Training eingetragen …“. **K5:** Text „noch nicht übertragen“, im Browser
  mit Tab-Hinweis. **K6:** „Gewicht eingeben“ je Übung (gilt für den ersten offenen und alle folgenden Sätze).
  **K7:** Halteübung abhaken ohne Dauer → Vorgabe bzw. 5 s. **K9:** sessionStorage für Entwurf und Warteschlange im
  strikten Modus – ein gescheitertes Schreiben wird gemeldet; „Training speichern“ sendet die Fassung dann sofort aus
  dem Arbeitsspeicher, gelingt das nicht: „Offline-Speicher nicht verfügbar – bitte mit Verbindung speichern“.
- **K3 (dokumentiert, Abweichung):** `checkSessionLog()` prüft das vollständige Zod-Schema VOR der Idempotenz; der
  Server prüft vorher nur Felder und Formate, Übungen/Sätze danach. Ohne Wirkung bei unveränderter Fassung (die App sendet
  bei Neuversuchen dieselbe gültige Fassung).
- **K8 (dokumentiert):** Ging die Antwort auf eine Fassung verloren und wird die wartende Einheit vorher noch einmal
  geändert, behält die neue Fassung die alte `base_revision` → Konflikt mit der eigenen Fassung; „Meine Fassung
  behalten“ löst ihn, nichts geht verloren.
- `completedOn()` (core) ist für Woche/Verlauf (Etappe D) vorgesehen; „Heute“ nutzt den Hinweis aus K4.
- **CI:** `pnpm check` läuft mit `turbo … --continue` (alle Fehler eines Laufs sichtbar, nicht langsamer). Ein
  JUnit-Bericht als Artefakt wird erst ergänzt, falls der einmal beobachtete core-Testfehler erneut auftritt (der Wächter
  konnte ihn in 18 Läufen nicht nachstellen).

**Nachprüfung C1 (Runde 2): freigegeben (06.10.2026).** Offen für C2/D:

- **N1 (soll, Pflicht C2/D):** Ein Eintrag, der dauerhaft mit einem als vorübergehend eingestuften Fehler scheitert
  (z. B. „Profil fehlt“ als 42501, ein nur von diesem Eintrag ausgelöster Serverfehler, dauerhaft unlesbare Antworten),
  bleibt vorne in der Warteschlange; spätere Trainings und `close_missed_sessions` hängen dahinter. Lösung: Fehlversuche
  je Eintrag zählen, bei Nicht-Netzfehlern mit dem nächsten Eintrag weitermachen, nach ~5 Versuchen bzw. 24 h Meldung
  zeigen und den Eintrag als abgelehnten Entwurf sichern (nie verwerfen); 42501 „Nicht angemeldet“ → „Bitte erneut
  anmelden“.
- **N2 (kann):** Im K9-Fall bleibt nach späterer Übertragung der Entwurf stehen („Entwurf gefunden“ für ein gespeichertes
  Training; erneutes Speichern → Konflikt, kein Verlust).
- **N3 (kann):** Test für K9 mit einem sessionStorage, der beim Schreiben wirft.
- **N4 (kann):** „jwt“ im Fehlertext gilt pauschal als vorübergehend – enger auf Fehlercodes fassen.

**C2 umgesetzt (06.10.2026, Pull Request folgt):** Ausdauer-Eintrag, Pausentimer, Bildschirm-an und N1–N4.

- **Core:** `log/cardio.ts` ergänzt um `cardioSpeedKind()`/`cardioSpeed()` (Laufen/Gehen Pace je km + km/h, Rad km/h,
  Schwimmen Pace je 100 m; zu schnell → nur Warnung), `splitDuration()`, `cardioDurationS()`, `cardioLogFromInput()`
  (Dauer Pflicht 1 min–12 h, Distanz 0–500 km mit 0 = ohne Distanz, Höhenmeter 0–10 000 – Grenzen = `CARDIO_LOG_LIMITS`
  = Schema = Datenbank; Fehler je Feld), `talkTestLevel()` mit neuer Konstante `TALK_TEST_BANDS` (Quellen Foster 2008,
  Reed & Pipe 2014; „ganze Sätze“ bis `ENDURANCE_EFFORT.easyMax`). `log/rest-timer.ts` ergänzt um
  `nextSetExercise()`/`restAfterCheckedSet()` (Reihenfolge der Sätze im Trainingsmodus: Supersätze in Runden, „nicht
  gemacht“ zählt nicht, nach dem letzten Satz keine Pause). Tests mit Grenzfällen.
- **App – Ausdauer:** „Heute“ bietet an Ausdauer-Tagen „Ausdauer eintragen“ bzw. „Ausdauer heute nachholen“
  (`startKind()` gilt jetzt für beide Arten, ohne Übungs-Bibliothek); der Hinweis „kommt mit dem nächsten Update“ ist
  entfernt. Trainingsmodus-Ansicht Ausdauer: tatsächliche Art, Dauer (Std/Min, vorbelegt aus der geplanten Einheit),
  Distanz in km mit Komma, Höhenmeter, Pace bzw. km/h live (Bildschirmleser mit ausgeschriebenen Einheiten,
  `aria-live`), „Bitte prüfen“ bei unplausibler Geschwindigkeit, Anstrengung 0–10 mit Gesprächstest-Erklärung
  (`session_rpe`). Der Entwurf speichert die Eingabe als Text (`WorkoutDraft.cardio`, verschlüsselt wie C1; Entwürfe
  aus C1 ohne das Feld bleiben lesbar); gesendet wird über `save_session_log` mit `cardio`-Teil, im Testmodus über
  `checkSessionLog()`. Ansehen/Ändern liest den gespeicherten Ausdauer-Eintrag.
- **App – Pausentimer:** Leiste unten (`RestTimerBar`): Restzeit groß, −15 s / +15 s / Überspringen; startet beim
  Abhaken eines Satzes mit der Pause aus `restAfterCheckedSet()`, endet beim Zurücknehmen des Hakens; beim Ändern
  eines gespeicherten Trainings keine Pause. Ende: Vibration über `expo-haptics` (nur App) und
  `announceForAccessibility` (App), sichtbarer Hinweis „Pause vorbei“ mit `aria-live` (Browser). Rechnung nur mit
  Zeitstempeln (`useRestTimer`).
- **App – Bildschirm an:** `useScreenAwake()` (expo-keep-awake, im Browser Wake-Lock; nach Tab-Wechsel erneut
  angefordert) solange der Trainingsmodus offen ist; Schalter „Bildschirm im Training anlassen“ in den Einstellungen
  (Standard an, gespeichert nur auf dem Gerät unter `fitnessapp.keep-awake.v1`, keine Nutzerdaten).
- **Pakete:** `expo-haptics ~57.0.3`, `expo-keep-awake ~57.0.2` (SDK 57, `expo install` offline; Lockfile nur um die
  zwei Einträge ergänzt). Laufen in Expo Go und im EAS-Build.
- **N1:** `LogQueue` zählt Fehlversuche je Eintrag (`attempts`, `firstFailedAt`, `nextAttemptAt` – gespeichert):
  `classifyLogError()` unterscheidet `retry` (Netz, Sitzung inkl. 42501 „Nicht angemeldet.“ → „Bitte melde dich erneut
  an“, 429, Datenbank/Gateway nicht erreichbar – Senden anhalten, nichts zählen) und `transient` (z. B. 42501 „Profil
  fehlt“, 500, 57014, 40001, unlesbare Antwort – zählen, mit dem nächsten Eintrag weitermachen, Wartezeit 1 min / 5 min
  / 30 min / 2 h). Nach `LOG_QUEUE_RETRY.maxAttempts` = 5 Versuchen bzw. 24 h ab dem ersten Fehlversuch: als
  abgelehnter Entwurf gesichert (Grund `not_transferred`, Meldung auf „Heute“), nie verworfen. `close_missed_sessions`
  läuft auch, wenn nur solche Einträge warten (Ergebnis `blocked`; skipped → completed bleibt erlaubt).
- **N2:** Nach der Übertragung einer Fassung wird ihr unveränderter Entwurf entfernt (K9-Fall); ein danach geänderter
  Entwurf bleibt. **N3:** Test mit sessionStorage, der beim Schreiben wirft (online gesendet; offline Meldung, Entwurf
  bleibt und verschwindet nach der Übertragung). **N4:** „jwt“ im Fehlertext allein gilt nicht mehr als
  vorübergehend (nur feste Codes bzw. „JWT expired“).
- **Tests:** Vitest `cardio.test.ts`, `rest-timer.test.ts` (core), `log-queue.test.ts` (N1), `supabase-backend.test.ts`
  (Einordnung, N1–N4), `workout.test.ts` (Ausdauer im Testmodus), `workout-format.test.ts`; Playwright
  `e2e/workout.spec.ts` „Ausdauer mit Pace“ und „Pausentimer … Bildschirm-an-Schalter“; Bildschirmfotos
  `ausdauer-eintrag`, `ausdauer-abschluss`, `training-satz-pause`.

**Wächter-Prüfung C2: freigegeben – eingearbeitet (06.10.2026):**

- **S1:** Pausenende im Browser über eine DAUERHAFT vorhandene, unsichtbare Live-Region (`RestAnnouncer`, nur der
  Text wird gesetzt); E2E prüft, dass sie vor dem Pausenende leer im DOM steht.
- **K2:** Wake-Lock: keine zweite Anfrage, solange eine läuft (sonst bliebe eine Sperre unfreigegeben).
- **K3:** Die Dauer-Fehlermeldung ist den Feldern Stunden und Minuten zugeordnet (Browser `aria-describedby`, App
  Hinweis des Feldes); E2E prüft die Zuordnung.
- **K4:** Meldung `not_transferred` bittet um baldiges erneutes Speichern (Einträge nur bis 14 Tage nach dem
  Training, W2).
- **K1 (bekannte Grenze):** In der App kommt das Pausenende-Signal (Vibration, Ansage) nicht, solange die App im
  Hintergrund ist – erst beim Zurückkehren. Vertretbar, weil der Bildschirm im Training an bleibt; eine lokale
  Benachrichtigung ist ggf. eine spätere Phase.
- **K5 (bekannte Grenze):** Weil N1 einen hängenden Eintrag überspringt, kann eine später gemachte Einheit vor einer
  früheren ankommen. Liegen beide am selben Tag, bekommt die frühere `day_taken` und bleibt als Entwurf erhalten –
  kein Verlust.

Offen für D: Woche, Verlauf, Löschen-UI, Export; Live-Test mit Supabase (W13) inkl. der Prüfpunkte aus S5 sowie
Pausentimer-Vibration und Bildschirm-an auf echten Geräten (Android/iPhone).

## Wächter-Prüfung (Runde 1) – wie die Befunde gelöst sind

| Befund                                                | Lösung                                                                                                                                                                                                                                                                           | Abschnitt                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| B1 Vorgaben-Schnappschuss verrät Gesundheits-Flags    | `from_health_plan` (nur Server); Widerruf neutralisiert `target_*`, `state_*`, `name_de`; Dialog „behalten / auch löschen“ (ab Runde 2 über `revoke_health_data`, R3); gleiche Logik im Testmodus, Entwurf, Warteschlange; Restmuster in DSFA; pgTAP; „nicht gemacht“ ohne Grund | 3.3, 3.4 (S1, S3), 3.6 Punkt 6, 3.7, 6.1, 8 B/C                  |
| B2 `on delete set null` leert `user_id`               | `on delete set null (planned_session_id)` bzw. `(planned_exercise_id)` (PG 17); pgTAP                                                                                                                                                                                            | 3.2, 12                                                          |
| B3 Frage 3 verschlüsselt umsetzen                     | drei eigene `ProtectedStore`-Instanzen mit eigenen `STORAGE_KEYS`; eigene `LogQueue` statt `isDirectOp`; Sende-Reihenfolge; Leeren/Bereinigen-Regeln; Abmelde-Nachfrage; Web-Hinweis + `beforeunload`; Handy-Test und Playwright „Neu laden“; Testmodus-Ausnahme                 | 3.4 (S4), 4.1–4.3, 4.6, 6.1, 6.3, 8 C, 9, 11 Frage 3, 13, Status |
| B4 verwaiste Einträge                                 | `save_session_log` speichert mit `planned_session_id = null`, Vorgaben leer, neutraler Name, `{result:"orphaned"}`; App-Meldung; `local-rules.ts` + Test                                                                                                                         | 3.6 Punkt 1, 4.3, 6.3                                            |
| W1 `planned → completed` per PostgREST                | Trigger erzwingt für `authenticated` `new.status in ('planned','skipped')`; pgTAP; 3.1 richtiggestellt                                                                                                                                                                           | 3.1, 8 B                                                         |
| W2 Datumsfenster                                      | gleiche ISO-Woche ± 1 Tag, ≤ heute + 1, ≥ heute − 14; gleich in `canCatchUp()` und `local-rules.ts`                                                                                                                                                                              | 3.6, 5.6, 5.7                                                    |
| W3 Konflikte über Zeitstempel                         | `revision`/`base_revision`, `conflict` mit Wahl, Entwurf behalten, Zeit auf `now()` gekappt, bestehende `id`                                                                                                                                                                     | 3.2, 3.6, 4.3, 4.4, 6.3, 13                                      |
| W4 Zustand aus Anzeige-Schnappschuss                  | `state_*`-Spalten; `recent_exercise_logs` ohne Erholungs-/Einstiegswoche + neuester; Tests Studio→Zuhause→Studio, zwei Erholungs-Einheiten                                                                                                                                       | 3.2, 3.3, 3.6 Punkt 4, 5.1, 5.7                                  |
| W5 Tippfehler treibt Progression                      | > 10 % nur nach Bestätigung (`weight_confirmed`); absolute Schwellen `WEIGHT_CONFIRM_LIMITS`; Eigenschaftstest mit Ausreißern                                                                                                                                                    | 3.2, 3.8, 5.1, 5.2, 5.4, 5.7, 13                                 |
| W6 Alternative                                        | Vorgabe-Gewicht und Zustand leer, eigener Verlauf, Kalibrierung, `load_type` der gemachten Übung; Test                                                                                                                                                                           | 3.2, 5.1, 5.7                                                    |
| W7 Gewichtssprung aus kurzen Fassungen                | Sprung nur, wenn eine der zwei Einheiten volle Vorlagen-Satzzahl hat; +Wdh. immer; Test Mo 20 / Sa 90 erweitert                                                                                                                                                                  | 5.1, 5.7                                                         |
| W8 Reihenfolge, `skipped → completed`, Ablehnung, 401 | Queues vor `close_missed_sessions`; `skipped → completed` erlaubt; `onDropped` sichert vor Entfernen; 401 = später                                                                                                                                                               | 3.6, 4.3, 8 C                                                    |
| W9 Export unvollständig                               | pgTAP-Abgleich aller Tabellen mit `user_id`; E-Mail aus `auth.getUser()`; Einwilligungs-Verlauf; Hinweis; Zwischen-Datei löschen                                                                                                                                                 | 3.7, 6.1, 8 B/D                                                  |
| W10 Fehler-Codes                                      | weitere SQLSTATEs abgefangen; Notizlänge in Code-Points; Test ohne Inhalte                                                                                                                                                                                                       | 3.6                                                              |
| W11 iOS terminalfrei                                  | .p8-Upload auf expo.dev bevorzugt, Alternative Workflow mit `umask 077`; DoD Etappe E; Dateien-App-Schritt ersetzt                                                                                                                                                               | 7.2 Punkt 4, 7.3, 8 E, 13                                        |
| W12 EAS-Workflow                                      | ios + preview abgefangen; Einreichen nur production; APK nicht einreichbar; `releaseStatus "draft"`; `environment` je Profil; `EXPO_PUBLIC_*` nicht „Secret“                                                                                                                     | 7.2, 8 E                                                         |
| W13 Live-Test                                         | zwei Handys, Flugmodus, Konflikt, Widerruf, Abmelden – Bedingung „MVP fertig“                                                                                                                                                                                                    | 8 D, 9, 13                                                       |
| W14 Startgewicht direkt                               | als bewusste Ausnahme markiert; CHECK 0,5–500; Profil-Pflicht; Export; Konto löschen                                                                                                                                                                                             | 3.2, 3.5, 3.7, 8 B                                               |
| H1 Altlasten ersetzter Pläne                          | `close_missed_sessions` nur aktiver Plan; ausblenden bzw. „entfallen“                                                                                                                                                                                                            | 3.6 Punkt 3, 5.6, 8 D                                            |
| H2 Nachgeholt                                         | Woche/Verlauf am tatsächlichen `performed_on`                                                                                                                                                                                                                                    | 5.6, 8 D                                                         |
| H3 Kosten                                             | Expo-Gratisplan-Kontingent, Apple/Google; Werte in Etappe E                                                                                                                                                                                                                      | 7.3, 8 E                                                         |
| H4 `ITSAppUsesNonExemptEncryption`                    | `false` bleibt, Bestätigung Phase 12                                                                                                                                                                                                                                             | 7.2 Punkt 3                                                      |
| H5 B1 und `docs/` in DoD                              | B1 in DoD Etappe B; `docs/` je Etappe nachziehen                                                                                                                                                                                                                                 | 8 A–D                                                            |
| H6 Widerrufs-Hinweis                                  | Hinweis in Einstellungen, Dialog, Datenschutzerklärung; Einwilligungstext unverändert                                                                                                                                                                                            | 3.4, 6.1                                                         |
| H7 Web offline nach Tab-Neustart                      | „Übungen nicht prüfbar“, Alternative gesperrt                                                                                                                                                                                                                                    | 4.6, 6.3                                                         |

## Wächter-Prüfung (Runde 2) – wie die Auflagen gelöst sind

| Befund                                    | Lösung                                                                                                                                                                                                                                                                                      | Abschnitt                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| R1 Einstiegswoche als Kalibrierungsquelle | zählt nicht für „zweimal in Folge“, setzt aber beim ersten Eintrag `state_*` über `estimateWorkingWeight()`; `recent_exercise_logs` liefert den neuesten Einstiegswochen-Eintrag, solange kein zählender existiert; nur Erholungswoche ohne Zustandsänderung; Test Woche 0 → Woche 1        | 3.6 Punkt 4, 5.1, 5.7                                 |
| R2 Alternative mit eigenem Zustand        | `state_*` = Zustand der Alternativ-Übung aus eigenem Verlauf, leer nur ohne Verlauf (dann Kalibrierung); verboten nur Übernahme aus der geplanten Übung (eigene Vorgabe der Alternative wird gespeichert, Nachtrag Etappe A); Test „Alternative zweimal → +Wdh.“                            | 3.2, 5.1, 5.7                                         |
| R3 Widerruf als eine Transaktion          | `revoke_health_data(p_delete_logs)` (`security definer`, `search_path = ''`, `auth.uid()`, nur `authenticated`); vorher `LogQueue` sperren und `fromHealthPlan`-Einträge bereinigen; Bereinigung auf anderen Geräten beim Laden; Restrisiko + Dialog-Hinweis; pgTAP `anon`, fremde Einträge | 3.4 S1, 3.6 Punkt 6, 3.7, 4.3, 4.5, 8 B/C, 13 Punkt 5 |
| R4 Idempotenz                             | `write_id` je Fassung, `last_write_id`; gleicher Wert → `ok` mit aktueller `revision`; pgTAP „Antwort verloren“; `delete_session_log(p_id, p_base_revision)`                                                                                                                                | 3.2, 3.6, 4.3, 4.5, 8 B/C, 13                         |
| R5 Konto-Bindung                          | `owner_user_id` in Entwurf, `LogQueue`, `logCache`, `SyncQueue`; nur passendes Konto sendet, sonst Nachfrage „löschen?“; Sitzungsablauf → erneut anmelden, nichts leeren; Test                                                                                                              | 4.1, 6.3, 8 C                                         |
| R6 Abmelde-Nachfrage                      | zählt Queue, Entwürfe und Konflikte; Rest nach Senden → nicht abmelden, erneut fragen                                                                                                                                                                                                       | 4.1, 6.1, 6.3, 8 C                                    |
| H-a fremde/erfundene `planned_session_id` | wie „nicht gefunden“ → `orphaned`, ohne unterscheidbare Meldung; verwaiste Einträge zählen nicht für den 10-%-Bezug (Test)                                                                                                                                                                  | 3.6 Punkt 1, 5.7, 8 B                                 |
| H-b Reihenfolge vor Planwechsel           | `LogQueue` vor `save_training_plan` senden                                                                                                                                                                                                                                                  | 4.3, 8 C                                              |
| H-c abgelehnte Neu-Einwilligung           | festgelegt: gleiche Neutralisierung wie beim Widerruf über `private.neutralize_health_plan_logs()`, aufgerufen von `save_training_plan` ohne gültige Einwilligung (Phase-3-Nachtrag in Etappe B, pgTAP)                                                                                     | 3.4 S1, 3.7, 8 B                                      |
| H-d Handy-Test Etappe E                   | Text an „Einreichen: ja/nein“ angeglichen                                                                                                                                                                                                                                                   | 9                                                     |
| H-e                                       | bleibt DoD-Prüfung der jeweiligen Etappe                                                                                                                                                                                                                                                    | 8                                                     |
| H-f Export-Abgleich                       | über Fremdschlüssel auf `auth.users` (`pg_constraint`) statt Spaltenname                                                                                                                                                                                                                    | 3.7, 8 B                                              |
| H-g                                       | wie R3                                                                                                                                                                                                                                                                                      | siehe R3                                              |
