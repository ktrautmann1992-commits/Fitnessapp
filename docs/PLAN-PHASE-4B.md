# Plan Phase 4b – Live-Anpassung des Plans (Premium, ohne KI) und Benachrichtigungen

**Status:** Freigegeben am 09.10.2026 – die Gründer übernehmen bei allen offenen Fragen (Abschnitt 13) die Empfehlung. Wächter: freigabefähig (2 Runden). Umsetzung startet mit Etappe A0.

**Grundlage:**

- `CLAUDE.md`.
- `docs/KONZEPT.md`, Abschnitte 4, 4.1, 5, 9, 11.1, 12, 13 und 15.
- `docs/PROMPTS.md`, Phase 4b und zur Abgrenzung Phase 5, 7 und 8.
- `docs/ERWEITERUNGEN.md`, Abschnitt 9.
- `docs/PLAN-PHASE-4.md`: Abschnitte 2.3, 3.6 und 10, Frage 9, Umsetzungsstand bis Etappe E.
- `docs/PLAN-PHASE-3.md`: Vormerkungen „Phase 4b“.
- `docs/PLAN-PDF-EXPORT.md`.

**Vorbedingung (nur für die Etappen B und C):** Der Live-Test W13 aus Phase 4 (zwei Handys, echtes Supabase) ist abgeschlossen. Ohne ihn ist der Server-Weg aus Abschnitt 6 nicht prüfbar. A0, A, D (Testmodus) und E brauchen ihn nicht.

---

## 0. Wächter-Prüfung: eingearbeitet

Die Wächter-Prüfung (scratchpad `waechter-plan-4b.md`) hat zwei blockierende Punkte, sechs Soll- und sechs Kann-Punkte gefunden. Alle sind im Plantext umgesetzt:

| Befund                                                                     | Lösung im Plan                                                                                                                                                                                                                                                                                                                                                                                                                          | Abschnitt                                   |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **B1** Admin-Seite mit E-Mail-Suche hinter geteiltem Passwort (Stufe A)    | **Keine Admin-Seite mit Nutzerdaten.** Freischalten, Entziehen und Flag schalten per manuell startbarem GitHub-Workflow `beta-grant` (E-Mail als Eingabe, Ausgabe ohne Personenbezug, jede Aktion mit GitHub-Namen protokolliert). Die Live-Anpassungs-Routen sind in Vercel-Vorschauen gesperrt. Eine Admin-Seite kommt erst mit Login Stufe B (`admin_users`) als spätere Option.                                                     | 4.4, 6.3, 6.4, Frage 2 und 13               |
| **B2** Tausch der Erholungswoche (`deload_forward`) nicht genau festgelegt | Tausch-Regel exakt beschrieben: Die frühere Erholungswoche bekommt höchstens die Dosierung der **vorangehenden Belastungswoche**. Nie mehr Belastungswochen in Folge als `loadWeeksBeforeDeload()`, Ausdauer-Wochenminuten nie > `floor(1,1 × Vorwoche)` (auch über die Blockgrenze). Invarianten als Eigenschaftstest **und** in `apply_plan_adjustments` nachgerechnet. Hält eine Invariante nicht: `volume_reduce` bzw. nur Hinweis. | 5.2 (R3 „Tausch-Regel“), 4.6, 5.8, Frage 14 |
| **S1** Änderung trifft laufende bzw. heutige Einheit                       | `effective_from` ≥ morgen; nur Einheiten mit `status = 'planned'`, `scheduled_on > heute` und **ohne** `session_logs`-Eintrag. Test „Entwurf vor Tausch → Speichern weiterhin ok“.                                                                                                                                                                                                                                                      | 4.6, 5.2, 5.8                               |
| **S2** Ereignisse für Gratis-Nutzer (Datenminimierung)                     | Ereignisse entstehen **nur**, wenn Flag an und `private.has_entitlement_for(uid)`. Offene Ereignisse werden trotzdem exportiert.                                                                                                                                                                                                                                                                                                        | 3, 4.4, 4.6, 4.7, Frage 15                  |
| **S3** Ratenbegrenzung ohne geteilten Zähler                               | Zähler `private.live_adjust_hourly_counts` (Muster `session_log_daily_counts`), geprüft in `claim_adjustment_events`. Test in Etappe C.                                                                                                                                                                                                                                                                                                 | 4.4, 4.6, 6.1                               |
| **S4** CORS zwischen App-Web-Export und `apps/web`                         | CORS nur für die eigene App-Domain plus Vorschau-Muster, `Authorization` erlaubt, keine Cookies; `EXPO_PUBLIC_WEB_URL` in der App.                                                                                                                                                                                                                                                                                                      | 6.1, 6.4                                    |
| **S5** Mess-Erinnerung nach Widerruf                                       | Ohne gültige `health_data`-Einwilligung plant die App keine Mess-Erinnerung und storniert eine geplante. `enabled` bleibt unverändert. Test in E.                                                                                                                                                                                                                                                                                       | 7                                           |
| **S6** Unstimmigkeiten mit dem Code                                        | `ENDURANCE_SESSION_LIMITS.minSessionMinutes`; Ausdauer-Schwelle vereinfacht auf feste 7 (begründet); `consecutiveSessionsForStep` an beiden Stellen in `loads.ts`; Umzug der Zeilen-Abbildung als eigene Etappe **A0**.                                                                                                                                                                                                                 | 5.1, 5.2, 10                                |
| **K1** Kalorien-Schutzgrenzen                                              | `clampCalorieAdjustment()` in `packages/core/src/nutrition/limits.ts` (neu, Phase 5 baut dort weiter).                                                                                                                                                                                                                                                                                                                                  | 5.2                                         |
| **K2** Testschalter „Premium simulieren“                                   | Technisch nur bei `backend.mode === 'local'`, Test: Supabase-Modus kennt den Schalter nicht.                                                                                                                                                                                                                                                                                                                                            | 8.1                                         |
| **K3** Etappe A zu groß                                                    | Benachrichtigungs-Funktionen ziehen nach E. E ist damit wirklich unabhängig.                                                                                                                                                                                                                                                                                                                                                            | 10                                          |
| **K4** Beta-Freischaltung im Export                                        | Zusätzlich in `db-sync.test.ts` und pgTAP abgesichert (H-f deckt `private` nicht ab).                                                                                                                                                                                                                                                                                                                                                   | 4.7, 10                                     |
| **S-n1** (Runde 2) Woche 0 bei „höchstens `L` in Folge“                    | Woche 0 (Teilwoche) zählt nicht, Einstiegswoche zählt; Regressionstest „jeder heute erzeugbare Plan erfüllt die Regel“, bevor `append_plan_block` sie prüft.                                                                                                                                                                                                                                                                            | 5.2 Punkt 6, 5.8, 10 (A, B)                 |
| **S-n2** (Runde 2) `beta-grant`: sichere Eingaben und Secrets              | Eingaben nur über `env:`, E-Mail-Muster vor `::add-mask::`, `tage` 1–180, JSON per `jq --arg`, gefilterte Ausgabe, Secret nur im Aufruf-Schritt, `permissions`, SHA-Pinning, `concurrency`; in `beta_admin` `lower()` und Prüfmuster für `p_actor`; actionlint und Mustertest.                                                                                                                                                          | 4.6 Punkt 10, 6.3, 10 (B, C)                |
| **K5** Gründer-Fragen                                                      | Ergänzt: Fragen 13 bis 16.                                                                                                                                                                                                                                                                                                                                                                                                              | 13                                          |
| **K6** Ist-Stand der API-Routen                                            | genauer: auch `admin/api/login` und `admin/api/logout`.                                                                                                                                                                                                                                                                                                                                                                                 | 4.1                                         |
| Hinweis: Push statt lokal                                                  | Abweichung von PROMPTS („Mess-Erinnerungen per Push“) wird in KONZEPT 12 festgehalten.                                                                                                                                                                                                                                                                                                                                                  | 7, 10 (Etappe E)                            |

---

## 1. Ziel in einfachen Worten

Bis jetzt rechnet die App aus eurem Tagebuch nur nach oben: Habt ihr alle Wiederholungen geschafft, steigt das Ziel. Mit der **Live-Anpassung** (Premium) reagiert der Plan auch in die andere Richtung, und zwar sofort nach dem Training:

- Waren die letzten Einheiten einer Übung **viel zu schwer**, senkt der Plan das Gewicht etwas.
- Wart ihr über mehrere Einheiten **am Limit**, wird die nächste Woche leichter.
- Kommt ihr bei einer Übung **drei Wochen nicht weiter**, schlägt die App eine passende andere Übung vor oder zieht die Erholungswoche vor.
- Schafft ihr über drei Wochen **deutlich weniger als 70 %** der Einheiten, fragt die App, ob ihr auf weniger Trainingstage umstellen wollt.
- War eine Einheit **sehr leicht** und ihr habt das angegeben, geht es schneller voran.

Jede Änderung steht mit Datum und einem einfachen Satz unter **„Warum hat sich mein Plan geändert?“**. Kleine Änderungen macht die App selbst (rückgängig machbar). Große Änderungen wie weniger Trainingstage passieren nur, wenn ihr zustimmt.

Alles läuft über **feste Regeln** in `packages/core`, **ohne KI**. Die Premium-Prüfung passiert **auf dem Server**. Bis es Abos gibt (Phase 7), hängt sie an einem **Feature-Flag** und einer Beta-Freischaltung für ausgewählte Konten. Die Freischaltung macht ihr per GitHub-Workflow `beta-grant` in der GitHub-App, nicht über eine Admin-Seite.

Außerdem kommen **Benachrichtigungen** dazu, und die sind **gratis**:

- die **Mess-Erinnerung** („Zeit für dein Mess-Update“),
- das **Pausenende** im Hintergrund (Phase 4, Frage 9).

## 2. Umfang und Abgrenzung

### 2.1 Was in Phase 4b kommt

1. **Regel-Engine** `packages/core/src/adjust/` mit den Regeln R1–R5 (Abschnitt 5). Alle Startwerte stehen in `constants.ts` mit Quelle bzw. PRODUKTENTSCHEIDUNG.
2. **Ereignisgesteuerte Neuberechnung auf dem Server.** Auslöser sind Einheit eingetragen, Einheit verpasst, Mess-Update und Ziel bzw. Trainingstage geändert. Offline eingetragene Daten lösen die Neuberechnung beim nächsten Sync aus.
3. **Tabelle `plan_adjustments`** mit RLS. Sie speichert Auslöser, Regel, vorher, nachher, Status und Bestätigung.
4. **Ansicht „Warum hat sich mein Plan geändert?“**. Die Texte kommen aus festen Textbausteinen, keine KI.
5. **Bestätigung bei großen Änderungen** (weniger Trainingstage). Kleine Änderungen sind **rückgängig machbar**.
6. **Premium-Prüfung serverseitig** über `has_entitlement()`. Bis Phase 7 steht sie hinter dem Feature-Flag `live_adjustment` plus Beta-Freischaltung (Workflow `beta-grant`, Abschnitt 6.3). Gratis-Nutzer behalten genau die Progression aus Phase 4.
7. **Benachrichtigungen (gratis)** als lokale Benachrichtigungen auf dem Gerät: Mess-Erinnerung und Pausenende.
8. **Vorbereitung**, aber noch nicht aktiv:
   - Regel-Typen `calorie_adjust` und `muscle_gain_volume` (Phase 5),
   - `readiness_lighter` (Phase 8),
   - Auslöser `wearable_data` (Phase 8),
   - `competition_date_changed` (Phase 10).

### 2.2 Was NICHT in Phase 4b kommt

| Thema                                                                                                 | Wann / Begründung                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Kalorien anpassen (Fettverlust: Taille, Bauch und Gewicht stagnieren; Muskelaufbau: Kalorien erhöhen) | Phase 5. Es gibt noch kein Kalorienziel. In 4b gibt es nur die geprüften Schutzgrenzen-Funktionen und reservierte Regel-Typen (Frage 3). |
| Muskelaufbau: Volumen bei Stillstand von Gewicht, Umfängen und Kraft                                  | zusammen mit den Kalorien in Phase 5, weil die Regel Körperdaten **und** Kalorien kombiniert                                             |
| Readiness, Tagesform aus Wearable                                                                     | Phase 8                                                                                                                                  |
| Wettkampfdatum als Auslöser                                                                           | Phase 10                                                                                                                                 |
| KI-Erklärung in Worten (KONZEPT 4.1, optional)                                                        | Phase 7b oder 11, Premium-KI mit `ai_usage`                                                                                              |
| Paywall, Abo, `entitlements` aus RevenueCat bzw. Stripe                                               | Phase 7. 4b baut nur die Prüf-Funktion, die Phase 7 befüllt.                                                                             |
| Server-Push (Push-Token, Expo Push Service), z. B. „Dein Plan wurde angepasst“                        | später (Frage 8). In 4b zeigt die App das als Hinweis an.                                                                                |
| Benachrichtigungen im Browser (Web Push)                                                              | nicht geplant. Im Browser bleibt es beim Hinweis in der App.                                                                             |
| PDF des Ernährungsplans (P5 in `PLAN-PDF-EXPORT.md`)                                                  | Phase 5 (gehört zum Ernährungsplan).                                                                                                     |

### 2.3 Gratis und Premium

| Funktion                                                                                     | Gratis | Premium |
| -------------------------------------------------------------------------------------------- | ------ | ------- |
| Doppelte Progression aus Phase 4 (nur nach oben), Wiedereinstieg nach Pause                  | Ja     | Ja      |
| 10-%-Schutzregel Ausdauer, feste Erholungswoche, Sicherheitsregeln aus dem Gesundheits-Check | Ja     | Ja      |
| Mess-Erinnerung als Benachrichtigung, Pausenende im Hintergrund                              | Ja     | Ja      |
| Regeln R1–R5, `plan_adjustments`, „Warum hat sich mein Plan geändert?“                       | Nein   | Ja      |

**Grundsatz:**

- Ohne Premium entsteht **keine einzige Zeile** in `plan_adjustments` oder `private.adjustment_events`, und der Plan wird nie verändert.
- Läuft Premium ab, gelten bestehende Änderungen weiter, weil sie schon trainiert wurden. Es kommen aber keine neuen dazu. „Rückgängig“ bleibt möglich.

---

## 3. Architektur-Entscheidung: Wo laufen die Regeln? (Frage 1)

Die Fachlogik ist TypeScript in `packages/core` (CLAUDE.md: Fachlogik nur dort). Die Datenbank ist Postgres. „Ereignisgesteuert auf dem Server“ verlangt einen Ort, an dem `core` serverseitig läuft.

| Variante                                                                                                     | Vorteile                                                                                                                                    | Nachteile                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A – Next.js-API-Route in `apps/web` (Vercel, Region `fra1`) plus Ereignis-Liste in Postgres (Empfehlung)** | `apps/web` hängt schon an `@fitnessapp/core`. Kein neues System. Logik nur einmal in TS. Vercel steht als AV-Partner ohnehin auf der Liste. | Braucht einen Anstoß: die App nach dem Sync und ein stündlicher Lauf als Netz. Die Region muss auf Frankfurt festgelegt werden.                  |
| B – Supabase Edge Function (Deno)                                                                            | nah an der Datenbank, Database-Webhook direkt                                                                                               | Neue Laufzeit (Core für Deno bündeln), eigener Deploy-Workflow, zweite Fehlerquelle                                                              |
| C – Regeln in SQL nachbauen                                                                                  | echte Trigger, keine Latenz                                                                                                                 | Verstößt gegen „Fachlogik nur in core“. Doppelte Logik, nicht mit Vitest prüfbar.                                                                |
| D – App rechnet, Server speichert nur (wie `append_plan_block`)                                              | einfach, offline sofort                                                                                                                     | Premium-Logik liefe im Client. CLAUDE.md verlangt die Premium-Prüfung auf dem Server, und KONZEPT 4.1 verlangt die Neuberechnung auf dem Server. |

**Empfehlung A im Detail:**

1. **Ereignis-Liste (Outbox):** Die vorhandenen Server-Funktionen schreiben je Ereignis eine Zeile in `private.adjustment_events`. Das sind `save_session_log`, `close_missed_sessions`, ein Trigger auf `body_measurements` bzw. `body_metrics` und Trigger auf `goals` bzw. `training_slots`. Das ist das „Ereignis auf dem Server“. Es geht nichts verloren, auch wenn der Anstoß ausfällt.
   - Geschrieben wird **nur**, wenn das Flag `live_adjustment` an ist und `private.has_entitlement_for(uid)` gilt (Wächter S2, Datenminimierung). Für Gratis-Nutzer entsteht keine Zeile. Die Gratis-Wege selbst (Speichern, Verpasst-Markierung, Messung) bleiben unverändert, nur das zusätzliche Einfügen hängt an der Prüfung.
2. **Anstoß 1 (sofort):** Nachdem die `LogQueue` gesendet ist, ruft die App `POST /api/live-anpassung` mit ihrem Login-Token auf. Die Route verarbeitet **nur die Ereignisse dieser Person**. Im Browser (Web-Export auf einer anderen Vercel-Domain) braucht das CORS, siehe 6.1.
3. **Anstoß 2 (Netz):** Der GitHub-Action-Workflow `live-adjust-sweep.yml` ruft stündlich `POST /api/live-anpassung/sweep` mit einem Geheimnis auf und verarbeitet liegengebliebene Ereignisse. Zusätzlich gibt es „Run workflow“ per Hand.
   - Vercel-Cron im Gratis-Tarif läuft nur täglich. Deshalb ist GitHub Actions hier passender und entspricht dem Prinzip „Automatisierung als GitHub Action“.
4. **Lesen und Schreiben:**
   - Die Route liest die Daten der Person, beim Sofort-Anstoß **mit deren Token (RLS greift)**.
   - Sie rechnet mit `core`.
   - Sie schreibt **ausschließlich** über die Server-Funktion `apply_plan_adjustments(...)`. Die ist nur für `service_role` freigegeben, prüft Premium und alle Grenzen **noch einmal** und schreibt atomar.
   - Die Route selbst schreibt nie direkt in Tabellen.
5. **Region und Logs:**
   - `export const preferredRegion = 'fra1'` und `runtime = 'nodejs'`.
   - Es wird **nichts aus den Nutzerdaten geloggt**, nur Anzahl, Dauer und feste Fehlercodes. Dafür gibt es einen Vitest-Test, der alle `console.*`-Aufrufe abfängt.

---

## 4. Datenmodell

### 4.1 Ist-Stand, auf dem wir aufbauen (geprüft am 06.10.2026)

- **Pläne:** `user_plans`, `planned_sessions` und `planned_exercises` sind für `authenticated` nur lesbar. Von `planned_sessions` dürfen Nutzer nur `scheduled_on` und `status` ändern. Der Verschiebe-Trigger greift nur für `current_user = 'authenticated'`. `security definer`-Funktionen (Eigentümer) sind nicht betroffen.
- **Progression kommt aus dem Tagebuch** (`state_*` in `exercise_logs`, `progressFromLogs()`), nicht aus dem Plan. `planned_exercises.target_weight_kg` ist leer. PLAN-PHASE-4 hat Schreibfunktionen auf Pläne ausdrücklich „für 4b reserviert“.
- **Einziger Schreibweg** für Einträge ist `save_session_log`, der Andockpunkt aus PLAN-PHASE-4 2.3. Verpasste Einheiten setzt `close_missed_sessions()` auf `skipped`.
- **Körperdaten:** `body_measurements` und `body_metrics` gibt es nur mit `health_data`. `measurement_reminders` (`interval_days`, `next_due_on`, `enabled`) ist kein Gesundheitsdatum.
- **Pflicht-Funktionen bei jeder neuen Tabelle:** `export_my_data()`. Der pgTAP-Test gleicht alle Tabellen mit Fremdschlüssel auf `auth.users` ab (H-f), eine neue Tabelle ohne Export lässt den Test scheitern. Ebenso `delete_my_account()` per Kaskade, `consents_after_revoke()` und `revoke_health_data()`.
- **Folgeblock:** Er entsteht in der App (`nextPlanBlock()` → `append_plan_block`) aus den Einheiten der letzten Belastungswoche (`baseSessionsFromBlock()`/`lastLoadWeekSessions()`).
- **Was es noch nicht gibt:** Premium, Entitlements, Feature-Flags, Benachrichtigungen (`expo-notifications` fehlt in `apps/mobile/package.json`). API-Routen in `apps/web` gibt es nur für die Warteliste (`api/warteliste`, `…/bestaetigen`, `…/abmelden`) und den Admin-Zugang Stufe A (`admin/api/login`, `admin/api/logout`). Der in PLAN-PHASE-2 vorgesehene Workflow `admin-grant` ist noch nicht gebaut; `beta-grant` (6.3) wird das erste Beispiel dieses Musters.
- **Erholungswoche heute:** `loadWeeksBeforeDeload()` ergibt 5 Belastungswochen bei Einsteigern, sonst 4 (vorsichtig 4), danach eine Erholungswoche (`DELOAD_SCHEDULE`, `deloadDosage()`). Ausdauer: Belastungswoche ≤ `floor(1,1 × letzte Belastungswoche)`, Erholungswoche = `floor(0,6 × letzte Belastungswoche)` und nie Bezug (`enduranceWeekVolumes()`).

### 4.2 Grundidee: zwei Arten von Wirkung

| Art                                              | Beispiele                                                                                                    | Wo die Wirkung liegt                                                                                                                                                                                                                                                            | Begründung                                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zustands-Vorgabe je Übung** (`state_override`) | Gewicht senken (R2), schneller steigern (R1)                                                                 | in `plan_adjustments.state_after` (gleiche Form wie `ExerciseProgress`). `progressFromLogs()` übernimmt ihn, wenn die Anpassung auf dem **neuesten zählenden Eintrag** dieser Übung beruht. Der nächste Eintrag speichert ihn als `state_*`, und die Kette läuft normal weiter. | Die Progression bleibt **aus dem Tagebuch berechnet** (Entscheidung Phase 4). Das funktioniert offline und auf zwei Geräten gleich. Es braucht kein Schreiben in `planned_exercises` und ändert nichts an `save_session_log`. |
| **Plan-Änderung** (`plan_change`)                | Sätze −1 für eine Woche bzw. Erholungswoche vorziehen (R3), Ausdauer-Minuten ×0,85 (R3), Übung tauschen (R4) | Der Server schreibt nur in Einheiten des **aktiven** Plans **ab morgen**, die noch `planned` sind und **keinen** `session_logs`-Eintrag haben (4.6, Wächter S1). `before`/`after` stehen in `plan_adjustments`, damit „Rückgängig“ und der Folgeblock die Werte kennen.         | Diese Änderungen betreffen den Plan selbst (Wochenstruktur, Übungsauswahl), nicht den Fortschritt.                                                                                                                            |
| **Vorschlag** (`proposal`)                       | weniger Trainingstage (R5)                                                                                   | nur ein Datensatz mit Status `pending_confirmation`. Bei „Ja“ erzeugt die App wie bisher einen neuen Plan (`generateTrainingPlan` → `save_training_plan`) mit einem Trainingstag weniger.                                                                                       | Große Änderung, nur nach Bestätigung (KONZEPT 4.1). Neuplanung läuft heute ohnehin in der App.                                                                                                                                |

**Veraltete Zustands-Vorgabe:** Kommt nach der Berechnung ein neuerer Eintrag derselben Übung an (zweites Gerät, Warteschlange), passt `basis_session_log_id` nicht mehr. Dann ignoriert die Anzeige die Vorgabe. Der Server setzt sie bei der nächsten Neuberechnung auf `superseded` und rechnet neu.

### 4.3 Neue Aufzählungen

Postgres und `enums.ts`, Abgleich in `db-sync.test.ts`, eigene Migrationsdatei **vor** den Funktionen (Muster Phase 4):

- `adjustment_trigger`: `session_logged`, `session_missed`, `measurement_updated`, `goal_changed`, `slots_changed`, `manual_recheck`. Reserviert: `wearable_data`, `competition_date_changed`.
- `adjustment_rule`:
  - aktiv: `fast_increase` (R1), `load_reduce` (R2), `volume_reduce` (R3), `deload_forward` (R3/R4), `endurance_reduce` (R3), `stagnation_variation` (R4), `fewer_days` (R5)
  - reserviert: `calorie_adjust`, `muscle_gain_volume`, `readiness_lighter`
- `adjustment_kind`: `state_override`, `plan_change`, `proposal`.
- `adjustment_status`: `applied`, `pending_confirmation`, `confirmed`, `declined`, `expired`, `reverted`, `superseded`.

### 4.4 Neue Tabellen

| Tabelle                             | Spalten (Kurzform)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Regeln                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan_adjustments`                  | `id`, `user_id` (cascade auf `auth.users`), `plan_id` mit `(plan_id, user_id)` → `user_plans` **on delete cascade**, `trigger`, `rule`, `kind`, `status`, `requires_confirmation` (bool), `exercise_id` (nullable, → `exercises`, `on delete restrict`), `planned_session_ids` uuid[] (≤ 14), `basis_session_log_id` (uuid, nullable, **ohne** Fremdschlüssel, nur Vergleichswert), `basis_performed_on` (date), `state_before`/`state_after` (jsonb, strikt: `weightKg`, `targetReps`, `extraSet`, `durationS`), `change_before`/`change_after` (jsonb, strikt je Regel, ≤ 4 KB), `explain_params` (jsonb, nur Zahlen und Codes, **kein Freitext**), `effective_from` (date), `expires_on` (date, nur bei Vorschlägen), `engine_version`, `rule_version` (smallint), `input_fingerprint` (text, Hash der Eingaben, Idempotenz), `uses_body_data` (bool not null), `from_health_plan` (bool not null), `decided_at`, `created_at`, `updated_at` | `authenticated` darf nur **lesen** (eigene Zeilen). Schreiben nur über die Funktionen in 4.6. `unique (user_id, rule, input_fingerprint)` sorgt dafür, dass dieselbe Lage nie zweimal angepasst wird. CHECK: `kind = 'state_override'` ⇔ `exercise_id` und `state_after` gesetzt. CHECK: `status = 'pending_confirmation'` ⇒ `requires_confirmation`. Index `(user_id, created_at desc)`. |
| `private.adjustment_events`         | `id` bigserial, `user_id`, `trigger`, `ref_id` (uuid, z. B. Eintrag), `created_at`, `processed_at`, `attempts` smallint, `last_error_code` text (fester Code, kein Inhalt)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Nur `service_role`. Entsteht **nur bei Premium** (Flag an und Entitlement, Wächter S2). Wird bei Verarbeitung bzw. spätestens nach 30 Tagen gelöscht. Enthält **keine Werte**, nur Verweise. Ein Event je `(user_id, trigger, ref_id)` (`on conflict do nothing`).                                                                                                                        |
| `private.live_adjust_hourly_counts` | `user_id` (cascade), `hour_start` timestamptz, `count` smallint, pk `(user_id, hour_start)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Nur `service_role`. Geteilter Zähler für die Ratenbegrenzung (Wächter S3, Muster `session_log_daily_counts`). Aufräumen nach 24 h im Sweep.                                                                                                                                                                                                                                               |
| `private.feature_flags`             | `key` text pk (`live_adjustment`, später weitere), `enabled` bool, `updated_at`, `updated_by` text (GitHub-Name aus dem Workflow)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Nur `service_role`, geschaltet über den Workflow `beta-grant`. Kein Nutzerbezug.                                                                                                                                                                                                                                                                                                          |
| `private.beta_entitlements`         | `user_id` pk (cascade), `entitlement` (`premium`), `granted_at`, `granted_by` text (GitHub-Name), `expires_at` (Pflicht, ≤ 180 Tage), `note` (≤ 100 Zeichen, kein Gesundheitsbezug)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Nur `service_role`. Brücke bis Phase 7, dann ersetzt durch die echte `entitlements`-Tabelle aus den Abo-Webhooks.                                                                                                                                                                                                                                                                         |
| `private.admin_actions`             | `id` bigserial, `action` (`beta_grant`, `beta_revoke`, `flag_on`, `flag_off`), `actor` text (GitHub-Name), `target_user_id` uuid (nullable, → `auth.users` **on delete set null**), `expires_at`, `created_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Nur `service_role`. Protokoll jeder Aktion (Wächter B1, Nachvollziehbarkeit). Keine E-Mail, kein Freitext. Aufbewahrung 1 Jahr, Aufräumen im Sweep.                                                                                                                                                                                                                                       |

**Neue Spalten in bestehenden Tabellen:**

- `planned_sessions.adjustment_id` und `planned_exercises.adjustment_id` (uuid, nullable, → `plan_adjustments` `on delete set null (adjustment_id)`).
- Damit kann die App „angepasst“ anzeigen, und der Folgeblock erkennt vorübergehende Änderungen (5.8).

### 4.5 Rechte (RLS)

- `plan_adjustments`: RLS an. `select` nur eigene Zeilen. Kein `insert`, `update` oder `delete` für `authenticated` und `anon`.
- `planned_sessions` und `planned_exercises`: bleiben unverändert. Die neuen Spalten sind für `authenticated` **nicht** änderbar, die Spalten-Rechte bleiben `scheduled_on, status`.
- `private.*`: kein Zugriff außer `service_role`. pgTAP prüft, dass `authenticated` die Tabellen nicht einmal sieht.

### 4.6 Server-Funktionen (`security definer`, `search_path = ''`, `revoke … from public, anon`)

1. **`public.has_entitlement(p_entitlement text default 'premium') returns boolean`** (`authenticated`). Aus `auth.uid()` wird `private.has_entitlement_for(uid, p_entitlement)`. In 4b gilt: Eintrag in `beta_entitlements` mit `expires_at > now()`. **Phase 7 ersetzt nur den Rumpf von `private.has_entitlement_for`** (eine Stelle, entspricht `hasEntitlement()` aus KONZEPT 15).
2. **`public.live_adjustment_status() returns jsonb`** (`authenticated`). Antwort `{ "active": bool, "reason": "ok" | "flag_off" | "no_entitlement" }`, nur für die Anzeige in der App. Die Wahrheit liegt bei Punkt 3.
3. **`public.apply_plan_adjustments(p_user uuid, p_batch jsonb) returns jsonb`**, **nur `service_role`**:
   - **Prüfungen:**
     - Flag `live_adjustment` an und `private.has_entitlement_for(p_user, 'premium')`. Sonst `{ result: "not_entitled" }` ohne Änderung.
     - Nur bekannte Felder (`private.assert_json_keys`), höchstens 20 Anpassungen je Aufruf.
     - **Grenzen nachrechnen:**
       - Gewicht hoch höchstens um `LOAD_PROGRESSION.maxIncreaseFraction`, Gewicht runter höchstens auf `LIVE_ADJUSTMENT.loadReduce.factor` × vorher.
       - Gewicht im Bereich 0,5–500 kg.
       - Sätze −1, aber nie unter 1 und nie unter `SESSION_FIT`-Mindestsätze.
       - Ausdauer-Minuten nur nach unten und nie unter `ENDURANCE_SESSION_LIMITS.minSessionMinutes`.
       - Getauschte Übung `published` und in `exercise_alternatives` der alten Übung bzw. gleiches Bewegungsmuster. Die volle Sicherheitsprüfung macht `core`. Zusätzlich wendet die Anzeige die aktuellen Sicherheitsregeln immer zuletzt an (strengste gewinnt).
     - **Wochen-Invarianten nach `deload_forward` nachrechnen** (Wächter B2, gleiche Regeln wie 5.2 „Tausch-Regel“), über den Plan **nach** Anwendung aller Änderungen des Aufrufs:
       - Zahl der Belastungswochen in Folge (Woche ohne `is_deload`, ohne Woche 0) ≤ `loadWeeksBeforeDeload()` des Plans. Der Wert steht als `p_batch.max_load_weeks` im Aufruf und wird gegen `user_plans.inputs` (Level, vorsichtig) geprüft. Die letzten Wochen des Vorblocks zählen mit.
       - Ausdauer-Wochensumme jeder Belastungswoche ≤ `floor(1,1 × Summe der vorigen Belastungswoche)`; Erholungswochen zählen nicht als Bezug.
       - Jede Woche mit `is_deload = true` hat je Übung höchstens `ceil(Sätze × DELOAD_DOSAGE.setsFactor)` Sätze bzw. Ausdauer höchstens `floor(0,6 × letzte Belastungswoche)` Minuten.
       - Die getauschte (frühere) Erholungswoche hat je Übung höchstens die Sätze der vorangehenden Belastungswoche.
       - Verletzt der Aufruf eine Invariante: ganzer Aufruf abgelehnt, Fehlercode `invariant_violation`, keine Änderung. Die Konstanten stehen als SQL-Konstanten in der Migration, `db-sync.test.ts` gleicht sie mit `constants.ts` ab.
     - **Betroffene Einheiten** (Wächter S1): eigene, aktiver Plan, `status = 'planned'`, `scheduled_on > heute` (Europe/Berlin), `effective_from ≥ morgen` und **kein** Eintrag in `session_logs` zu dieser Einheit. Eine Einheit, die gerade trainiert wird oder deren Fassung noch in der `LogQueue` liegt, ist damit nie betroffen.
     - `basis_session_log_id` gehört der Person.
   - **Wirkung:**
     - schreibt `plan_adjustments`,
     - bei `plan_change` die Plan-Spalten (`sets`, `rpe_target`, `exercise_id`/`exercise_name_de`, `estimated_minutes`, `is_deload`) plus `adjustment_id`,
     - setzt ältere, überholte Zustands-Vorgaben derselben Übung auf `superseded`.
   - **Idempotent** über `unique (user_id, rule, input_fingerprint)`. Ein Duplikat ergibt `ok` ohne Änderung.
   - **Fehler ohne Zeileninhalt**, gleiche Fehlercode-Liste wie `save_session_log` (W10).
4. **`public.confirm_plan_adjustment(p_id uuid, p_accept boolean) returns jsonb`** (`authenticated`):
   - Nur eigene Anpassungen im Status `pending_confirmation`, die nicht abgelaufen sind.
   - Ergebnis `confirmed` oder `declined`, `decided_at = now()`.
   - **Kein Premium nötig zum Ablehnen.** Zum Annehmen von `fewer_days` ebenfalls nicht, weil die Neuplanung über das normale `save_training_plan` läuft.
   - Die App sendet danach `save_training_plan` mit einem Tag weniger. `p_id` geht als Verweis mit, damit die neue Anpassung `confirmed` und der alte Plan `replaced` heißt.
5. **`public.revert_plan_adjustment(p_id uuid) returns jsonb`** (`authenticated`):
   - Nur `applied` und `requires_confirmation = false`.
   - **Zustands-Vorgabe:** nur, solange seit `created_at` kein neuerer Eintrag dieser Übung existiert.
   - **Plan-Änderung:** nur, solange alle betroffenen Einheiten noch `planned`, ab morgen und ohne Eintrag sind. Dann wird `change_before` zurückgeschrieben.
   - **`deload_forward`** wird nur als Ganzes zurückgenommen (vorgezogene **und** getauschte Woche). Ist eine der beiden Wochen schon begonnen, ist Rückgängig nicht mehr möglich. So entsteht nie ein Plan ohne Erholungswoche.
   - Ergebnis `reverted`. Zurückgenommene Regeln feuern für dieselbe Lage nicht erneut: `input_fingerprint` bleibt belegt, und es gibt eine Ruhezeit `LIVE_ADJUSTMENT.cooldownDaysAfterRevert`.
6. **Ereignisse schreiben (Outbox):**
   - `save_session_log` (`session_logged`, `ref_id` = Eintrag),
   - `close_missed_sessions` (`session_missed`, je Einheit),
   - Trigger `after insert or update` auf `body_measurements` und `body_metrics` (`measurement_updated`),
   - `goals` (`goal_changed`), `replace_training_slots` (`slots_changed`).
   - Alles mit `create or replace`.
   - Eingefügt wird über eine Hilfsfunktion `private.enqueue_adjustment_event(uid, trigger, ref_id)`, die **nur** schreibt, wenn das Flag `live_adjustment` an ist und `private.has_entitlement_for(uid, 'premium')` gilt (Wächter S2). Ohne Premium tut sie nichts; das kostet eine Abfrage auf zwei kleine Tabellen. Fehler in der Hilfsfunktion brechen den Gratis-Weg nie ab (eigener Ausnahme-Block, fester Code).
   - pgTAP: Gratis-Konto speichert ein Training → keine Zeile in `adjustment_events`; Premium-Konto → genau eine.
7. **`public.claim_adjustment_events(p_user uuid default null, p_limit int default 50)`**, nur `service_role`. Holt offene Ereignisse mit `for update skip locked` (parallele Läufe sicher) und erhöht `attempts`. Ab 5 Fehlversuchen bleibt das Ereignis stehen und erscheint in der Zusammenfassung des Sweep-Workflows (nur Anzahl).
   - **Ratenbegrenzung** (Wächter S3): Mit `p_user` erhöht die Funktion zuerst atomar den Zähler in `private.live_adjust_hourly_counts` (`insert … on conflict do update … returning count`). Liegt er über `LIVE_ADJUSTMENT.recompute.maxPerUserPerHour`, gibt sie `{ "rate_limited": true }` ohne Ereignisse zurück. Der Wert steht als SQL-Konstante, Abgleich in `db-sync.test.ts`. Der Sweep (`p_user` null) zählt nicht.
8. **`public.mark_adjustment_events_processed(p_ids bigint[], p_error_code text default null)`**, nur `service_role`.
9. **`private.expire_plan_adjustments()`**: Vorschläge nach `LIVE_ADJUSTMENT.proposalExpiresDays` → `expired`. Wird vom Sweep aufgerufen, ebenso das Aufräumen von Ereignissen (30 Tage), Zählern (24 h) und `admin_actions` (1 Jahr).
10. **`public.beta_admin(p_action text, p_email text default null, p_days int default 90, p_actor text)`**, **nur `service_role`**, aufgerufen nur vom Workflow `beta-grant` (6.3, Wächter B1):
    - `p_action`: `grant`, `revoke`, `flag_on`, `flag_off`, `status`.
    - `grant`/`revoke`: sucht das Konto **in der Datenbank** über `lower(auth.users.email) = lower(p_email)` (kein `auth.admin` in einer Web-Route). `p_days` 1–180, Standard 90.
    - Prüft `p_actor` gegen `^[A-Za-z0-9-]{1,39}$` (GitHub-Namen) und `p_email` gegen dasselbe Muster wie der Workflow; sonst fester Code `invalid_input` ohne Echo (S-n2).
    - Schreibt jede Aktion in `private.admin_actions` mit `p_actor` (GitHub-Name).
    - **Antwort ohne Personenbezug:** `{ "result": "granted", "expires_on": "…" }`, `not_found`, `revoked`, `flag_on`/`flag_off` bzw. bei `status` nur Zahlen (Flag an/aus, aktive Freischaltungen, offene Ereignisse, Fehlversuche ≥ 5, Anpassungen je Regel der letzten 7 Tage). Keine E-Mail, keine `user_id` in der Antwort.
    - Unbekanntes Konto und „schon freigeschaltet“ liefern feste Codes, keine Details.

### 4.7 Widerruf, Konto löschen, Export

- **Widerruf `health_data`:**
  - `consents_after_revoke()` wird erweitert: **zuerst** werden alle eigenen `plan_adjustments` mit `uses_body_data` **oder** `from_health_plan` gelöscht.
  - Danach löscht der bisherige Ablauf die Gesundheits-Pläne, und die übrigen Anpassungen dieser Pläne fallen per Kaskade weg.
  - Begründung: Anpassungen aus Plänen mit Gesundheits-Check verraten mittelbar Flags, etwa „Ausdauer reduziert bei Plan ‚Zügiges Gehen‘“ (gleiche Linie wie S1 in PLAN-PHASE-4).
  - Zustands-Vorgaben, die schon in Tagebuch-Einträge übernommen wurden, neutralisiert `neutralize_health_plan_logs()` wie bisher.
  - pgTAP: Danach ist keine Anpassung mit diesen Kennzeichen übrig, Anpassungen aus Plänen ohne Gesundheitsbezug bleiben.
- **`uses_body_data`:** Setzt nur der Server. Es ist `true`, sobald eine Regel Körperdaten gelesen hat. In 4b ist das keine aktive Regel, aber das Feld ist für Phase 5 und 8 Pflicht. Ab dann greifen solche Regeln nur mit gültiger `health_data`-Einwilligung (KONZEPT 4.1). Die Route prüft `has_valid_consent`, die Funktion prüft es erneut.
- **Konto löschen:** Kaskade über `auth.users`, Ergänzung in `04_account_deletion` für `plan_adjustments`, `beta_entitlements`, `adjustment_events` und `live_adjust_hourly_counts`. In `admin_actions` wird `target_user_id` auf `null` gesetzt (Protokoll ohne Personenbezug bleibt).
- **Export (`export_my_data`):**
  - `plan_adjustments` kommt hinzu, der H-f-Test erzwingt das.
  - Die eigene Beta-Freischaltung (Datum, Ablauf, ohne `granted_by`) ebenfalls, obwohl sie in `private` liegt.
  - Offene `adjustment_events` (Auslöser, Zeitpunkte, ohne Verweise) ebenfalls (Art. 15 erfasst alle personenbezogenen Daten). Weil sie nur bei Premium entstehen und nach der Verarbeitung verschwinden, ist das meist eine leere Liste.
  - **Absicherung** (Wächter K4): H-f deckt `private` nicht ab. Deshalb prüft ein pgTAP-Test, dass `export_my_data()` die Schlüssel `beta_entitlement` und `adjustment_events` enthält (befüllt bei einem Test-Konto mit Freischaltung), und `db-sync.test.ts` gleicht die Schlüsselliste mit dem Export-Schema in `packages/core/src/export` ab.
  - Datenschutzerklärung (KONZEPT 14): Ereignis-Liste und Zähler der Ratenbegrenzung als kurzlebige Verarbeitungsdaten nennen.
- **Planwechsel** (`save_training_plan`): Offene Vorschläge des alten Plans werden `expired`. Angewandte Anpassungen bleiben als Verlauf, solange der alte Plan existiert (Aufräumen der 20 neuesten Pläne → Kaskade).

### 4.8 Typen

- `packages/db/src/database.types.ts` von Hand im gen-types-Format ergänzen: 1 Tabelle `public`, 2 Spalten, 4 Enums, 8 öffentliche Funktionen (4.6 Punkte 1–5, 7, 8 und 10). `database.types.test.ts` mitziehen.
- `db-sync.test.ts` gleicht Enums, CHECKs und die Feldlisten von `apply_plan_adjustments` mit den Zod-Schemas ab.

---

## 5. Core-Logik `packages/core/src/adjust/` (mit Tests)

Neuer Ordner, Export über `src/index.ts`. Reine, deterministische Funktionen: gleiche Eingaben ergeben gleiches Ergebnis und denselben `input_fingerprint`.

### 5.1 Eingaben (`adjust/inputs.ts`)

- `LiveAdjustmentInputs` enthält:
  - aktiven Plan mit Einheiten und Übungen,
  - Tagebuch-Einträge der letzten `LIVE_ADJUSTMENT.lookbackDays` (42) plus `recent_exercise_logs()`,
  - Geräte-Profile je Ort, Sicherheitsregeln (`planSafetyRules()`), Bibliothek,
  - bestehende `plan_adjustments`, `today`, Ziel,
  - `healthConsentValid`. Körperdaten nur, wenn das wahr ist.
- **Umzug (eigene Etappe A0, Wächter S6):** Die Abbildung Zeilen → Core-Typen liegt heute in `apps/mobile/src/data/log-rows.ts` und `training-plan.ts`. Sie zieht als reine Funktion nach `packages/core/src/log/rows.ts` (Tagebuch-Zeilen) und `packages/core/src/plan/rows.ts` (Plan-Zeilen), damit App und Server **dieselbe** Abbildung nutzen. Die App-Dateien importieren sie danach nur noch. A0 ist ein **reiner Umzug ohne Verhaltensänderung**: Schnappschuss der Beispiel-Progression und alle App-Tests unverändert grün.
- `liveAdjustmentInputsSchema` (Zod) an der Grenze der API-Route.

### 5.2 Regeln (`adjust/rules/*.ts`, je Regel eine Datei)

**Allgemein für alle Regeln:**

- Es zählen nur **zählende** Einträge (`isCountingEntry`, also ohne Einstiegswoche, Erholungswoche und Wiedereinstieg).
- Keine Regel feuert in Einstiegswoche oder Woche 0 oder für eine Erholungswoche.
- Keine Regel setzt Sicherheitsregeln außer Kraft. Nach jeder Anpassung kommen in der Anzeige `prescriptionForDisplay()` und `prepareSessionForDisplay()` mit den **aktuellen** Sicherheitsregeln, die strengste Regel gewinnt.
- **Plan-Änderungen (Wächter S1):** nie an einer Einheit von heute oder früher, nie an einer Einheit mit `status <> 'planned'` und nie an einer Einheit, zu der es schon einen `session_logs`-Eintrag gibt. `effective_from` ist frühestens morgen. Grund: `save_session_log` verlangt „gleiche Übung ⇔ done“ (Phase 4 Etappe B, Festlegung 6) und übernimmt `is_deload` aus der Einheit (Festlegung 3). Ein Tausch an einer laufenden Einheit würde deren gespeicherten Entwurf ablehnen lassen. Die Core-Funktion `eligiblePlannedSessions(plan, logs, today)` filtert das einmal zentral; der Server prüft es erneut (4.6).

**R1 `fast_increase` (Premium-Beschleunigung, Zustands-Vorgabe, automatisch):**

- **Bedingung:**
  - Im **neuesten** zählenden Eintrag einer Gewichts- oder Wdh.-Übung erreichen alle geplanten Arbeitssätze `reps_max`.
  - **Jeder** Satz hat ein RPE und liegt bei RPE ≤ `rpe_target − LIVE_ADJUSTMENT.fastIncrease.rpeBelowTarget` (2), also mindestens zwei Wiederholungen mehr in Reserve als vorgesehen.
  - Fehlende RPE-Angaben bedeuten: Die Regel greift nicht.
- **Wirkung:** Der Gewichtsschritt aus `nextLoad()` gilt schon nach **einer** statt zwei Einheiten, also `consecutiveSessionsForStep` 1 statt 2 als Option an `nextLoad()`.
  - Heute nutzt `nextLoad()` die Konstante `LOAD_PROGRESSION.consecutiveSessionsForStep` an **zwei** Stellen in `packages/core/src/plan/loads.ts` (Zeilen 206/208 und 240, Wächter S6). Beide lesen künftig `options.consecutiveSessionsForStep ?? LOAD_PROGRESSION.consecutiveSessionsForStep`. Test: ohne Option ist jedes Ergebnis identisch mit heute (Schnappschuss).
- **Unverändert bleiben:** der 10-%-Deckel, der Puffer bei großen Sprüngen, `firstSessionRpeTarget` und die Volle-Satzzahl-Regel W7.
- **Nie bei:** vorsichtigem Plan (Gesundheits-Flag oder kein Check), unter 18, ab 65, im ersten Block bei Einsteigern (Frage 5).

**R2 `load_reduce` (Zustands-Vorgabe, automatisch):**

- **Bedingung:** Die **zwei** neuesten zählenden Einträge einer Übung mit **gleichem** Zustand sind beide deutlich verfehlt. Deutlich verfehlt heißt: In mindestens der Hälfte der Arbeitssätze ist eines erfüllt:
  - Wiederholungen < `reps_min`,
  - bei Halteübungen Dauer < 80 % des Ziels,
  - gemeldetes RPE ≥ `rpe_target + 1,5` **und** Wdh. unter dem Ziel.
- **Wirkung:**
  - Gewicht × `LIVE_ADJUSTMENT.loadReduce.factor` (0,9), auf die nächste **eigene** Stufe des Orts **abgerundet**, aber nie unter die kleinste Stufe.
  - Ziel-Wdh. = `reps_min`, kein Zusatzsatz.
  - Halteübung: Dauer × 0,9 (≥ 10 s). Körpergewicht: Ziel-Wdh. = `reps_min`, kein Zusatzsatz.
- Je Übung höchstens einmal je `LIVE_ADJUSTMENT.loadReduce.cooldownDays` (14).
- **Abgrenzung zu Gratis:**
  - Gratis senkt nie. Dort bleibt der Zustand stehen, bis die Person selbst leichter trainiert (Phase 4, Frage 5).
  - Selbst gewähltes, leichteres Gewicht (Phase 4) hat Vorrang: Hat die Person schon selbst gesenkt, feuert R2 nicht.

**R3 hohe Belastung über mehrere Einheiten (Plan-Änderung, automatisch):**

- **Kraft (`volume_reduce` bzw. `deload_forward`):**
  - Bedingung: Die **drei** neuesten Kraft-Einträge innerhalb von 14 Tagen haben Belastungsempfinden der Einheit (`session_rpe`) ≥ 9.
  - Liegt die geplante Erholungswoche ≤ 2 Wochen entfernt: **nichts ändern**, nur ein Hinweis („Deine Erholungswoche kommt bald“).
  - Sonst `volume_reduce`: In allen Kraft-Einheiten der **nächsten** Kalenderwoche hat jede Übung 1 Satz weniger (mind. `SESSION_FIT`).
  - Feuert R3 in zwei aufeinanderfolgenden Wochen, wird stattdessen die Erholungswoche **vorgezogen** (`deload_forward`, Tausch-Regel unten). Damit es nicht zwei Erholungswochen kurz hintereinander gibt, wird die ursprünglich geplante Erholungswoche zur Belastungswoche – aber nur unter den festen Bedingungen der Tausch-Regel.
- **Ausdauer (`endurance_reduce`):**
  - Bedingung: In 2 der 3 neuesten Ausdauer-Einträge liegt die Anstrengung bei **≥ 7** (`LIVE_ADJUSTMENT.enduranceReduce.effortAtLeast`, Borg-CR10 „sehr anstrengend“).
  - **Begründung der festen Schwelle (Wächter S6):** `planned_sessions.effort_target` ist per CHECK 1–4; geplant werden nur lockere Einheiten (`ENDURANCE_EFFORT`: 3–4, vorsichtig 3). „Ziel + 3, mindestens 7“ wäre damit immer genau 7. Die feste 7 liegt mindestens 3 Punkte über jedem möglichen Ziel. Kommen später härtere Einheiten (Intervalle, Phase 10), wird die Regel mit Ziel-Abstand neu gefasst; ein Test schlägt fehl, sobald der CHECK über 4 erweitert wird (`db-sync.test.ts`).
  - Wirkung: geplante Minuten der Ausdauer-Einheiten der nächsten Woche × 0,85, abgerundet. Einheiten unter `ENDURANCE_SESSION_LIMITS.minSessionMinutes` entfallen nicht, sie bleiben bei diesem Minimum (nie über dem bisherigen Wert).
  - Die 10-%-Regel bleibt unberührt. Die reduzierte Woche zählt als Bezug für den Folgeblock, also eher vorsichtiger. Folgewochen desselben Blocks werden neu gedeckelt: jede Belastungswoche ≤ `floor(1,1 × vorige Belastungswoche)` (nur senken, nie erhöhen).

**Tausch-Regel `deload_forward` (gilt für R3 und R4, Wächter B2):**

Bezeichnungen: `L` = `loadWeeksBeforeDeload(level, vorsichtig)` des Plans (5 bzw. 4). Im Block sind die Wochen 1 bis `L` Belastungswochen, `D = L + 1` ist die geplante Erholungswoche. `k` ist die laufende Woche, `n = k + 1` die nächste.

1. **Wann erlaubt:** nur wenn `D − n ≥ 2` (Erholungswoche mehr als 2 Wochen entfernt), höchstens **einmal je Block**, und nur wenn alle Einheiten der Wochen `n` bis `D` ab morgen liegen, `planned` sind und keinen Eintrag haben (S1).
2. **Woche `n` wird Erholungswoche:** `is_deload = true`.
   - Kraft: `deloadDosage()` auf die bisherige Dosierung von Woche `n` (Sätze halbiert und aufgerundet, mind. 1; RPE −2, nie unter 5).
   - Ausdauer: Wochensumme = `floor(ENDURANCE_DELOAD_VOLUME_FACTOR × Summe der Woche k)` (0,6), verteilt wie bisher (`distributeEnduranceMinutes`).
   - Einträge dieser Woche sind wie jede Erholungswoche nicht zählend (`isCountingEntry`).
3. **Wochen `n + 1` bis `D − 1`:** Kraft-Dosierung unverändert. Ausdauer neu gedeckelt nach der bestehenden Regel aus `enduranceWeekVolumes()`: Bezug ist die letzte **Belastungswoche** (Woche `k`, die Erholungswoche `n` ist nie Bezug); jede Woche ≤ `floor(1,1 × Bezug)`. Es wird nur gesenkt, nie erhöht.
4. **Woche `D` (getauschte, frühere Erholungswoche) wird Belastungswoche** mit **genau der Dosierung der vorangehenden Belastungswoche `D − 1`** (nach Schritt 3), nie mehr:
   - Kraft: gleiche Übungen, Sätze und `rpe_target` wie die entsprechende Einheit in `D − 1`; Gewichte kommen wie immer aus dem Tagebuch-Zustand.
   - Ausdauer: Minuten je Einheit wie in `D − 1` (Wochensumme damit ≤ 1,0 × Vorwoche, also innerhalb der 10-%-Regel).
5. **Folgeblock (Blockgrenze):** Nach dem Tausch folgen auf die Erholungswoche `n` noch `c = D − n` Belastungswochen im laufenden Block. Damit nicht `c + L` Belastungswochen ohne Erholung entstehen, bekommt `nextPlanBlock()` die neue Option `carriedLoadWeeks = c`. Der Folgeblock hat dann `L − c` Belastungswochen (mindestens 1, wegen `D − n ≥ 2` und `n ≥ 2` immer erfüllt) und danach seine Erholungswoche. Der Rhythmus „nach höchstens `L` Belastungswochen kommt eine Erholungswoche“ bleibt also erhalten.
   - `carriedLoadWeeks` zählt die Core-Funktion `trailingLoadWeeks(plan)` aus dem **tatsächlichen** Plan (`is_deload` der geplanten Einheiten), **vor** `restoreTemporaryChanges()`. Ohne Live-Anpassung ist der Wert immer 0, der Folgeblock also unverändert (Gratis-Schnappschuss).
   - `restoreTemporaryChanges()` setzt Kraft-Sätze und Übungen für die Basis des Folgeblocks zurück (wie bisher). Der Ausdauer-Bezug des Folgeblocks bleibt die tatsächlich geplante letzte Belastungswoche (Woche `D`), also höchstens der Umfang von `D − 1`.
6. **Invarianten (Eigenschaftstest in 5.8 und Nachrechnung in `apply_plan_adjustments`, 4.6):**
   - nie mehr als `L` Belastungswochen in Folge – innerhalb des Blocks **und** über die Blockgrenze. **Woche 0 (Teilwoche zum Start, `week_no = 0`) zählt nicht mit**, die Einstiegswoche (Woche 1) zählt wie eine Belastungswoche (Wächter Runde 2, S-n1). Grund: Der heutige erste Block hat Woche 0 plus die Wochen 1…`L` vor der Erholungswoche `L + 1` (`plan/schedule.ts`, `buildPlanBlock`); mit Woche 0 wären es `L + 1` Wochen und heutige, gültige Pläne würden als Verstoß gelten;
   - Ausdauer-Wochenminuten jeder Belastungswoche nie > `floor(1,1 × vorige Belastungswoche)`, auch über die Blockgrenze und nach `restoreTemporaryChanges()`;
   - jede Erholungswoche bleibt mindestens mit `DELOAD_DOSAGE` reduziert (Sätze ≤ `ceil(0,5 × Belastungswoche)`, RPE ≤ Belastungswoche − 2 bzw. 5) und Ausdauer ≤ `floor(0,6 × letzte Belastungswoche)`;
   - die getauschte Woche `D` hat je Übung nie mehr Sätze, nie höheres `rpe_target` und nie mehr Minuten als `D − 1`;
   - je Block höchstens eine Erholungswoche, die durch `deload_forward` entstanden ist.
   - `append_plan_block` prüft die Regel „höchstens `L` Belastungswochen in Folge über die Blockgrenze“ (Woche 0 nicht gezählt) künftig ebenfalls (für alle Pläne, ohne Premium-Bezug). **Vorher** zeigt ein Regressionstest, dass jeder heute erzeugbare Plan die Regel erfüllt (S-n1, 5.8); erst danach wird die SQL-Prüfung eingeschaltet.
7. **Fallback:** Ist eine Bedingung aus Punkt 1 nicht erfüllt oder hält eine Invariante nach dem Tausch nicht (Core prüft mit `checkWeekInvariants()` vor dem Vorschlag): **kein Tausch**. Stattdessen `volume_reduce` für die nächste Woche (sofern nicht schon in dieser Woche angewandt), sonst nur der Hinweis „Deine Erholungswoche kommt bald“ bzw. „Gönn dir diese Woche etwas Ruhe“. Lehnt der Server mit `invariant_violation` ab, verwirft die Route den Vorschlag, protokolliert nur den Fehlercode und rechnet beim nächsten Ereignis neu (dann greift der Fallback).
8. **Rückgängig:** nur als Ganzes (Wochen `n` bis `D`), solange keine davon begonnen ist (4.6 Punkt 5).

**R4 Stillstand (Plan-Änderung, automatisch):**

- **Bedingung:**
  - Bei einer Übung gab es mindestens `LIVE_ADJUSTMENT.stagnation.minEntries` (3) zählende Einträge über ≥ 21 Tage ohne Schritt.
  - „Ohne Schritt“ heißt: Zustand unverändert, `nextLoad()` liefert in keinem davon `increase_*`, `add_set` oder +Wdh.
  - Der Hinweis `no_heavier_weight` (keine schwerere Stufe vorhanden) zählt **nicht** als Stillstand, er hat seinen eigenen Hinweis.
- **Wirkung, in dieser Reihenfolge:**
  1. `stagnation_variation`: Tausch auf eine Alternative mit gleichem Bewegungsmuster, die nach den **aktuellen** Sicherheitsregeln erlaubt, am Ort machbar und **nicht schwerer** ist. Das ist dieselbe Logik wie `findSubstitute()`/`allowedAlternatives()`, bevorzugt nach `priority`. Der Tausch gilt für die künftigen Einheiten des Blocks ab morgen, ohne Einheiten mit Eintrag (S1). Die neue Übung hat ihren eigenen Verlauf (Kalibrierung bzw. eigenes Startgewicht wie in Phase 4).
  2. Gibt es keine Alternative oder wurde die Übung in diesem Block schon einmal getauscht (höchstens 1 Tausch je Übung und Block): `deload_forward` nach der Tausch-Regel oben (inkl. aller Bedingungen und Invarianten).
  3. Sonst nur ein Hinweis.
- Körpergewicht-Übungen mit Hinweis `harder_variant` (Phase 4): kein Tausch durch R4. Der Variante-Hinweis hat Vorrang.

**R5 `fewer_days` (Vorschlag, nur mit Bestätigung):**

- **Bedingung:**
  - Die letzten 3 **abgeschlossenen** ISO-Wochen des aktiven Plans: geschafft / geplant < 0,7.
  - Geschafft heißt `completed`, auch `partial` zählt als geschafft. Geplant heißt alle Einheiten der Wochen ohne „entfallen“.
  - Erholungswochen zählen mit, Einstiegswoche und Woche 0 nicht.
  - Mindestens 3 geplante Einheiten im Fenster.
- **Wirkung:** Vorschlag „auf X−1 Trainingstage umstellen“, wobei der Tag mit den meisten Ausfällen wegfällt (Anzeige mit Begründung).
- **Nicht bei:** einem Trainingstag pro Woche (dann nur der Hinweis „Kürzere Einheiten?“ ohne Plan-Änderung), Ruhezeit 28 Tage nach Ablehnung, offenem Vorschlag.

**Reserviert (in 4b nicht aktiv, nur Typ und Schutzgrenzen):**

- **`calorie_adjust`:** `clampCalorieAdjustment(current, proposed, { tdee, bmr, weightKg })` in **`packages/core/src/nutrition/limits.ts`** (neuer Ordner, Wächter K1). Dort baut Phase 5 die Ernährungs-Engine weiter, so gibt es die Schutzgrenzen-Logik nur einmal; `adjust/` ruft sie nur auf. Reine Funktion mit Tests, damit Phase 5 nur noch anschließt. Grenzen:
  - Defizit höchstens `MAX_CALORIE_DEFICIT_FRACTION` × Gesamtumsatz,
  - nie unter Grundumsatz × `MIN_INTAKE_RELATIVE_TO_BMR`,
  - Gewichtsverlust-Ziel höchstens `MAX_WEEKLY_WEIGHT_LOSS_FRACTION`,
  - Schritt je Anpassung ±`LIVE_ADJUSTMENT.calorieStepKcal` (100–150 kcal, PRODUKTENTSCHEIDUNG),
  - **nicht abschaltbar**.
- **`muscle_gain_volume`, `readiness_lighter`:** nur in den Enums.

### 5.3 Reihenfolge und Konflikte (`adjust/engine.ts`)

- `computeLiveAdjustments(inputs) → AdjustmentProposal[]`.
- **Je Übung höchstens eine Zustands-Vorgabe:** R2 vor R1. Senken schlägt Steigern.
- **Je Woche höchstens eine Plan-Änderung je Art:** `deload_forward` schlägt `volume_reduce`, und `volume_reduce` schlägt Einzeltausch in derselben Woche nicht aus.
- **Zum Schluss** prüft `checkWeekInvariants(planNachher, carried)` alle Invarianten der Tausch-Regel (5.2 Punkt 6) über den ganzen Vorschlags-Satz. Hält eine nicht, fällt `deload_forward` weg und der Fallback (5.2 Punkt 7) greift.
- **Höchstens `LIVE_ADJUSTMENT.maxAutomaticPerWeek` (3) automatische Änderungen je Person und Woche.** Darüber hinaus werden nur Hinweise erzeugt. Das schützt vor einem Plan, der sich ständig ändert.
- `inputFingerprint(proposal)` ist ein stabiler Hash aus Regel, Übung bzw. Einheiten und Basis-Eintrag(en), `canonicalJson` wie in `content/validate`.

### 5.4 Anwendung in der Anzeige (`adjust/apply.ts`)

- `activeStateOverride(exerciseId, adjustments, latestCountingEntry)` liefert die Vorgabe nur, wenn Status `applied`/`confirmed`, Art `state_override`, `basis_session_log_id` = Eintrag-ID des neuesten zählenden Eintrags.
- `progressFromLogs(..., { stateOverride })` bekommt eine neue Option: Mit Vorgabe ersetzt sie das Ergebnis von `nextLoad()`. Danach laufen wie bisher Orts-Rundung (`effective`), Wiedereinstieg und Anzeige-Regeln. Der Rohwert ist die Vorgabe. Bei R2 bewusst abwärts, das ist die einzige Stelle, an der der Zustand sinken darf, und nur über Premium.
- `buildExerciseLogEntry()` speichert die Vorgabe als `state_*`. Die Kette läuft danach normal weiter.
- `restoreTemporaryChanges(sessions, adjustments)`: Vor `baseSessionsFromBlock()` werden vorübergehende Plan-Änderungen (`volume_reduce`, `endurance_reduce`, `deload_forward`) auf `change_before` zurückgesetzt. Sonst würde der Folgeblock die reduzierten Werte dauerhaft erben. Ein Tausch aus R4 bleibt erhalten (bewusst dauerhaft für den Block). Ausdauer: Der 10-%-Bezug nimmt weiter das tatsächlich Trainierte (vorsichtig, Phase 4, 5.3).
- `adjustmentMarks(session, adjustments)` liefert Kennzeichen für die Anzeige („angepasst“ je Einheit bzw. Übung).
- **PDF-Export:** `training-plan-document.ts` bekommt die angepassten `ProgressResult`s automatisch über die App. Es gibt **keine** Begründung im PDF. Optional bekommt die Spalte „Vorgabe“ eine neutrale Markierung „angepasst“ (Datenschutz-Linie B1 aus `PLAN-PDF-EXPORT.md`: keine Gründe, keine Flags).

### 5.5 Erklärungen (`adjust/explain.ts`)

- `explainAdjustment(adj) → { key, params }` mit festen Schlüsseln, z. B.:
  - `load_reduce`: „Bankdrücken war zweimal deutlich zu schwer – heute {weight} kg statt {before} kg.“
  - `fewer_days`: „Du hast in den letzten 3 Wochen {done} von {planned} Einheiten geschafft. Möchtest du auf {days} Tage umstellen?“
- Die Texte liegen in `apps/mobile/src/i18n/de.ts`, Bereich `adjust`. `params` sind nur Zahlen, Datumsangaben und Übungsnamen aus der Bibliothek.
- **Keine Gesundheitsbegriffe**, keine Aussage über den Körper, nur über das Training.
- Test: Jeder Schlüssel aus `adjustment_rule` hat einen Text, und kein Text enthält verbotene Wörter (Liste wie `content/text-rules.ts`: „Krankheit“, „Schmerz“, „Verletzung“ …).

### 5.6 Grenzwerte in `constants.ts` (Konstante `LIVE_ADJUSTMENT`)

| Wert                           | Start                                                                                                                          | Quelle / Einordnung                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fastIncrease.rpeBelowTarget`  | 2 (≥ 2 Wdh. mehr in Reserve als geplant), alle Sätze mit RPE                                                                   | Helms ER, Cronin J, Storey A, Zourdos MC (2016), Strength Cond J 38(4):42–49 (RIR-basierte Autoregulation); Zourdos et al. (2016), schon zitiert; Wert PRODUKTENTSCHEIDUNG                                               |
| `fastIncrease.excluded`        | vorsichtig, < 18, ≥ 65, Einsteiger im 1. Block                                                                                 | CLAUDE.md Sicherheitsregeln; PRODUKTENTSCHEIDUNG                                                                                                                                                                         |
| `loadReduce`                   | 2 Einheiten in Folge, ≥ 50 % der Sätze verfehlt bzw. RPE ≥ Ziel + 1,5; Faktor 0,9; Ruhezeit 14 Tage                            | Helms et al. (2016); Faktor wie `DELOAD_DOSAGE.loadFactor`; PRODUKTENTSCHEIDUNG                                                                                                                                          |
| `highSessionLoad`              | `session_rpe` ≥ 9 in 3 Kraft-Einheiten binnen 14 Tagen; Sätze −1 für 1 Woche; Erholungswoche ≤ 2 Wochen entfernt → nur Hinweis | Foster C (1998), Med Sci Sports Exerc 30(7):1164–1168 (Session-RPE, Belastungsüberwachung); Foster et al. (2001), schon zitiert; Bell L et al. (2023), Sports Med Open 9:87 (Delphi-Konsens Deload); PRODUKTENTSCHEIDUNG |
| `enduranceReduce`              | 2 von 3 Einheiten mit Anstrengung ≥ 7 (`effortAtLeast`, alle Ziele sind 1–4); Minuten × 0,85 für 1 Woche                       | Seiler S (2010), Int J Sports Physiol Perform 5(3):276–291 (Intensitätsverteilung); Foster (1998); PRODUKTENTSCHEIDUNG                                                                                                   |
| `stagnation`                   | ≥ 3 zählende Einträge über ≥ 21 Tage ohne Schritt; höchstens 1 Tausch je Übung und Block                                       | KONZEPT 4.1 („ca. 3 Wochen“); Kassiano W et al. (2022), J Strength Cond Res 36(6):1753–1762 (Übungsvariation); PRODUKTENTSCHEIDUNG                                                                                       |
| `adherence`                    | 3 abgeschlossene Wochen, < 70 %, ≥ 3 geplante Einheiten; Ruhezeit nach Ablehnung 28 Tage; Vorschlag verfällt nach 14 Tagen     | KONZEPT 4.1; PRODUKTENTSCHEIDUNG (keine belastbare Studie)                                                                                                                                                               |
| `maxAutomaticPerWeek`          | 3                                                                                                                              | PRODUKTENTSCHEIDUNG (Plan-Ruhe, Verständlichkeit)                                                                                                                                                                        |
| `cooldownDaysAfterRevert`      | 14                                                                                                                             | PRODUKTENTSCHEIDUNG                                                                                                                                                                                                      |
| `lookbackDays`                 | 42                                                                                                                             | PRODUKTENTSCHEIDUNG (deckt 3 Wochen + Block-Rand ab)                                                                                                                                                                     |
| `deloadForward`                | nur wenn Erholungswoche ≥ 2 Wochen nach der nächsten Woche; höchstens 1 je Block; Dosierung der getauschten Woche = Vorwoche   | `DELOAD_SCHEDULE`/`DELOAD_DOSAGE` (Bell et al. 2023, schon zitiert); PRODUKTENTSCHEIDUNG                                                                                                                                 |
| `recompute.maxPerUserPerHour`  | 20                                                                                                                             | PRODUKTENTSCHEIDUNG (Missbrauchsschutz der API-Route); gleicher Wert als SQL-Konstante in `claim_adjustment_events`                                                                                                      |
| `calorieStepKcal` (reserviert) | 100–150 kcal je Schritt, Phase 5                                                                                               | PRODUKTENTSCHEIDUNG; Schutzgrenzen aus CLAUDE.md unverändert                                                                                                                                                             |

Alle PRODUKTENTSCHEIDUNG-Werte gehen in die fachliche Prüfung vor dem Launch (Frage 11).

### 5.7 Zod-Schemas (`adjust/schemas.ts`)

- `adjustmentProposalSchema` (strikt, je `rule` ein diskriminierter Typ für `change_before`/`change_after`) = Feldliste von `apply_plan_adjustments`.
- `stateOverrideSchema` = `ExerciseProgress`.
- `explainParamsSchema` erlaubt nur Zahlen, Datumsangaben und `exercise_id`, keinen Freitext.

### 5.8 Tests und Grenzfälle

**R1:**

- alle Sätze `reps_max` mit RPE ≤ Ziel − 2 → Sprung nach einer Einheit
- ein Satz ohne RPE → kein R1
- vorsichtiger Plan, 16 und 95 Jahre → nie R1
- großer Sprung (Kurzhantel 4 → 6 kg) → weiter nur über Puffer
- 500-kg-Deckel

**R2:**

- genau 50 % verfehlt (feuert) und 49 % (feuert nicht)
- nur einmal verfehlt → nichts
- Ruhezeit 13 bzw. 14 Tage
- Abrunden auf die eigene Stufe, kleinste Stufe als Boden
- Halteübung 10 s als Boden
- Person hat selbst leichter trainiert → kein R2
- Langhantel mit `barbellLoadSteps()`
- zu Hause vs. Studio (Orts-Rundung verfälscht nichts, Rohwert-Regel aus Phase 4 Festlegung 1)

**R3:**

- `session_rpe` 9/9/9 → Sätze −1
- 9/9/8 → nichts
- Erholungswoche in 2 bzw. 3 Wochen
- zweimal in Folge → Erholungswoche vorziehen samt Tausch der ursprünglichen
- 1 vs. 7 Trainingstage
- Satz-Untergrenze
- Ausdauer: Anstrengung 6 (nichts) bzw. 7 (feuert); Minimum-Minuten `minSessionMinutes`; Folgewochen nur gesenkt

**Tausch-Regel `deload_forward`:**

- Einsteiger (`L` = 5) und Fortgeschrittene/vorsichtig (`L` = 4); `D − n` = 1 (kein Tausch, Fallback) bzw. 2 (Tausch)
- zweiter `deload_forward` im selben Block → Fallback `volume_reduce`
- getauschte Woche `D` hat exakt die Sätze, `rpe_target` und Minuten von `D − 1`
- Woche `n + 1` Ausdauer ≤ `floor(1,1 × Woche k)`, nicht `1,1 × Woche n`
- Folgeblock mit `carriedLoadWeeks`: Belastungswochen über die Blockgrenze genau `L`; ohne Live-Anpassung `carriedLoadWeeks = 0` und Folgeblock identisch mit heute
- Plan mit Ausdauer **und** Kraft gemischt; nur Ausdauer; nur Kraft
- Rückgängig: nur als Ganzes, nicht mehr nach Beginn einer der Wochen
- `append_plan_block`-Regel (pgTAP): Folgeblock mit `L + 1` Belastungswochen in Folge wird abgelehnt; erster Block mit Woche 0 + `L` Belastungswochen ist gültig
- **Regressionstest (S-n1):** alle heute erzeugbaren Pläne – jedes Level, vorsichtig ja/nein, 1–7 Tage, Start an jedem Wochentag (mit und ohne Woche 0), mit und ohne Ausdauer, plus drei Folgeblöcke über `nextPlanBlock()` – erfüllen `checkWeekInvariants()` ohne jede Live-Anpassung. Dieselben Pläne als Fixtures auch in `22_week_invariants.test.sql`

**Laufende Einheit (S1):**

- Einheit heute, Entwurf offline gespeichert → R4-Tausch betrifft sie nicht; „Entwurf vor Tausch → Speichern weiterhin ok“ (Core-Test mit `eligiblePlannedSessions` plus pgTAP mit `save_session_log` nach `apply_plan_adjustments`)
- Einheit morgen mit schon vorhandenem Eintrag (zweites Gerät) → nicht betroffen
- `effective_from` heute → vom Server abgelehnt

**R4:**

- 20 vs. 21 Tage
- 2 vs. 3 Einträge
- `no_heavier_weight` ist kein Stillstand
- Alternative nach Sicherheitsregel gesperrt → nächste bzw. Erholungswoche
- zweiter Tausch im Block → kein Tausch
- Körpergewicht mit `harder_variant` → kein Tausch

**R5:**

- 69 % vs. 70 %
- 1 Trainingstag
- Einstiegswoche ausgeklammert
- Ablehnung → 28 Tage Ruhe
- abgelaufener Vorschlag

**Konflikte:**

- R1 und R2 für dieselbe Übung → R2
- 4 automatische Änderungen in einer Woche → nur 3
- Idempotenz: gleicher Fingerprint → keine zweite Anpassung

**Anwendung:**

- Zustands-Vorgabe veraltet (neuerer Eintrag vom zweiten Gerät) → ignoriert
- Vorgabe wird als `state_*` gespeichert und die Kette läuft weiter
- Rückgängig vor dem nächsten Eintrag
- `restoreTemporaryChanges()`: Folgeblock erbt keine reduzierten Sätze bzw. Minuten, ein Tausch bleibt

**Sicherheit nach Anpassung:**

- Sicherheitsregeln greifen zuletzt (RPE-Deckel 7 bei vorsichtigem Plan auch nach R1)

**Eigenschaftstest** über 300 zufällige Eintragsfolgen mit Ausreißern:

- nie Gewicht > 10 % über dem schwersten Satz der letzten zählenden Einheit ohne Puffer bzw. Bestätigung
- nie unter 0,5 kg bzw. unter die kleinste Stufe
- nie mehr als 3 automatische Änderungen je Woche
- nie eine Änderung an Einheiten von heute oder früher, nicht `planned` oder mit Eintrag
- Gratis-Eingaben (`entitled = false`) ergeben immer genau das Phase-4-Ergebnis

**Eigenschaftstest Wochen-Invarianten** (Wächter B2) über 300 zufällige Pläne (Level, vorsichtig ja/nein, 1–7 Tage, mit und ohne Ausdauer) mit zufälligen R3/R4-Auslösern, danach `restoreTemporaryChanges()` und Folgeblock über `nextPlanBlock({ carriedLoadWeeks })`, geprüft über **beide** Blöcke:

- nie mehr als `L` Belastungswochen in Folge,
- Ausdauer-Wochenminuten jeder Belastungswoche nie > `floor(1,1 × vorige Belastungswoche)`,
- jede Erholungswoche mindestens mit `DELOAD_DOSAGE` bzw. Faktor 0,6 reduziert,
- getauschte Woche nie über der Vorwoche,
- 20 feste Fälle daraus (gültig und absichtlich verletzt) liegen als `adjust/fixtures/invariants.json`. Ein Skript übersetzt sie in `supabase/tests/22_week_invariants.test.sql`; `db-sync.test.ts` prüft, dass die Datei aktuell ist. So entscheiden Core und SQL-Nachrechnung nachweislich gleich.

**Schutzgrenzen Kalorien (reserviert):**

- Defizit genau 25 % / 25,1 %
- Ziel genau Grundumsatz / darunter
- −1 %/Woche bei 45 kg und 200 kg
- Überschuss-Richtung

**CI-Zusammenfassung:** `packages/content/src/plan-examples.ts` bekommt „Beispiel-Anpassungen“. Für drei Test-Personen gibt es je eine ausgedachte Folge mit der Anpassung und ihrem Erklärsatz, so ist Etappe A am Handy sichtbar.

---

## 6. Server (`apps/web`)

### 6.1 Routen

- **`POST /api/live-anpassung`** (Authorization: Bearer = Supabase-JWT):
  1. Token prüfen (`supabase.auth.getUser`).
  2. `has_entitlement` und Flag prüfen. Ohne beides gibt es `204` ohne Rechnen.
  3. - 4. `claim_adjustment_events(uid)`: zählt zugleich die Ratenbegrenzung im geteilten Zähler `private.live_adjust_hourly_counts` (4.6 Punkt 7, Wächter S3). Bei `rate_limited` antwortet die Route `429` mit festem Code; die App versucht es beim nächsten Sync still erneut. Ein Zähler im Speicher der Route wäre auf Vercel (mehrere Instanzen) nicht verlässlich und wird **nicht** verwendet.
  4. Daten mit dem Nutzer-Token laden (RLS).
  5. `computeLiveAdjustments()`.
  6. `apply_plan_adjustments` (Service-Rolle).
  7. Ereignisse als erledigt markieren.
  - Antwort `{ applied: n, pending: m }` ohne Inhalte. Die App lädt danach normal.
- **`POST /api/live-anpassung/sweep`** (Header `x-sweep-secret` = `LIVE_ADJUST_SWEEP_SECRET`, Vergleich in konstanter Zeit):
  - holt Ereignisse aller Personen in Paketen, rechnet mit der Service-Rolle,
  - Laufzeitgrenze 50 s, danach Rest beim nächsten Lauf,
  - ruft `expire_plan_adjustments()` und das Aufräumen alter Ereignisse auf.
- Beide Routen: `preferredRegion = 'fra1'`, keine Nutzerdaten in Logs oder Fehlermeldungen, Fehler als feste Codes.
- **Nur in Production** (Wächter B1): Bei `VERCEL_ENV !== 'production'` antworten beide Routen `404`, auch wenn der Service-Schlüssel gesetzt ist. In Vorschauen testet ihr die Live-Anpassung über den Testmodus (8.1). Test: Route mit `VERCEL_ENV=preview` → 404 ohne Datenbank-Aufruf.
- **CORS** (Wächter S4): Der Web-Export der App läuft im Vercel-Projekt „fitnessapp“, die Route im Projekt „Web“ – also eine andere Herkunft.
  - `OPTIONS`-Antwort und `Access-Control-Allow-Origin` nur für die eigene App-Domain (`APP_WEB_ORIGIN`) und das Vorschau-Muster des Projekts „fitnessapp“ (`https://fitnessapp-*-<team>.vercel.app`, als feste Regex in `ALLOWED_APP_ORIGINS`). Andere Herkünfte bekommen keine CORS-Kopfzeilen.
  - Erlaubt: Methode `POST`, Kopfzeilen `Authorization` und `Content-Type`. **Keine Cookies** (`Access-Control-Allow-Credentials` fehlt), `Vary: Origin`.
  - Die native App sendet keinen `Origin`; dort ist CORS ohne Bedeutung, das Token entscheidet.
  - Die Sweep-Route hat **kein** CORS (nur der Workflow ruft sie auf).
  - Tests: erlaubte Herkunft, Vorschau-Herkunft, fremde Herkunft (keine Kopfzeilen), Vorabanfrage `OPTIONS`.

### 6.2 GitHub Action `live-adjust-sweep.yml`

- Läuft stündlich (`schedule`) und per Hand („Run workflow“).
- Ruft die Sweep-Route mit Secret `LIVE_ADJUST_SWEEP_SECRET` und Variable `WEB_URL` auf.
- Ohne Secret überspringt er freundlich (Muster aller Workflows).
- Zusammenfassung: Anzahl verarbeitet, offen, Fehlercodes, keine Inhalte.

### 6.3 Beta-Freischaltung per GitHub-Workflow `beta-grant.yml` (statt Admin-Seite, Wächter B1)

**Warum keine Admin-Seite:** Der Admin-Bereich läuft mit Zugang Stufe A (ein geteiltes Passwort, gilt auch in Vorschauen). Diese Stufe wurde in PLAN-PHASE-2 ausdrücklich nur gewählt, weil sie **keine Nutzerdaten** zeigt. Eine E-Mail-Suche über alle Konten und das Vergeben von Rechten brauchen persönliche Konten, Schutz vor Fehlversuchen und ein Protokoll, wer gehandelt hat (Art. 32 DSGVO). Der Workflow erfüllt das ohne neue Oberfläche: Nur wer Schreibrechte am Repository hat, kann ihn starten, und GitHub merkt sich, wer ihn gestartet hat.

- **Start:** GitHub-App → Repository → Actions → `beta-grant` → „Run workflow“ (manuell, `workflow_dispatch`).
- **Eingaben:**
  - `aktion`: Auswahl `freischalten`, `entziehen`, `flag_an`, `flag_aus`, `status`,
  - `email`: nur bei freischalten bzw. entziehen,
  - `tage`: Standard 90, höchstens 180.
- **Ablauf:** ruft per `curl` die Funktion `public.beta_admin(...)` (4.6 Punkt 10) mit den vorhandenen GitHub-Secrets `SUPABASE_URL` und `SUPABASE_SECRET_KEY` auf (Muster `waitlist-cleanup.yml`). `p_actor` = `${{ github.actor }}`.
- **Kein Personenbezug in der Ausgabe:** Die E-Mail wird zu Beginn mit `::add-mask::` maskiert und nie ausgegeben. Die Zusammenfassung zeigt nur feste Codes und Zahlen, z. B. „Freischaltung gesetzt, gültig bis 04.01.2027“ oder „Kein Konto mit dieser E-Mail“. Hinweis: Die Eingabe selbst sehen in der Lauf-Ansicht nur Personen mit Zugriff auf das (private) Repository – also nur ihr.
- **Protokoll:** jede Aktion in `private.admin_actions` (GitHub-Name, Aktion, Zeitpunkt) zusätzlich zum Lauf-Verlauf in GitHub.
- **Ohne Secrets** endet der Workflow grün mit Hinweis (Muster aller Workflows).
- **Sichere Eingaben und Secrets (Wächter Runde 2, S-n2), verbindlich:**
  - Alle Eingaben und `github.actor` kommen **nur über `env:`** ins Skript, nie als `${{ inputs.* }}` oder `${{ github.actor }}` im `run`-Text (die E-Mail ist ein freier Text).
  - Die E-Mail wird **vor jeder Ausgabe** gegen `^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$` geprüft (ohne Zeilenumbruch). Passt sie nicht: Abbruch mit festem Text ohne Echo. **Erst danach** `::add-mask::`, damit kein Zeilenumbruch eigene Workflow-Befehle einschleust.
  - `aktion` ist ein `choice`-Feld; `tage` wird als ganze Zahl 1–180 geprüft.
  - Das JSON für den Aufruf baut `jq -n --arg … --argjson …`, keine zusammengesetzten Zeichenketten.
  - `curl --fail-with-body`; die Antwort geht nur über `jq` mit festen Feldern (`result`, `expires_on`, Zahlen) in die Zusammenfassung, nie ungefiltert.
  - `SUPABASE_SECRET_KEY` steht nur im Aufruf-Schritt (`env:` dieses Schritts), Kopfzeilen in einer Datei mit `umask 077` (Muster `waitlist-cleanup`).
  - `permissions: contents: read`, alle Actions auf Commit-SHA festgelegt (wie Etappe E), `concurrency: beta-grant` ohne Abbruch laufender Läufe.
- **K-n1:** `status` zeigt die Zahl aktiver Freischaltungen. Bei zwei Gründern ist das faktisch personenbezogen, aber nur im privaten Repository sichtbar und damit unkritisch.
- **`status`** liefert die Kennzahlen ohne Personenbezug: Flag an/aus, aktive Freischaltungen, offene Ereignisse, Fehlversuche ≥ 5, Anpassungen je Regel in den letzten 7 Tagen.
- Der Workflow ist zugleich das Vorbild für den in PLAN-PHASE-2 geplanten `admin-grant`.

**Spätere Option (nicht in 4b):** eine Admin-Seite `/admin/premium-test` erst mit **Login Stufe B** (E-Mail-Code über Supabase Auth, Prüfung von `admin_users` auf dem Server, jede Aktion mit `auth.uid()` des Admins protokolliert) und nur in Production. Sinnvoll, sobald mehr Personen freischalten sollen oder Phase 7 Support-Werkzeuge braucht (Frage 13).

### 6.4 Neue Umgebungsvariablen (`.env.example`, SETUP.md)

| Name                                  | Wo                                                              | Bemerkung                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LIVE_ADJUST_SWEEP_SECRET`            | Vercel-Projekt „Web“ (**nur Production**) **und** GitHub Secret | mind. 32 zufällige Zeichen                                                                                                                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`           | Vercel „Web“                                                    | schon vorhanden (Warteliste, Production + Preview). Nicht ausgeweitet: Die neuen Routen sind in Vorschauen per `VERCEL_ENV` gesperrt (6.1).                                  |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | GitHub Secrets                                                  | schon vorhanden (`waitlist-cleanup`), neu auch von `beta-grant` genutzt. `live-adjust-sweep` braucht sie nicht (nur `WEB_URL` und Sweep-Secret).                             |
| `APP_WEB_ORIGIN`                      | Vercel „Web“                                                    | nicht geheim; Adresse des App-Web-Exports (Projekt „fitnessapp“) für CORS                                                                                                    |
| `WEB_URL`                             | GitHub Variable                                                 | nicht geheim                                                                                                                                                                 |
| `EXPO_PUBLIC_WEB_URL`                 | Vercel-Projekt „fitnessapp“ und EAS (`eas.json`/Expo-Umgebung)  | nicht geheim; Adresse von `apps/web`, an die die App `POST /api/live-anpassung` sendet (Wächter S4). Fehlt sie, ruft die App die Route nicht auf (still, wie „Premium aus“). |

---

## 7. Benachrichtigungen (gratis, Etappe E)

- **Paket:** `expo-notifications`, Konfig-Plugin in `app.config.ts`, Android-Kanal „Erinnerungen“.
  - **Nur lokale Benachrichtigungen**: Sie werden auf dem Gerät geplant. Es gibt keinen Push-Token, keinen Server und keinen Versand über Expo, Apple oder Google mit Nutzerbezug.
  - Lokale Benachrichtigungen laufen auch in Expo Go. Für TestFlight bzw. APK reicht ein neuer EAS-Build.
- **Mess-Erinnerung:**
  - Aus `measurement_reminders.next_due_on` und `enabled` wird eine Benachrichtigung am Fälligkeitstag um 08:00 Uhr Ortszeit geplant (Frage 9).
  - Neu geplant wird beim App-Start, nach dem Speichern einer Messung (`nextMeasurementDue()`) und bei Änderung des Abstands.
  - Text: „Alpha5: Zeit für dein Mess-Update“, ohne Werte.
  - Das Antippen öffnet die Messung.
  - Ausschalten in den Einstellungen setzt `enabled = false` und storniert die Benachrichtigung.
  - **Nur mit gültiger `health_data`-Einwilligung** (Wächter S5): Ohne Einwilligung kann man nicht messen, eine Erinnerung wäre sinnlos. `notificationSchedule()` bekommt `healthConsentValid` und liefert ohne Einwilligung `null`.
    - Beim Widerruf von `health_data` storniert die App die geplante Mess-Erinnerung sofort (im selben Ablauf, der `healthPlanCache` leert).
    - `measurement_reminders.enabled` bleibt unverändert (kein Gesundheitsdatum, die heutige Server-Logik fasst die Tabelle beim Widerruf nicht an). Wird die Einwilligung später erneut erteilt, plant die App die Erinnerung beim nächsten Start wieder ein.
  - **Standard** (Frage 16): `measurement_reminders.enabled` ist heute standardmäßig an (Hinweis auf „Heute“). Die **Benachrichtigung über das Betriebssystem** ist dagegen eine eigene Geräte-Einstellung und standardmäßig **aus** (Opt-in). Angeboten wird sie einmal direkt nach der ersten gespeicherten Messung („Sollen wir dich in 28 Tagen erinnern?“); erst bei „Ja“ kommt die System-Erlaubnis. Danach jederzeit in den Einstellungen.
  - **Abweichung von PROMPTS** („Mess-Erinnerungen per Push“): lokal statt Server-Push, datensparsamer (Frage 8). Wird in KONZEPT 12 festgehalten.
- **Pausenende:**
  - Geht die App während einer laufenden Pause in den Hintergrund, plant sie eine Benachrichtigung zum Endzeitpunkt (Zeitstempel aus `rest-timer.ts`).
  - Zurück im Vordergrund, bei Überspringen oder bei ±15 s wird storniert bzw. neu geplant.
  - Text: „Pause vorbei – nächster Satz“.
- **Erlaubnis:**
  - Erst beim ersten Bedarf gefragt, mit kurzer Erklärung vorab („Wir erinnern dich ans Messen und ans Pausenende – nichts sonst.“). Erster Bedarf = „Ja“ nach der ersten Messung bzw. Einschalten in den Einstellungen, oder der erste Start des Trainingsmodus (einmalig: „Pausenende melden, wenn das Handy gesperrt ist?“). Auf Android 13+ und iOS also nie schon beim App-Start oder im Onboarding (Frage 16).
  - Ablehnen ist folgenlos. Es bleibt beim Hinweis auf „Heute“, der schon aus Phase 1 da ist.
- **Browser:** keine Benachrichtigungen, nur der Hinweis in der App und die sichtbare Pausen-Leiste.
- **Abmelden und Konto löschen:** alle geplanten Benachrichtigungen stornieren.
- **Core (gehört zu Etappe E, nicht A – Wächter K3):** `notificationSchedule(reminder, today, tz, healthConsentValid)` und `restEndNotificationAt(timer)` als reine Funktionen in `packages/core/src/notifications.ts` mit Tests:
  - Sommerzeit,
  - Fälligkeit heute nach 08:00 → sofort bzw. nächster Morgen (Festlegung im Test),
  - `enabled = false`,
  - ohne `health_data`-Einwilligung → `null`,
  - Abstand 7 bzw. 90 Tage.

---

## 8. App (`apps/mobile`, Web-Export und nativ gleich)

### 8.1 Bildschirme

1. **„Heute“ und Trainingsmodus:**
   - Angepasste Vorgaben tragen ein dezentes Kennzeichen „angepasst“ mit Link zur Erklärung.
   - Ein offener Vorschlag (R5) erscheint als Karte oben: „Weniger Trainingstage?“ mit „Ansehen“.
2. **„Warum hat sich mein Plan geändert?“** (neu `app/plan/changes.tsx`, erreichbar über den Plan und das Kennzeichen):
   - Liste nach Wochen, je Eintrag Datum, Erklärsatz (5.5) und vorher → nachher.
   - Knopf **„Rückgängig“**, solange erlaubt (4.6 Punkt 5). Danach steht dort „Nicht mehr rückgängig machbar, weil du schon trainiert hast“.
   - Leer: „Noch keine Anpassungen – dein Plan läuft wie geplant.“
3. **Bestätigungs-Dialog „Weniger Trainingstage“:**
   - zeigt Zahlen, den vorgeschlagenen wegfallenden Tag (änderbar) und den Hinweis, dass ein neuer Plan entsteht und das Tagebuch bleibt.
   - „Umstellen“ sendet zuerst die `LogQueue` (H-b aus Phase 4), dann `save_training_plan` mit den neuen Trainingstagen, dann `confirm_plan_adjustment(id, true)`.
   - „Nein danke“ → `confirm_plan_adjustment(id, false)`.
   - Nur online.
4. **Einstellungen:**
   - Abschnitt „Live-Anpassung (Premium)“ mit Status aus `live_adjustment_status()`. Bei `flag_off` wird der Abschnitt bis Phase 7 ausgeblendet (Frage 2).
   - Abschnitt „Benachrichtigungen“ mit Mess-Erinnerung und Pausenende.
5. **Testmodus:**
   - Schalter „Premium simulieren (nur Test)“. Technisch nur bei `backend.mode === 'local'` (Wächter K2): Der Schalter-Zustand lebt ausschließlich in `local-backend.ts`/`localDb`; `supabase-backend.ts` hat dafür weder Feld noch Funktion, und die Einstellungen zeigen ihn nur im Testmodus. Test: Im Supabase-Modus ist der Schalter nicht sichtbar und `live_adjustment_status()` kommt immer vom Server.
   - `local-backend.ts` rechnet nach `save_session_log` dieselben Regeln lokal (`computeLiveAdjustments`) und speichert `plan_adjustments` in `localDb`. Gleiche Prüfungen wie `apply_plan_adjustments` stehen in `local-rules.ts`.
   - So ist alles im Vercel-Vorschau-Link ohne Supabase testbar.

### 8.2 Ablauf nach dem Sync

Die Reihenfolge erweitert W8 aus Phase 4:

1. normale `SyncQueue`
2. `LogQueue`
3. `close_missed_sessions()`
4. **`POST /api/live-anpassung`** (nur wenn `live_adjustment_status().active`; Fehler = still später, nie blockierend)
5. Neu laden von `plan_adjustments` und Plan

Offline gilt die zuletzt geladene Anpassung weiter, und die Anzeige rechnet mit ihr (5.4).

### 8.3 Offline

- `plan_adjustments` liegen im **geschützten** Zwischenspeicher, nicht im unverschlüsselten `rowsCache`. Grund: Anpassungen aus Gesundheits-Plänen sind mittelbar Gesundheitsdaten. Empfehlung: ein eigener `ProtectedStore` `adjustCache` oder Teil des Plan-Caches `healthPlanCache`, der beim Widerruf ohnehin geleert wird.
- Bestätigen, Rückgängig und Neu berechnen gehen **nur online** („Dafür brauchst du kurz Verbindung.“).
- Zwei Geräte: Die Server-Revision gilt. Eine Vorgabe ohne passenden Basis-Eintrag wird ignoriert (4.2).

### 8.4 Zustände

| Zustand                       | Anzeige                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Laden                         | `LoadingState`                                                                                 |
| Keine Anpassungen             | „Noch keine Anpassungen – dein Plan läuft wie geplant.“                                        |
| Neu berechnen gescheitert     | still, erneuter Versuch beim nächsten Sync; kein Fehler-Banner (der Plan bleibt gültig)        |
| Vorschlag abgelaufen          | „Dieser Vorschlag ist nicht mehr aktuell.“                                                     |
| Rückgängig nicht mehr möglich | „Nicht mehr rückgängig machbar, weil du schon trainiert hast.“                                 |
| Premium beendet               | Anpassungen bleiben sichtbar, Hinweis „Neue Anpassungen gibt es mit Premium“ (erst ab Phase 7) |
| Offline                       | „Dafür brauchst du kurz Verbindung.“ bei Bestätigen und Rückgängig                             |
| Benachrichtigung abgelehnt    | Hinweis in den Einstellungen, wie man sie in den System-Einstellungen erlaubt                  |

### 8.5 Barrierefreiheit und Texte

- Das Kennzeichen „angepasst“ ist nie nur Farbe, sondern Symbol plus Wort. Der Bildschirmleser sagt „Gewicht angepasst von 25 auf 22,5 Kilogramm“.
- Alle Texte deutsch in `de.ts` (Bereiche `adjust`, `notifications`), feste Textbausteine, keine KI.

---

## 9. Datenschutz (DSGVO)

- **Einordnung:** Anpassungen aus Trainingsdaten sind Trainingsdaten wie das Tagebuch (PLAN-PHASE-4 3.4). Anpassungen aus Plänen mit Gesundheits-Check (`from_health_plan`) oder mit Körperdaten (`uses_body_data`) gelten als (mittelbare) Gesundheitsdaten. Sie werden beim Widerruf gelöscht (4.7) und auf dem Gerät nur geschützt gespeichert (8.3).
- **Verarbeitung auf Vercel (neu: Gesundheitsdaten verlassen Supabase serverseitig):**
  - Region Frankfurt, keine Speicherung auf Vercel, keine Inhalte in Logs (Test).
  - Der AV-Vertrag mit Vercel ist in der Rechts-Checkliste (KONZEPT 14) schon genannt. Neu wird er für die Verarbeitung von Gesundheitsdaten im Verzeichnis der Verarbeitungstätigkeiten und in der DSFA ergänzt.
- **Keine Daten an Analytics, Werbung oder Affiliate.** Benachrichtigungen sind lokal, ohne Push-Token und ohne Werte im Text.
- **Datenminimierung:** Ereignisse und Zähler entstehen nur bei Premium und sind kurzlebig (Verarbeitung bzw. 30 Tage / 24 h). Die Beta-Freischaltung läuft ohne Oberfläche mit Nutzerdaten über den Workflow `beta-grant`; die Ausgabe enthält keine E-Mail, jede Aktion ist mit GitHub-Namen protokolliert (Art. 32: Zugriffskontrolle und Nachvollziehbarkeit).
- **Export und Löschung:** wie 4.7. Datenschutzerklärung: neuer Absatz „Automatische Plan-Anpassung (Premium)“ mit Zweck, Rechtsgrundlage (Vertrag, bei Körperdaten Einwilligung), Speicherdauer (mit dem Plan) und Widerspruch („Rückgängig“, Abo beenden).
- **Profiling (Art. 22 DSGVO):** Die Anpassungen sind automatisierte Entscheidungen ohne rechtliche oder ähnlich erhebliche Wirkung. Große Änderungen gibt es nur nach Bestätigung, kleine sind rückgängig machbar und erklärt. In der DSFA festhalten (Phase 12).

---

## 10. Etappen (je ein Pull Request, jede mit Wächter-Prüfung)

**A0 – Umzug der Zeilen-Abbildung (klein, Wächter S6)**

- Inhalt: `apps/mobile/src/data/log-rows.ts` und die Zeilen-Abbildung aus `training-plan.ts` als reine Funktionen nach `packages/core/src/log/rows.ts` (Tagebuch-Zeilen) bzw. `packages/core/src/plan/rows.ts` (Plan-Zeilen); die App importiert nur noch.
- _DoD:_ keine Verhaltensänderung; Schnappschuss der „Beispiel-Progression“ und alle App-Tests unverändert grün; keine Migration.
- _Umsetzungsstand A0 (umgesetzt, Pull Request offen):_
  - `packages/core/src/log/rows.ts`: der komplette Inhalt von `log-rows.ts` (Eintrag ↔ Tagebuch-Zeilen wie die Datenbank-Funktionen, `logEntriesFromRows`, `startWeightsFromRows`, `logForSession`, `mergeLogRows` …) samt Zeilen-Typen der Tagebuch-Tabellen; Funktionen generisch über die benötigten Tabellen.
  - `packages/core/src/plan/rows.ts` (statt in `log/`, weil Plan-Tabellen): `storedSessionFromRows`, `activePlan`, `allSessions`, `planSnapshot`, `profilesFor` samt Zeilen-Typen `planned_sessions`/`planned_exercises`.
  - App: `log-rows.ts` reicht nur noch weiter, `training-plan.ts` importiert; bestehende App-Tests unverändert. `row-types.test.ts` prüft zur Übersetzungszeit, dass die Zeilen-Typen im Core den Datenbank-Typen gleichen.
  - Bewusst in der App geblieben: `planInputsFromRows`, `healthScreeningForPlan`, `healthPlanBasis`, `effectiveSafetyRules`, `currentSnapshot`, `planOffer` – sie hängen an der Einwilligungs-Prüfung der App (`healthConsentStatus`, Einwilligungs-Versionen); Umzug bei Bedarf in Etappe A.

**A – Core: Regel-Engine und Anwendung**

- Inhalt:
  - `adjust/` (5.1–5.7) inkl. `eligiblePlannedSessions()`, `checkWeekInvariants()`, `trailingLoadWeeks()`,
  - Option `stateOverride` in `progressFromLogs()`, Option `consecutiveSessionsForStep` in `nextLoad()` (beide Stellen in `loads.ts`),
  - Option `carriedLoadWeeks` in `nextPlanBlock()`,
  - `restoreTemporaryChanges()` vor `baseSessionsFromBlock()`,
  - `LIVE_ADJUSTMENT` mit Quellen,
  - reservierte Kalorien-Schutzgrenzen-Funktion in `nutrition/limits.ts`,
  - Invarianten-Fixtures `adjust/fixtures/invariants.json`,
  - CI-Zusammenfassung „Beispiel-Anpassungen“.
- _DoD:_
  - Alle Tests aus 5.8 grün inkl. beider Eigenschaftstests und des Regressionstests „jeder heute erzeugbare Plan erfüllt die Wochen-Invarianten“ (Woche 0 nicht gezählt, S-n1); Gratis-Eingaben ergeben unverändert das Phase-4-Ergebnis (Schnappschuss der „Beispiel-Progression“ und des Folgeblocks unverändert).
  - Keine Migration, keine sichtbare App-Änderung.
  - KONZEPT 4.1 „Umsetzung ab Phase 4b“ ergänzt (inkl. Tausch-Regel).

**B – Datenbank**

- Inhalt:
  - Enum-Migration,
  - Tabellen und Spalten aus 4.4 mit RLS, CHECKs, Indizes,
  - Funktionen aus 4.6 inkl. `beta_admin` und Ratenbegrenzung,
  - Outbox-Ergänzungen per `create or replace` in `save_session_log`, `close_missed_sessions`, `replace_training_slots` und Triggern, jeweils über `private.enqueue_adjustment_event` (nur Premium),
  - Erweiterung von `consents_after_revoke()`, `export_my_data()`, `save_training_plan` (Vorschläge `expired`), `append_plan_block` (Belastungswochen über die Blockgrenze ≤ `L`),
  - pgTAP `20_plan_adjustments.test.sql`, `21_plan_adjustment_rpcs.test.sql`, `22_week_invariants.test.sql` (aus den Fixtures) plus Ergänzungen in `04_account_deletion`, Widerrufs- und Export-Tests,
  - `database.types.ts`, `db-sync.test.ts` (inkl. SQL-Konstanten der Invarianten und der Ratenbegrenzung, Export-Schlüssel `beta_entitlement`/`adjustment_events`).
- _DoD:_
  - fremde Anpassungen unsichtbar; `authenticated` kann nicht schreiben, auch nicht die neuen Plan-Spalten;
  - `apply_plan_adjustments` nur `service_role`, ohne Flag bzw. Entitlement `not_entitled` ohne Änderung;
  - Grenzen nachgerechnet (Gewicht +10 %/−10 %, Sätze, Minuten, Tausch nur erlaubt) **und Wochen-Invarianten** (`invariant_violation` ohne Änderung);
  - nur `planned` Einheiten des aktiven Plans ab morgen ohne Eintrag; „Entwurf vor Tausch → `save_session_log` weiterhin ok“; Idempotenz;
  - Gratis-Konto erzeugt keine Ereignisse, Premium-Konto genau eines je Auslöser;
  - Ratenbegrenzung: 21. Aufruf in der Stunde → `rate_limited`;
  - `beta_admin`: nur `service_role`, Antwort ohne E-Mail und `user_id`, Protokoll in `admin_actions`, `tage` > 180 abgelehnt;
  - Export enthält Beta-Freischaltung und offene Ereignisse (K4);
  - `beta_admin`: E-Mail-Vergleich mit `lower()`, ungültiger `p_actor` bzw. ungültige E-Mail → `invalid_input` ohne Echo (S-n2);
  - Regressionstest „jeder heute erzeugbare Plan erfüllt die Invariante“ grün, **bevor** die neue Prüfung in `append_plan_block` aktiv wird; erster Block mit Woche 0 + `L` Belastungswochen gültig (S-n1);
  - Rückgängig nur solange erlaubt; Bestätigen und Ablehnen; Ablauf;
  - Widerruf löscht `from_health_plan`/`uses_body_data`;
  - Export-Abgleich H-f grün;
  - Ereignisse ohne Werte, `skip locked`;
  - `has_entitlement` mit abgelaufener Beta = false;
  - Fehler ohne Detail;
  - KONZEPT 12 „Abweichungen ab Phase 4b“.

**C – Server und Workflows**

- Inhalt: Routen 6.1 (inkl. CORS und Sperre in Vorschauen), Workflows `live-adjust-sweep.yml` (6.2) und `beta-grant.yml` (6.3), `.env.example`, SETUP.md Teil „Live-Anpassung“ (Klick-Schritte am Handy: Secret erzeugen und in Vercel und GitHub eintragen, `APP_WEB_ORIGIN` und `EXPO_PUBLIC_WEB_URL` setzen, Workflow `beta-grant` mit `flag_an` und `freischalten` für das eigene Konto starten).
- _DoD:_
  - Vitest mit gemocktem Supabase: ohne Token 401; ohne Premium nichts gerechnet; `rate_limited` → 429; Sweep mit falschem Secret 401; Laufzeitgrenze; `VERCEL_ENV=preview` → 404; CORS (erlaubt, Vorschau, fremd, `OPTIONS`); `invariant_violation` wird verworfen und nur als Code gemeldet; **kein Nutzerinhalt in `console.*`** (Test);
  - Region `fra1` gesetzt;
  - beide Workflows überspringen ohne Secret freundlich; `beta-grant` maskiert die E-Mail und gibt nur Codes und Zahlen aus (Skript-Test mit Attrappen-Antwort in `ci`);
  - `beta-grant` erfüllt alle Vorgaben aus 6.3 „Sichere Eingaben und Secrets“ (S-n2): `actionlint` in `ci` grün (keine `${{ inputs.* }}`/`${{ github.actor }}` in `run`), Mustertest (Vitest bzw. Shell) mit Zeilenumbruch, Anführungszeichen, `$(...)`, Backticks und `::`-Befehlen in der E-Mail → Abbruch ohne Echo; `tage` 0, 181 und Text → Abbruch; Secret nur im Aufruf-Schritt;
  - keine neue Admin-Seite, kein `auth.admin` in `apps/web`;
  - Live-Probe mit Supabase durch die Gründer: Training eintragen → Anpassung erscheint nach dem Sync.

**D – App**

- Inhalt: Bildschirme 8.1, Ablauf 8.2, Offline 8.3, Zustände 8.4, Testmodus „Premium simulieren“, Folgeblock mit `carriedLoadWeeks = trailingLoadWeeks(plan)`, Aufruf der Route über `EXPO_PUBLIC_WEB_URL`, Kennzeichen im PDF (optional, neutral).
- _DoD:_
  - Vitest: Reihenfolge nach dem Sync, Anpassungen nur im geschützten Speicher, Widerruf leert sie; Schalter „Premium simulieren“ nur im Testmodus (K2); Folgeblock nach `deload_forward` hält höchstens `L` Belastungswochen in Folge; ohne `EXPO_PUBLIC_WEB_URL` kein Aufruf;
  - Playwright (Testmodus, festes Datum):
    - zweimal verfehlt → Gewicht gesenkt mit Erklärung und Rückgängig,
    - drei Einheiten mit Belastung 9 → nächste Woche ein Satz weniger,
    - zwei Wochen in Folge Belastung 9 → Erholungswoche vorgezogen, frühere Erholungswoche mit Dosierung der Vorwoche,
    - Stillstand → Tausch; heutige Einheit mit offenem Entwurf bleibt unverändert und lässt sich speichern,
    - zu wenig Einheiten → Vorschlag, Umstellen erzeugt neuen Plan, Tagebuch bleibt,
    - ohne „Premium simulieren“ passiert nichts;
  - Screenshots hell und dunkel; alle Zustände aus 8.4;
  - `docs/` aktualisiert.

**E – Benachrichtigungen (gratis)**

- Inhalt: Abschnitt 7, Core-Funktionen `notificationSchedule()`/`restEndNotificationAt()` (aus A hierher verschoben, Wächter K3), `expo-notifications`, Einstellungen, Erlaubnis-Erklärung, KONZEPT 12 „lokal statt Push“.
- _DoD:_
  - Core-Tests aus Abschnitt 7;
  - Vitest für Planen, Stornieren und Neuplanen (Messung gespeichert, Abstand geändert, ausgeschaltet, Abmelden, **Widerruf `health_data` storniert die Mess-Erinnerung, erneute Einwilligung plant sie wieder** (S5), Pause übersprungen bzw. ±15 s);
  - Erlaubnis wird nie beim App-Start oder im Onboarding abgefragt;
  - Web ohne Benachrichtigung, aber mit Hinweis;
  - Geräte-Test Android-APK und TestFlight: Mess-Erinnerung (Fälligkeit testweise heute + 2 min über einen versteckten Test-Knopf nur im Testmodus) und Pausenende bei gesperrtem Bildschirm.

**Reihenfolge (überholt – siehe Gründer-Entscheidungen unten):**

- ~~A0 → A → B → C → D.~~
- **E ist unabhängig** (eigene Core-Funktionen, keine Abhängigkeit von A) und kann sofort parallel starten. Sie ist gratis und hat den größten Nutzen für alle.
- C erst nach dem Live-Test W13 aus Phase 4.

**Gründer-Entscheidung 09.10.2026 – erst ohne Supabase:** Die Testphase (Gründer + 5 Personen) läuft im Testmodus
ohne Server. Reihenfolge daher **A0 → A → D (Testmodus) → E**; B und C folgen, wenn echte Konten mit Supabase kommen.
In D rechnet die App im Testmodus die Regeln aus `packages/core/src/adjust/` direkt auf dem Gerät (nach jedem
gespeicherten Training bzw. Sync), nur mit „Premium simulieren“ (nur Testmodus, K2). Im Supabase-Modus bleibt die
Premium-Prüfung ausschließlich serverseitig (CLAUDE.md „KI-Grenze“) – ohne B/C ist die Live-Anpassung dort ausgeblendet.

**Gründer-Entscheidung 09.10.2026 – erst Übungs-Glossar und Übungstausch:** Nach A0 kommt vor der weiteren
4b-Umsetzung ein eigenes Feature „Übungs-Glossar und Übungstausch“ mit eigenem Plan
`docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md` (folgt). Danach geht 4b mit Etappe A weiter. Reihenfolge damit:
**A0 → Übungs-Glossar und Übungstausch → A → D (Testmodus) → E**; B und C wie oben später.

## 11. Definition of Done (gesamt, CLAUDE.md)

1. Typen und Zod-Schemas (`adjust/schemas.ts`, `database.types.ts`).
2. Migrationen mit RLS auf allen neuen Tabellen; `private.*` ohne Nutzerzugriff.
3. Core-Logik mit Tests inkl. Grenzfällen (sehr leicht und schwer, 16 und 95 Jahre, 1 vs. 7 Trainingstage, vorsichtiger Plan) und Eigenschaftstests (Grenzen und Wochen-Invarianten).
4. UI mobil und Web (Web ohne Benachrichtigungen, mit Hinweis).
5. Leer-, Fehler-, Lade- und Offline-Zustände.
6. Texte auf Deutsch aus festen Bausteinen.
7. `docs/` aktualisiert:
   - KONZEPT 4.1 (Umsetzung), 12 (Abweichungen), 14 (Datenschutzerklärung: Anpassung, Vercel), 15 (`has_entitlement` als Brücke),
   - PROMPTS (Status),
   - SETUP (Secrets, `APP_WEB_ORIGIN`, `EXPO_PUBLIC_WEB_URL`, Workflow `beta-grant` als Klick-Schritte am Handy),
   - Umsetzungsstand in diesem Plan.

Zusätzlich gilt: Premium-Prüfung nur auf dem Server (Funktion **und** Route), Kalorien-Schutzgrenzen als nicht abschaltbare Funktion getestet, keine Gesundheitsdaten in Logs, keine Oberfläche mit Nutzerdaten hinter dem Admin-Passwort Stufe A, Wochen-Invarianten in Core **und** SQL geprüft.

## 12. So testet ihr es am Handy

- **Etappe A0:** Pull Request → Checks → `ci` grün; in der Vorschau sieht die App genauso aus wie vorher.
- **Etappe A:** Pull Request → Checks → ci → Summary → Tabelle „Beispiel-Anpassungen“ (inkl. eines Beispiels „Erholungswoche vorgezogen“ mit Wochen-Übersicht vorher/nachher).
- **Etappe B:** Workflow `db-test` grün.
- **Etappe C:**
  1. SETUP-Schritte am Handy: Sweep-Secret in Vercel (nur Production) und GitHub eintragen, `APP_WEB_ORIGIN` und `EXPO_PUBLIC_WEB_URL` setzen.
  2. GitHub-App → Actions → `beta-grant` → Run workflow → Aktion `flag_an` → Start.
  3. Noch einmal `beta-grant` → Aktion `freischalten`, eure E-Mail, 90 Tage → Zusammenfassung „Freischaltung gesetzt, gültig bis …“ (ohne E-Mail).
  4. `beta-grant` → Aktion `status` → Zahlen prüfen.
  5. GitHub-App → Actions → `live-adjust-sweep` → Run workflow → Zusammenfassung „0 offen“.
  6. Nach dem Merge in der App (Production) ein Training eintragen → nach dem Sync erscheint ggf. „angepasst“.
- **Etappe D (Testmodus, Vorschau-Link):**
  1. „Ohne Konto testen“ → Plan mit 3 Kraft-Tagen → Einstellungen → „Premium simulieren“ an.
  2. Bei einer Übung zweimal hintereinander deutlich weniger Wiederholungen eintragen → beim nächsten Mal steht „angepasst“, das Gewicht ist niedriger → antippen → Erklärung → „Rückgängig“.
  3. Drei Einheiten mit Belastung 9 beenden → nächste Woche hat jede Übung einen Satz weniger. Eine Woche später noch einmal → „Erholungswoche vorgezogen“; im Plan ist die frühere Erholungswoche jetzt eine normale Woche mit denselben Sätzen wie die Woche davor.
  4. Eine Woche lang Einheiten verfallen lassen (Testdatum) → Karte „Weniger Trainingstage?“ → „Umstellen“ → neuer Plan, Verlauf bleibt.
  5. „Premium simulieren“ aus → keine neuen Anpassungen.
- **Etappe E (APK bzw. TestFlight):** Mess-Erinnerung in den Einstellungen an → Test-Knopf „in 2 Minuten“ → Bildschirm sperren → Benachrichtigung. Training mit Pause starten → App schließen → Benachrichtigung zum Pausenende.

## 13. Offene Fragen an die Gründer (mit Empfehlung)

1. **Wo läuft die Regel-Engine?** _Empfehlung:_ API-Route in `apps/web` auf Vercel (Region Frankfurt), dazu die Ereignis-Liste in der Datenbank und ein stündlicher GitHub-Action-Lauf als Netz (Abschnitt 3). Keine Supabase Edge Function (neues System) und keine Regeln in SQL (doppelte Logik).
2. **Premium bis Phase 7?** _Empfehlung:_ Feature-Flag `live_adjustment` plus Beta-Freischaltung einzelner Konten per Workflow `beta-grant` (mit Ablaufdatum, Frage 13). Gratis-Nutzer sehen bis zur Paywall **nichts** davon, kein Teaser. Phase 7 tauscht nur den Rumpf von `has_entitlement_for`.
3. **Kalorien-Regeln (Fettverlust, Muskelaufbau)?** _Empfehlung:_ erst mit Phase 5, weil es noch kein Kalorienziel gibt. In 4b nur die getestete Schutzgrenzen-Funktion und reservierte Regel-Typen. Alternative: Phase 5 vor 4b ziehen. Dann käme aber die Live-Anpassung später, obwohl das Tagebuch schon Daten liefert.
4. **Was passiert automatisch, was erst nach Bestätigung?**
   - _Empfehlung automatisch, rückgängig machbar:_ Gewicht senken bzw. schneller steigern, eine Woche 1 Satz weniger, Ausdauer eine Woche −15 %, Übungstausch bei Stillstand, Erholungswoche vorziehen.
   - _Empfehlung nur mit Bestätigung:_ weniger Trainingstage und später Kalorien.
   - Offen ist, ob auch „Erholungswoche vorziehen“ eine Bestätigung braucht. _Empfehlung:_ nein, aber mit Erklärung und Rückgängig (nur als Ganzes, Frage 14).
5. **Schnellere Steigerung (R1)?** _Empfehlung:_ ja, aber nur mit RPE-Angabe in allen Sätzen und nie bei vorsichtigen Plänen, unter 18, ab 65 oder bei Einsteigern im ersten Block.
6. **Höchstens 3 automatische Änderungen pro Woche?** _Empfehlung:_ ja, damit der Plan verständlich bleibt. Darüber hinaus nur Hinweise.
7. **„Rückgängig“ anbieten?** _Empfehlung:_ ja für alle automatischen Änderungen, solange danach noch nicht trainiert wurde.
8. **Benachrichtigungen lokal oder per Server-Push?** _Empfehlung:_ lokal (ohne Push-Token und ohne Dienstleister) für Mess-Erinnerung und Pausenende, gratis. Server-Push für „Dein Plan wurde angepasst“ erst später, falls gewünscht (dann Push-Token als personenbezogene Daten, Expo Push Service als Auftragsverarbeiter).
9. **Uhrzeit und Text der Mess-Erinnerung?** _Empfehlung:_ 08:00 Uhr am Fälligkeitstag, Text „Alpha5: Zeit für dein Mess-Update“ ohne Werte. Eine einstellbare Uhrzeit kommt später.
10. **Übungstausch bei Stillstand: Wie oft?** _Empfehlung:_ höchstens einmal je Übung und Block, nur gleiche Bewegung und nicht schwerer. Die neue Übung startet mit eigenem Verlauf (Kalibrierung).
11. **Grenzwerte (70 %, 3 Wochen, Belastung 9, Faktor 0,9 …)?** _Empfehlung:_ als PRODUKTENTSCHEIDUNG starten und vor dem Launch von einer Trainerin bzw. einem Sportwissenschaftler prüfen lassen (wie die Progressions-Konstanten aus Phase 4).
12. **Gesundheitsdaten auf Vercel verarbeiten?** _Empfehlung:_ ja, mit Region Frankfurt, ohne Speicherung und Logs, AV-Vertrag und DSFA-Eintrag. Andernfalls müsste die Engine als Supabase Edge Function laufen (Variante B, mehr Aufwand).
13. **Beta-Freischaltung: Workflow oder Admin-Seite?** (neu, Wächter B1) _Empfehlung:_ Workflow `beta-grant` in der GitHub-App (E-Mail als Eingabe, Ausgabe ohne Personenbezug, Protokoll mit GitHub-Namen), **keine** Admin-Seite in 4b. Eine Admin-Seite erst mit Login Stufe B (E-Mail-Code, `admin_users`, nur Production) als spätere Option, z. B. wenn in Phase 7 Support-Werkzeuge nötig werden.
14. **Wie genau wird die Erholungswoche vorgezogen?** (neu, Wächter B2) _Empfehlung:_ „Verschieben mit Rhythmus“: Die nächste Woche wird Erholungswoche, die frühere Erholungswoche wird Belastungswoche mit **genau der Dosierung der Woche davor** (nie mehr), Ausdauer danach neu auf +10 % je Woche gedeckelt, und der Folgeblock wird um die übrig gebliebenen Belastungswochen kürzer. So kommt nach höchstens 4 bzw. 5 Belastungswochen immer eine Erholungswoche. Nur einmal je Block und nur, wenn die Erholungswoche noch mindestens 2 Wochen entfernt ist; sonst eine Woche 1 Satz weniger. _Alternative:_ zusätzliche Erholungswoche ohne Tausch (einfacher, aber zwei Erholungswochen kurz hintereinander und weniger Training).
15. **Ereignis-Liste nur für Premium?** (neu, Wächter S2) _Empfehlung:_ ja. Für Gratis-Nutzer entsteht keine Zeile (Datenminimierung); die Gratis-Wege bleiben unverändert. Die kurzlebigen Ereignisse stehen trotzdem im Export und in der Datenschutzerklärung.
16. **Mess-Erinnerung: Standard und Zeitpunkt der Erlaubnis-Abfrage?** (neu) _Empfehlung:_ Der Hinweis in der App bleibt wie bisher an. Die Benachrichtigung über das Betriebssystem ist **aus** (Opt-in) und wird einmal direkt nach der ersten gespeicherten Messung angeboten; die System-Erlaubnis (Android 13+, iOS) kommt erst nach „Ja“ bzw. beim ersten Start des Trainingsmodus fürs Pausenende – nie beim App-Start oder im Onboarding. Ohne gültige `health_data`-Einwilligung keine Mess-Erinnerung.

## 14. Risiken

1. **Plan ändert sich zu oft oder unverständlich.** Gegenmittel: höchstens 3 automatische Änderungen pro Woche, Erklärung je Änderung, Rückgängig, Ruhezeiten je Regel.
2. **Falsche Senkung durch Tippfehler.** Gegenmittel: R2 braucht zwei verfehlte Einheiten mit gleichem Zustand. Ein selbst leichter gewähltes Gewicht hat Vorrang. Rückgängig.
3. **Unterschiedliche Rechnung in App und Server.** Gegenmittel: eine gemeinsame Zeilen-Abbildung im Core (5.1), Testmodus mit derselben Engine, Fingerprint-Idempotenz.
4. **Zwei Geräte bzw. späte Warteschlange.** Gegenmittel: Eine Zustands-Vorgabe gilt nur für ihren Basis-Eintrag. Danach `superseded` und neu rechnen.
5. **Folgeblock erbt vorübergehende Reduktionen.** Gegenmittel: `restoreTemporaryChanges()` mit Test.
6. **Premium-Umgehung bzw. unbefugte Freischaltung.** Gegenmittel: Schreiben nur mit Service-Rolle über eine Funktion mit eigener Entitlement-Prüfung. Die App kann nichts schreiben. Freischalten nur über den Workflow (nur Personen mit Repository-Zugriff, Protokoll), Routen in Vorschauen gesperrt.
7. **Server-Kosten bzw. Last.** Gegenmittel: Rechnen nur für Premium, Ratenbegrenzung, Pakete im Sweep, Ereignisse ohne Werte.
8. **Gesundheitsdaten auf Vercel.** Gegenmittel: Region Frankfurt, keine Logs, AV-Vertrag, DSFA (Frage 12).
9. **Abhängigkeit vom offenen Live-Test W13.** Gegenmittel: C erst danach. A, B, D (Testmodus) und E gehen vorher.
10. **Benachrichtigungen auf iOS und Android unterschiedlich** (Android 13 Erlaubnis, exakte Alarme). Gegenmittel: Geräte-Test in E. Kleine Ungenauigkeiten beim Pausenende sind unkritisch, weil die App-Anzeige mit Zeitstempeln rechnet.
11. **Abgrenzung zu Phase 5 verschwimmt (Kalorien).** Gegenmittel: In 4b sind Regel-Typen und Schutzgrenzen nur reserviert und getestet (in `nutrition/limits.ts`), aktiv erst mit dem Kalorienziel aus Phase 5.
12. **Vorgezogene Erholungswoche bricht den Rhythmus oder die 10-%-Regel.** Gegenmittel: feste Tausch-Regel (5.2), `carriedLoadWeeks` im Folgeblock, Eigenschaftstest über zwei Blöcke, gleiche Prüfung in SQL (`apply_plan_adjustments`, `append_plan_block`), Fallback `volume_reduce`.
13. **Änderung trifft ein laufendes Training.** Gegenmittel: nur Einheiten ab morgen ohne Eintrag (S1), Test „Entwurf vor Tausch → Speichern ok“.
