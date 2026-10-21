# Plan Phase 6 – Supplement-Modul & Affiliate

**Status:** Freigegeben (19.10.2026). Gründer-Entscheidungen SU-G1 bis SU-G19 (Abschnitt 17): **alle „Ja, wie
empfohlen“**. Wächter-Prüfung Runde 1: „mit Auflagen“ – alle Befunde (B1–B3, S1–S12, K1–K14) sind eingearbeitet
(Abschnitt 0). Umsetzung je Etappe als Pull Request mit Wächter-Prüfung.
**Stand 19.10.2026:** SU0 erledigt (Plan freigegeben, Entscheidungen eingetragen; Quellen-, Fach- und Rechtsprüfung
laufen parallel, Abschnitt 18). SU1 (Core: Regeln, Dosis, Zeitplan, Texte) umgesetzt, keine Migration, keine
sichtbare App-Änderung (Abschnitt 5, Umsetzungsstand SU1). SU2 (Inhalte: Schema, Prüfregeln SK1–SK7, Pipeline-Art,
Startbestand 5 + 13 Entwürfe) umgesetzt, noch nicht eingespielt (Abschnitt 6, Umsetzungsstand SU2).
**Stand 21.10.2026:** SU3 (Datenbank ohne Affiliate-Tabellen, Seed, Freigabe per content-review) und SU4 (App,
Testmodus + Supabase) umgesetzt (Abschnitte 7 und 8, Umsetzungsstand). Einwilligung `health_data` Fassung 2 liegt als
**Entwurf** in der Datenbank (Veröffentlichung nach der Rechtsprüfung). SU5 (Affiliate) und SU6 (Zeitplan) offen.

**Grundlage:** `CLAUDE.md` (Supplements, Affiliate & Werbung, Gesundheitsdaten, KI-Grenze), `docs/KONZEPT.md`
(3, 6, 6.13, 7, 12, 13, 14, 15), `docs/PROMPTS.md` Phase 6, `docs/ERWEITERUNGEN.md` (Sponsor bei Challenges),
`docs/ERWEITERUNGEN-2.md` (Händler-Anbindung), `docs/PLAN-PHASE-1.md` (Gesundheits-Check, Abschnitt 7),
`docs/PLAN-PHASE-4B.md` (Abschnitt 3: Premium-Prüfung auf dem Server), `docs/PLAN-PHASE-5.md` (Koffein-Hinweis R2-K9,
Ratgeber-Regel R21H), `docs/PLAN-PHASE-10.md` (W1 „keine Koffein-Empfehlung im Plan“), `docs/PLAN-E4.md` (Barcode,
„nicht an Affiliate“), Code-Stand vom 18.10.2026.

---

## 0. Wächter-Prüfung: eingearbeitet

Die Wächter-Prüfung (scratchpad `waechter-plan-6.md`) hat drei blockierende Punkte, zwölf Soll- und vierzehn
Kann-Punkte gefunden. Alle sind im Plantext umgesetzt:

| Befund                                                                       | Lösung im Plan                                                                                                                                                                                                                                                                                                                        | Abschnitt                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **B1** Einwilligung `health_data` v1 deckt Supplement-Check nicht ab         | **Neue Fassung v2 ist Pflicht.** v2 nennt Supplement-Check (4 Themen), „Meine Supplements“ und den Zweck „Supplement-Hinweise und Ausblenden von Shop-Links bei Gegenanzeigen“, ergänzt den Widerrufs-Satz. Eigener Ablauf: Seed v2, Re-Consent-Karte ohne Datenverlust, pgTAP „Schreiben mit v1 scheitert“, Playwright. DoD ergänzt. | 11.1, 7.2, 7.4, 8.1, 13, SU-G12 |
| **B2** Health Claims: Pflichtinfos fehlen, Elektrolyt-Angabe falsch, Koffein | Feld `required_info_de` je Angabe, immer direkt bei der Angabe, Test „ohne Pflichthinweis → rot“. Elektrolyt-Angabe gestrichen. **Koffein nur als neutrale Sicherheits-Info** (keine Stufe, kein „Passt zu dir“, kein Zweck, keine Zeile auf „Heute“); Alternative nur mit Rechtsfreigabe. Stufen in der App ohne Zweckangabe.        | 3.1, 3.2, 3.5, 3.8, 8.1, SU-G5a |
| **B3** SU6 (Premium) rechnet nur auf dem Gerät                               | **SU6 wird gratis** (Empfehlung, keine KI, keine Kosten, Sicherheits-Info). Alternative (Premium) nur mit Server-Weg über RPC mit `has_entitlement_for` und benanntem Restrisiko – als Gründer-Frage.                                                                                                                                 | 2.3, 10, 12, SU-G7              |
| **S1** Strukturtest leicht zu umgehen                                        | Transitiver Importgraph (TypeScript-Auflösung), Barrel-/`index`-/Paketnamen-Importe verboten, `supplement-ids.ts` als neutrales Blatt, `compose.ts` einzige Datei mit beiden Modulen, Negativ-Fixture, `requireTested` gestrichen.                                                                                                    | 5, 9.2, 9.3                     |
| **S2** Flag nur im Client                                                    | Flag `affiliate_enabled` serverseitig in der SELECT-Policy und in `/go/<id>` (404), pgTAP und Route-Test; `constants.ts` nur Testmodus-Standard; `beta-grant`-Option in DoD SU5.                                                                                                                                                      | 7.2, 9.4, 9.6                   |
| **S3** Datenflüsse in Logs                                                   | App lädt alle aktiven Links **ungefiltert** (Test); Route `fra1`, `nodejs`, `console.*`-Test, keine Log Drains, kein Web Analytics; Vercel-Log-Speicherdauer in DSFA/Datenschutzerklärung; Satz zu „IP“ präzisiert.                                                                                                                   | 0 Kurzfassung, 9.4, 11.2        |
| **S4** Produkte müssen zur Dosis passen                                      | Link-Felder `dose_per_daily_serving` + Einheit, `single_ingredient`, `contains_caffeine`; Prüfregel AF5 (Vitamin D ≤ 20 µg, EPA+DHA ≥ 250 mg, reines Kreatin-Monohydrat, Protein ohne Koffein/Stimulanzien), Beleg im PR.                                                                                                             | 7.2, 9.2                        |
| **S5** Vitamin D zu weit                                                     | Vitamin D standardmäßig `info_only` (DGE-Schätzwert 20 µg als allgemeiner Richtwert), kein „Passt zu dir“, keine Links.                                                                                                                                                                                                               | 3.2, 3.3, 3.5, SU-G15           |
| **S6** Omega-3 und Herz                                                      | Bei `medical_clearance_recommended` oder `heart_rhythm`: Omega-3 `info_only` ohne Herz-Angabe; EMA/PRAC 2023 (Vorhofflimmern) für die Fachprüfung vorgemerkt.                                                                                                                                                                         | 3.3, 3.8                        |
| **S7** Eiweiß-Lücke hängt am (Premium-)Essensplan                            | Gratis-Quelle: Tagebuch-Schnitt der letzten 7 Tage (mind. 4 Tage mit Einträgen) oder Selbsteinschätzung; ohne Daten `info_only`; „vegan“ nur zusammen mit der Lücke. Handy-Test angepasst.                                                                                                                                            | 3.7, 5, 14                      |
| **S8** Zeitabhängige rote CI-Prüfungen                                       | Laufzeit filtert Abgelaufenes (RLS mit `now()`); in CI rot nur für im PR geänderte Links, sonst gelb; Erinnerung über `affiliate-report`.                                                                                                                                                                                             | 9.2                             |
| **S9** HEAD auf Tracking-URLs                                                | Prüfung nur auf eigenes Feld `target_url` (Shop-Seite), nie auf die Partner-URL; Workflow mit festem `schedule` (monatlich) und manuell startbar.                                                                                                                                                                                     | 7.2, 9.4, Risiko 9              |
| **S10** W1-Umkehr vollständig benennen                                       | Drei Code-Stellen genannt; Renntag als eigene Frage SU-G5b, Empfehlung **nein** (wegen B2.3).                                                                                                                                                                                                                                         | 1.2, 10, SU-G5b                 |
| **S11** App-Store: Gesundheitsdaten steuern Werbung                          | Risiko 12 ergänzt („nur Unterdrückung, kein Targeting, kein Datenabfluss“); Store-Texte, Privacy-Labels, Play-Datensicherheit in Abschnitt 18.                                                                                                                                                                                        | 15, 18                          |
| **S12** Ausschlüsse wie `weight_goals`                                       | Nie im Partner-Modus, nie im Trainings-/Ernährungs-PDF, nie in Crash-Reports, Logs, Analytics.                                                                                                                                                                                                                                        | 11.2                            |
| **K1** Kreatin-Angabe ab 55 (VO 2017/672)                                    | Als Kandidat `creatine_strength_55plus` aufgenommen, nur nach Prüfung gegen die konsolidierte Fassung/EU-Register.                                                                                                                                                                                                                    | 3.8                             |
| **K2** Unter 18 nicht „ärztlich abklären“                                    | Eigener Satz „ab 18 Jahren“.                                                                                                                                                                                                                                                                                                          | 3.3                             |
| **K3** Kölner Liste: Gleichwertige, Charge, Marke                            | Gleichwertige Listen (z. B. Informed Sport) zulässig, Hinweis „chargenbezogen“, Name nur beschreibend.                                                                                                                                                                                                                                | 3.6, SU-G11                     |
| **K4** Rechtsgrundlagen nennen                                               | UWG § 5a Abs. 4, DDG § 6 Abs. 1 Nr. 1, MStV § 22 Abs. 1, AT MedienG § 26, CH UWG; Art. 10 Abs. 2 VO 1924/2006.                                                                                                                                                                                                                        | 3.8, 9.5                        |
| **K5** Herzrasen → Arzt-Hinweis; Niere → Eiweiß-Hinweis                      | `heart_rhythm` zeigt zusätzlich den allgemeinen Arzt-Hinweis; Nieren-Flag für `kidneyNoticeAbove` als späterer Nachtrag.                                                                                                                                                                                                              | 3.4                             |
| **K6** Medikamente umfasst die Pille                                         | Für Fachprüfung vorgemerkt (Ausschluss vieler Frauen, langsamerer Koffein-Abbau); Teil von SU-G4.                                                                                                                                                                                                                                     | 3.3, SU-G4                      |
| **K7** Query-Parameter                                                       | Weiße Liste erlaubter Parameter je Netzwerk im Schema.                                                                                                                                                                                                                                                                                | 9.2                             |
| **K8** Handy-Test Geschlecht                                                 | Schritt 1 „weiblich“.                                                                                                                                                                                                                                                                                                                 | 14                              |
| **K9** `afternoon` beginnt um 16 Uhr                                         | Satz „nur vor 16 Uhr“ auch bei `afternoon`.                                                                                                                                                                                                                                                                                           | 3.5                             |
| **K10** Quellen mit DOI/PMID                                                 | SK6 verlangt DOI oder PMID.                                                                                                                                                                                                                                                                                                           | 6                               |
| **K11** „Nährstofflücke“ klingt nach Diagnose                                | Kategorie heißt `diet_season` („Ergänzung bei bestimmter Ernährung oder Jahreszeit“).                                                                                                                                                                                                                                                 | 3.2, 7.1                        |
| **K12** Bericht im öffentlichen Repository                                   | `affiliate-report` schreibt nur in die Zusammenfassung des Laufs, wenn das Repository privat ist; sonst nur Summen ohne Link-Bezug (Gründer-Aufgabe: Sichtbarkeit prüfen).                                                                                                                                                            | 9.4, 18                         |
| **K13** Wrapper-RPC für `private`                                            | `public.count_affiliate_click()` nur für `service_role`, ruft `private.*` auf (Muster `ai_food_photo_*`).                                                                                                                                                                                                                             | 7.2                             |
| **K14** Eigenschaftstest erweitern                                           | Monotonie auch über Alter, Einwilligung, `training_time` und Monat.                                                                                                                                                                                                                                                                   | 5                               |

---

## 1. Kurzfassung

Phase 6 bringt zwei getrennte Bausteine:

1. **Supplement-Modul:** Die App zeigt eine kurze Liste von Nahrungsergänzungen mit guter Studienlage
   (Kreatin-Monohydrat, Proteinpulver, Vitamin D, Omega-3) und eine **neutrale Sicherheits-Info zu Koffein**. Ein
   kurzer **Supplement-Check** ergänzt den Gesundheits-Check. Feste Regeln in `packages/core` entscheiden je Person:
   „passt zu dir“, „nur Info“, „ab 18 Jahren“ oder „nicht für dich – bitte ärztlich abklären“. Dazu kommen Dosis
   und Zeitpunkt (vor/nach dem Training, vor dem Schlafen, täglich zu einer Mahlzeit).
2. **Affiliate:** Unter einer passenden Empfehlung stehen Links zu Shops, immer sichtbar als **„Anzeige“**. Die
   Empfehlung entsteht **vorher und ohne Affiliate-Daten**. Ein Strukturtest über den ganzen Importgraphen stellt
   sicher, dass der Empfehlungs-Code das Affiliate-Modul nie erreicht. Klicks zählen wir in unserer Datenbank nur
   anonym (Link, Tag, Plattform).

**Das Wichtigste vorweg:**

- **Keine Echtzeit-KI.** Regeln im Code, Texte offline als Inhalt (Entwurf → Prüfung → Freigabe per Merge).
- **Neue Einwilligungs-Fassung `health_data` v2** ist nötig (B1). Wer v1 hat, sieht eine Hinweis-Karte und stimmt
  erneut zu; es gehen keine Daten verloren.
- **Sicherheit vor Umsatz:** Bei Gegenanzeigen gibt es keine Empfehlung und **keinen Shop-Link**, nur den
  Hinweis auf ärztliche Rücksprache. Unter 18 keine Sport-Supplemente und keine Links.
- **Keine Heilversprechen:** Wirkaussagen nur als wörtlich zugelassene Angaben aus VO (EU) 432/2012 mit Pflichthinweis,
  sonst neutrale Sätze. Koffein bekommt keine Wirkaussage. Verbotene Wörter werden in CI geprüft.
- **Keine Gesundheitsdaten an Shops, Netzwerke oder Analytics.** Unsere Klick-Zähler speichern keine Nutzer-ID,
  keine IP und keinen Seitenkontext. Vercel selbst protokolliert Anfragen kurzzeitig (IP, Pfad) – das steht in DSFA
  und Datenschutzerklärung.
- **Alles gratis** (Empfehlung), auch die Kopplung an geplante Einheiten (SU6), weil sie nur auf dem Gerät rechnet.
- **Affiliate bleibt aus**, bis Rechtsprüfung und Partnerverträge da sind (Flag `affiliate_enabled`, serverseitig
  geprüft). Im Testmodus zeigt die App Beispiel-Links, damit ihr die Kennzeichnung prüfen könnt.
- **7 Etappen** (SU0–SU6). Die Namen beginnen mit „SU“, weil „S0–S2b“ schon die Strecken-Etappen aus Phase 10 sind.

---

## 2. Ist-Stand (geprüft am 18.10.2026)

### 2.1 Was es noch nicht gibt

- **Keine Tabellen** `supplements`, `supplement_contraindications`, `affiliate_links`, `user_supplement_plans`.
  KONZEPT 12 nennt sie nur als geplant. Keine Migration, kein Inhalt unter `content/`, kein Bildschirm in der App.
- **Kein Modul** `packages/core/src/supplements/` oder `affiliate/`.
- **Keine Import-Sperre** zwischen Modulen (keine ESLint-Regel `no-restricted-imports`, kein Strukturtest).
- **Kein Analytics-SDK** in `apps/mobile` und `apps/web` (geprüft: kein PostHog, Sentry o. Ä.). Das bleibt so.

### 2.2 Was es schon gibt und worauf wir aufbauen

- **Gesundheits-Check** (`packages/core/src/health-screening.ts`, PAR-Q-angelehnt, 9 Fragen ja/nein) mit den Flags
  `medical_clearance_recommended`, `pregnancy` (schwanger oder Geburt in den letzten 6 Monaten), `injury`,
  `medication` (nur ja/nein, ohne Art des Medikaments) und `conservative_plan`. PLAN-PHASE-1 Abschnitt 7 sagt
  bereits: „Supplements (Phase 6) berücksichtigen `pregnancy`/`medication` als Gegenanzeige.“
- **Lücken im Check:** keine Frage zu den **Nieren** (`constants.ts` sagt bei `PROTEIN_G_PER_KG.kidneyNoticeAbove`
  ausdrücklich „der Check fragt nicht nach den Nieren“), keine Frage zur **Stillzeit** nach 6 Monaten, keine zu
  **Herzrhythmus** oder **Koffein-Empfindlichkeit**. Diese Fragen braucht das Modul (Abschnitt 3.4).
- **Einwilligung `health_data` v1** (`apps/mobile/src/data/consent-texts.ts`, Seed `20261003120800`) zählt die
  Datenarten abschließend auf (Körperdaten, Umfänge, Gesundheits-Check, Unverträglichkeiten), Zweck „ausschließlich
  zur Berechnung deiner Trainings- und Ernährungspläne“. Eine neue Fassung friert das Schreiben aller
  Gesundheitsdaten ein, bis die Person erneut zustimmt (Text v1: „Neue Fassung: fragen wir dich erneut“).
- **Alter:** Geburtsdatum Pflicht, Mindestalter 16. Regeln für „unter 18“ und „ab 65“ gibt es in Plan und
  Ernährung.
- **Koffein:** `PREGNANCY_CAFFEINE_MAX_MG = 200` mit fester Notiz `pregnancy_caffeine` (Phase 5, Modus
  `no_targets`, Quelle BfR/EFSA 2015). Die Wettkampf-Ernährung W1 enthält bewusst **kein Koffein** – an drei
  Stellen festgelegt: `packages/core/src/constants.ts` (Kommentar zu `fueling`/`drinkMlPerHour`, „kein Koffein im
  Plan (Supplement-Modul)“, etwa Zeile 1313), `packages/core/src/nutrition/competition.ts` (etwa Zeile 392),
  `apps/mobile/src/i18n/de-competition-nutrition.ts` (Kopfkommentar, Zeile 10). Phase 6 ändert das nicht
  (SU-G5b).
- **Trainingszeit:** `training_time` (`early`, `morning`, `midday`, `afternoon`, `evening`, `varies`);
  `afternoon` beginnt laut `TRAINING_TIME_START_MINUTES` um 16:00.
- **Eiweiß:** `PROTEIN_G_PER_KG` (Ziel je kg, `cautiousMax` 1,6 bei unter 18, `medication`, Arzt-Flag),
  `proteinMinShare` 0,9. Das Ernährungstagebuch (Phase 5/E-Etappen) liefert Tageswerte – gratis.
- **Gel-/Trinkplan** am Renntag gibt es schon (W1, ohne Marken, ohne Health Claims). Das Modul verweist darauf und
  doppelt nichts.
- **Textregeln** (`packages/core/src/content/text-rules.ts`): `FORBIDDEN_MEDICAL_TERMS`, `FORBIDDEN_BRANDS`,
  `HEALTH_CLAIM_TERMS` (VO 1924/2006, VO 432/2012). Ratgeber-Regel R21H (`guide-checks.ts`) meldet
  Supplement-Dosierungen (`koffein`, `kreatin`) gelb zur Fachprüfung.
- **Vorlage für Affiliate:** `packages/core/src/retail/provider.ts` (Händler-Schnittstelle, Kennzeichnung „Anzeige“,
  Datenminimierung, Feature-Flag `retail_integration` aus, kein Netzwerkaufruf).
- **Feature-Flags und Premium:** `private.feature_flags`, `private.has_entitlement_for` (die eine Stelle für
  `hasEntitlement()`), Workflow `beta-grant` (Aktionen `flag_an`/`flag_aus`/`status`). Premium ist in der
  Testphase für alle offen.
- **Content-Pipeline:** Inhaltsarten `exercise`, `plan_template`, `ingredient_substitution`, `package_size`, `recipe`
  (`packages/content/src/pipeline/kinds`), Ratgeber unter `content/guides/`. Workflows `content-generate`,
  `content-collect`, `content-review`, `content-seed`.
- **Barcode-Scan** (E4): Ein Proteinpulver kann man heute schon scannen und ins Ernährungstagebuch eintragen.
- **Bestehende Zusagen nach außen:** Landingpage „Supplementplan: Nur, was nachweislich wirkt, etwa Eiweiß oder
  Kreatin“ (`apps/web/src/app/(seite)/page.tsx`); Einwilligungstexte nennen „Supplement-Empfehlungen“ als
  allgemeine Fitness-Informationen und versprechen „keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner“.
  Phase 6 muss das einhalten.

---

## 2b. Umfang und Abgrenzung

### 2b.1 Was in Phase 6 kommt

1. **Regel-Engine** `packages/core/src/supplements/`: Eignung je Supplement, Dosis, Zeitplan, Hinweise. Alle Werte
   in `constants.ts` mit Quelle bzw. „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“.
2. **Einwilligung `health_data` v2** mit Re-Consent-Ablauf (11.1).
3. **Supplement-Check:** 4 kurze Zusatzfragen (Abschnitt 3.4), nur mit Einwilligung `health_data` v2.
4. **Formulierungsregeln:** zugelassene Angaben mit Pflichthinweis als feste Liste, verbotene Wörter, Test über alle
   Texte.
5. **Inhalte** `content/supplements/<id>.json` über die bestehende Pipeline (Schema, Prüfung, Freigabe per Merge).
6. **Datenbank:** Inhaltstabellen, Supplement-Check, „Meine Supplements“, Affiliate-Tabellen, anonyme Klick-Zähler.
   Alles mit RLS und pgTAP.
7. **App:** Übersicht, Check, Detailseite, „Meine Supplements“, Testmodus. Web-Export und nativ gleich.
8. **Affiliate:** eigenes Modul `packages/core/src/affiliate/`, Weiterleitung über `apps/web`, Kennzeichnung
   „Anzeige“, Prüf-Filter (Kölner Liste o. gleichwertig), Strukturtest gegen Vermischung.

### 2b.2 Was NICHT in Phase 6 kommt

- **Keine KI** (kein „Frag den Coach zu Supplements“; das wäre Phase 11 und Premium).
- **Keine Einnahme-Protokolle** („heute genommen“ abhaken) und keine Push-Erinnerungen (Datenminimierung, SU-G8).
- **Keine Produkte oder Marken** in Empfehlungstexten. Empfohlen wird ein Stoff („Kreatin-Monohydrat“), nie ein
  Produkt.
- **Kein Koffein am Renntag** und keine Änderung an W1 (SU-G5b).
- **Keine Sponsoren bei Challenges** (ERWEITERUNGEN, kommt mit Phase 11b).
- **Kein Eisen, kein Multivitamin, keine Booster** usw. (Ausschlussliste in 3.2). Eisen nur als Hinweis „Blutwerte
  ärztlich prüfen lassen“, später im Zyklus-Modul (Phase 9).
- **Kein automatisches Einplanen von Proteinpulver in den Essensplan** (SU-G6, später möglich).
- **Keine Händler-Anbindung für Lebensmittel** (bleibt KONZEPT 6.13 / N12).

### 2b.3 Gratis und Premium (Vorschlag, SU-G7)

| Funktion                                                                 | Gratis | Premium |
| ------------------------------------------------------------------------ | ------ | ------- |
| Supplement-Übersicht mit Studienlage, Hinweisen und Quellen              | Ja     | Ja      |
| Supplement-Check und persönliche Einordnung („passt“, „nicht für dich“)  | Ja     | Ja      |
| Dosis und allgemeiner Zeitpunkt                                          | Ja     | Ja      |
| „Meine Supplements“ (Liste, was ich nehme)                               | Ja     | Ja      |
| Shop-Links („Anzeige“)                                                   | Ja     | Ja      |
| Zeitpunkt passend zu geplanten Einheiten (SU6, nur gewählte Supplements) | Ja     | Ja      |

Begründung: Sicherheitsinformationen gehören nie hinter eine Bezahlschranke (KONZEPT 13 nennt die
„Supplement-Übersicht“ gratis). Alles rechnet auf dem Gerät aus Daten, die die Person ohnehin hat; eine
Premium-Sperre ließe sich dort nicht serverseitig durchsetzen (CLAUDE.md „Premium-Prüfung immer serverseitig“,
PLAN-PHASE-4B Abschnitt 3, Variante D verworfen). Deshalb: **alles gratis** (B3). Die Alternative „SU6 Premium“
bräuchte einen Server-Weg (SU-G7).

---

## 3. Fachliche Regeln (Vorschläge – VOR LIVEGANG FACHLICH PRÜFEN)

Alle Zahlen sind Startwerte. Sie stehen in `constants.ts` (`SUPPLEMENT_RULES`, `CAFFEINE_LIMITS` usw.) mit Quelle.
Eine Ernährungsfachkraft oder Sportmedizinerin prüft sie vor dem Livegang (Abschnitt 18).

### 3.1 Evidenz-Stufen

Wir nutzen drei Stufen, angelehnt an das IOC-Konsenspapier und das AIS-Rahmenwerk. **Intern** (Auswahl, Fachprüfung)
gilt die Stufe für einen bestimmten Zweck. **In der App** steht die Stufe **ohne Zweck** („gute Studienlage“,
„begrenzte Studienlage“). Eine Wirkung nennt die App nur über `APPROVED_CLAIMS` (3.8, B2).

| Stufe | Bedeutung (intern)                                  | In der App                                           |
| ----- | --------------------------------------------------- | ---------------------------------------------------- |
| **A** | gute Studienlage                                    | persönliche Empfehlung möglich                       |
| **B** | begrenzte Studienlage oder nur bei Ernährung/Saison | nur Info oder nur unter Bedingung (z. B. kein Fisch) |
| **C** | keine ausreichende Studienlage                      | keine Empfehlung, nur in der Liste „Nicht empfohlen“ |

Koffein bekommt **keine** Stufe in der App (B2.3).

**Quellen:**

- Maughan RJ, Burke LM, Dvorak J et al. (2018): IOC consensus statement: dietary supplements and the high-performance
  athlete. Br J Sports Med 52(7):439–455.
- Australian Institute of Sport (2021): AIS Sports Supplement Framework (Gruppen A–D).
- ISSN Position Stands: Kreider RB et al. (2017), Creatine, J Int Soc Sports Nutr 14:18; Guest NS et al. (2021),
  Caffeine and exercise performance, JISSN 18:1; Jäger R et al. (2017), Protein and exercise, JISSN 14:20;
  Trexler ET et al. (2015), Beta-alanine, JISSN 12:30.

### 3.2 Startliste

| Supplement                     | Stufe | Kategorie     | Wann „passt zu dir“                                                          |
| ------------------------------ | ----- | ------------- | ---------------------------------------------------------------------------- |
| **Kreatin-Monohydrat**         | A     | `sport`       | Kraft, Muskelaufbau, Definition; Ausdauer nur mit Intervallen/Sprints, ab 18 |
| **Proteinpulver**              | A\*   | `food`        | nur wenn das Eiweißziel über Essen schwer erreichbar ist (3.7)               |
| **Vitamin D**                  | B     | `diet_season` | **nie** „passt“ – nur Info mit allgemeinem Richtwert (S5)                    |
| **Omega-3 (EPA/DHA)**          | B     | `diet_season` | nur wer keinen Fisch isst (vegan, vegetarisch oder „Fisch mag ich nicht“)    |
| **Koffein**                    | –     | `safety_info` | **nie** „passt“ – neutrale Sicherheits-Info (3.5, B2.3)                      |
| Kohlenhydrat-Gels, Elektrolyte | –     | Verweis       | nur Link zur Wettkampf-Ernährung W1 (Gel-/Trinkplan), ohne Wirkaussage       |

\* Proteinpulver ist ein Lebensmittel, kein Wirkstoff. Es zählt zur Ernährung und hat Kalorien (3.7).

Die Kategorie `diet_season` heißt in der App „Ergänzung bei bestimmter Ernährung oder Jahreszeit“ (K11, nicht
„Nährstofflücke“).

**Zweite Welle (SU-G1):**

- **Nitrat** (Rote-Bete-Saft), für Ausdauer gut untersucht (Maughan 2018: etwa 5–9 mmol, 2–3 h vorher; bei sehr gut
  Trainierten geringerer Effekt). Vorschlag: später als Lebensmittel-Hinweis für Fortgeschrittene und
  Leistungssport mit Ausdauer-Ziel – ohne Wirkaussage (keine zugelassene Angabe).
- **Beta-Alanin** (Trexler 2015). Nebenwirkung Kribbeln, Einnahme über Wochen verteilt. Vorschlag: zunächst nicht.

**Nicht empfohlen (Stufe C oder zu riskant), mit kurzer neutraler Erklärung:** BCAA, Glutamin, L-Carnitin, CLA,
„Fatburner“, „Testo-Booster“, Pre-Workout-Booster (Mischungen, oft hohe Koffein-Mengen, Verunreinigungsrisiko),
HMB, Ashwagandha, Kollagen, Multivitamin ohne ärztlichen Grund, Eisen ohne Blutbild, Natriumbikarbonat
(Magen-Darm-Beschwerden), Melatonin (in Deutschland teils Arzneimittel). Die Liste ist eine Info, keine Warnung vor
Marken.

### 3.3 Wer bekommt was – Ausschlussregeln (strengste Regel gewinnt)

Jede Regel prüft **beim Anzeigen** die aktuellen Daten (wie `applyCurrentSafetyRules` im Trainingsplan). Eine
neue Schwangerschaft oder ein neues Medikament wirkt sofort.

| Bedingung (Quelle in der App)                                     | Kreatin   | Proteinpulver    | Vitamin D | Omega-3                | Koffein-Info           |
| ----------------------------------------------------------------- | --------- | ---------------- | --------- | ---------------------- | ---------------------- |
| Keine Einwilligung `health_data` v2 oder kein Gesundheits-Check   | Info      | Info             | Info      | Info                   | allgemein              |
| Supplement-Check nicht ausgefüllt                                 | Info      | Info             | Info      | Info                   | allgemein              |
| Unter 18 (Geburtsdatum)                                           | **ab 18** | Info             | Info      | Info                   | **ab 18**              |
| `pregnancy` (Gesundheits-Check) oder Stillzeit (Supplement-Check) | **aus**   | **aus**          | **aus**   | **aus**                | nur BfR-Hinweis 200 mg |
| `medication` (Gesundheits-Check)                                  | **aus**   | erlaubt (s. 3.7) | **aus**   | **aus**                | **aus**                |
| `medical_clearance_recommended` (Herz, Brustschmerz, Blutdruck)   | **aus**   | erlaubt          | Info      | Info, ohne Herz-Angabe | **aus**                |
| Nierenerkrankung (Supplement-Check)                               | **aus**   | **aus**          | **aus**   | erlaubt                | allgemein              |
| Herzrhythmusstörungen (Supplement-Check)                          | erlaubt   | erlaubt          | Info      | Info, ohne Herz-Angabe | **aus**                |
| Koffein-empfindlich oder Schlafprobleme (Supplement-Check)        | erlaubt   | erlaubt          | Info      | erlaubt                | **aus**                |
| Einheit am Abend (`training_time = evening`)                      | erlaubt   | erlaubt          | Info      | erlaubt                | **aus**¹               |

¹ Umgesetzt in SU1 (Präzisierung 2): „aus“ heißt hier **nicht** „ärztlich abklären“, sondern die Koffein-Info bleibt
und sagt „Du trainierst abends: Nimm vor dem Training kein Koffein.“ (wie 3.5, keine Angabe vor dem Training).

- **„Info“** = allgemeine Seite ohne „passt zu dir“, ohne persönliche Dosis und **ohne Shop-Link**.
- **„ab 18“** = freundlicher Satz „Diese Ergänzung ist erst ab 18 Jahren gedacht.“ – nicht „ärztlich abklären“, damit
  das Alter nicht wie ein Befund klingt (K2). Keine Dosis, kein Link.
- **„aus“** = „Nicht für dich“ mit festem Satz: „Bei deinen Angaben empfehlen wir das nicht ohne ärztliche
  Rücksprache.“ Keine Dosis, **kein Shop-Link**. Der Grund wird nicht genannt (kein „wegen deiner Nieren“ auf dem
  Bildschirm), nur „wegen deiner Angaben im Gesundheits-Check“.
- **Koffein-Info „allgemein“** = Grenzen ohne persönliche Dosis; „aus“ = nur „Bei deinen Angaben: Koffein vorher
  ärztlich abklären.“
- **Omega-3 bei Herz-Flags** (S6): nur Info, **ohne** die Angabe „normale Herzfunktion“ – sonst liest es sich wie eine
  Therapieaussage. Die EMA (PRAC, 2023) hat für Omega-3-Arzneimittel ein dosisabhängiges Risiko für Vorhofflimmern
  bewertet; Punkt für die Fachprüfung vorgemerkt.
- **Schwangerschaft/Stillzeit:** Ärztin oder Hebamme entscheidet (z. B. Jod, Folsäure, Vitamin D, DHA werden dort oft
  ärztlich empfohlen). Die App gibt dazu bewusst **keine** eigene Empfehlung, nur den Hinweis. Der bestehende
  BfR-Koffein-Hinweis (200 mg/Tag) bleibt.
- **Medikamente:** Der Check kennt nur „ja/nein“. Wechselwirkungen (z. B. Omega-3 und Blutverdünner, Vitamin D und
  bestimmte Herz- oder Entwässerungsmittel) können wir nicht ausschließen. Deshalb streng „aus“ (SU-G4).
  Proteinpulver bleibt als Lebensmittel erlaubt, die Eiweißgrenze `cautiousMax` 1,6 g/kg gilt schon.
  **Für die Fachprüfung vorgemerkt (K6):** Die Frage umfasst auch die Pille. Viele Frauen wären dann bis auf
  Proteinpulver von allem ausgeschlossen; hormonelle Verhütung verlangsamt außerdem den Koffein-Abbau.
- **Unter 18:** Maughan 2018 rät jungen Sportlerinnen und Sportlern, sich auf das Essen zu konzentrieren;
  EFSA 2015 nennt für Jugendliche 3 mg Koffein je kg und Tag als unbedenklich, das ist für eine App-Angabe zu
  knapp. Deshalb keine Sport-Supplemente und keine Shop-Links unter 18 (SU-G3).
- **Ab 65:** keine eigene Sperre. `conservative_plan` allein sperrt nichts, die Einzelflags oben greifen. Fachlich
  prüfen.
- **Leistungssport:** zusätzlich Doping-Hinweis (3.6), Shop-Links nur zu geprüften Produkten.

### 3.4 Supplement-Check (4 Zusatzfragen, nur mit Einwilligung `health_data` v2)

Gestellt beim ersten Öffnen des Moduls, nicht im Onboarding (das bleibt kurz). Antworten ja/nein, jederzeit
änderbar unter Einstellungen.

1. **Niere:** „Hat dir eine Ärztin oder ein Arzt gesagt, dass deine Nieren nicht richtig arbeiten?“
2. **Stillzeit** (nicht bei „männlich“): „Stillst du gerade?“
3. **Herzrhythmus:** „Hast du Herzrhythmusstörungen oder oft Herzrasen ohne Anstrengung?“
4. **Koffein:** „Reagierst du empfindlich auf Kaffee (Unruhe, Herzklopfen) oder schläfst du oft schlecht?“

Ergebnis: Flags `kidney`, `breastfeeding`, `heart_rhythm`, `caffeine_sensitive`. Die Datenbank berechnet sie beim
Speichern selbst (Trigger wie beim Gesundheits-Check, Abgleich in `db-sync.test.ts`).

- `heart_rhythm` zeigt zusätzlich den **allgemeinen Arzt-Hinweis** aus dem Gesundheits-Check, nicht nur die
  Koffein-Sperre (K5).
- Später (eigener Nachtrag, nicht Phase 6): Das Nieren-Flag könnte den Eiweiß-Hinweis `kidneyNoticeAbove` speisen (K5).

### 3.5 Dosis und Zeitplan

**Zeitpunkte** (Enum `supplement_timing`): `before_training`, `after_training`, `before_sleep`, `daily_with_meal`.

| Supplement         | Dosis (Startwert)                                                                                   | Zeitpunkt                                                       | Quelle / Status                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Kreatin-Monohydrat | **3 g täglich**, ohne Ladephase; gleichmäßig auch an Ruhetagen                                      | `daily_with_meal` (Zeitpunkt egal, täglich)                     | Kreider 2017 (3–5 g/Tag); 3 g = Bedingung der zugelassenen Angabe (VO 432/2012). Keine Ladephase: PRODUKTENTSCHEIDUNG                 |
| Proteinpulver      | eine Portion mit **20–30 g Eiweiß**, höchstens so viel, dass das Tagesziel nicht überschritten wird | `after_training` oder Zwischenmahlzeit; optional `before_sleep` | Jäger 2017 (0,25–0,4 g/kg je Mahlzeit; 30–40 g Kasein vor dem Schlafen); PRODUKTENTSCHEIDUNG                                          |
| Vitamin D (Info)   | allgemeiner Richtwert **20 µg (800 IE) täglich**, wenn Sonne und Ernährung nicht reichen            | `daily_with_meal` (mit einer fetthaltigen Mahlzeit)             | DGE-**Schätzwert** 20 µg/Tag bei fehlender Eigenbildung; BfR (2021) Höchstmengenvorschlag 20 µg je Tagesdosis für NEM; EFSA UL 100 µg |
| Omega-3 (EPA/DHA)  | **250–500 mg EPA+DHA täglich** (z. B. Algenöl)                                                      | `daily_with_meal`                                               | 250 mg = Bedingung der zugelassenen Angabe; EFSA (2012) bis 5 g/Tag unbedenklich; Obergrenze 500 mg: PRODUKTENTSCHEIDUNG              |

**Koffein – neutrale Sicherheits-Info** (`CAFFEINE_LIMITS`, B2.3). Keine Stufe, kein „Passt zu dir“, kein Zweck
(nicht „für mehr Leistung“), keine Zeile auf „Heute“, keine Shop-Links. Inhalt nur:

- **Menge:** höchstens 3 mg je kg, höchstens **200 mg** auf einmal; ohne Gewicht „höchstens 1–2 Tassen Kaffee auf
  einmal“. Quelle: EFSA 2015 (200 mg Einzeldosis für Erwachsene unbedenklich); 3 mg/kg: PRODUKTENTSCHEIDUNG.
- **Nicht am Abend:** keine Angabe vor dem Training bei `training_time = evening`. Bei `afternoon` (beginnt um
  16:00, K9) und `varies` der Satz „nur, wenn deine Einheit vor 16 Uhr liegt“. Quelle: Drake C et al. (2013),
  J Clin Sleep Med 9(11):1195–1200 (Koffein bis 6 h vor dem Schlafen stört den Schlaf). „16 Uhr“:
  PRODUKTENTSCHEIDUNG (bei üblicher Schlafenszeit um 22 Uhr).
- **Tagesgrenze:** „Insgesamt höchstens 400 mg am Tag – Kaffee, Tee, Cola und Energydrinks zählen mit.“
  (EFSA 2015). Eine Tasse Filterkaffee hat etwa 90 mg (EFSA 2015).
- **Testen:** „Probiere nichts Neues an einem wichtigen Tag.“
- **Alternative (nur mit ausdrücklicher Rechtsfreigabe vor SU4, SU-G5a):** Koffein als Sport-Supplement mit „passt zu
  dir“ und Zeitpunkt vor dem Training (3 mg/kg, Guest 2021).

**Kreatin-Hinweise:**

- „Dein Gewicht kann in den ersten Wochen um 1–2 kg steigen. Das ist meist eingelagertes Wasser, kein Fett.“
  (Kreider 2017). Wichtig für Abnehm-Ziele und die Live-Anpassung (Risiko 7).
- „Trinke wie gewohnt.“ Keine Aussage zu Haarausfall o. Ä.

### 3.6 Doping-Hinweis (Kölner Liste)

- **Für alle mit `experience_level = competitive` oder mit eingetragenem Wettkampf:** fester Hinweis auf jeder
  Sport-Supplement-Seite: „Nahrungsergänzungen können verunreinigt sein. Wenn du an Wettkämpfen mit Dopingkontrollen
  teilnimmst: Nutze nur Produkte, die auf Dopingsubstanzen geprüft sind (z. B. in der Kölner Liste), und informiere
  dich bei der NADA. Geprüft wird je Charge – ein Restrisiko bleibt.“
- **Shop-Links:** Produkte, die wir verlinken, müssen in der **Kölner Liste oder einer gleichwertigen Liste** (z. B.
  Informed Sport) stehen (Feld `tested_list` + Prüfdatum). Pflicht für **alle** Links (SU-G11). Das Kriterium ist
  objektiv und herstellerneutral (K3).
- Die Namen der Listen nur beschreibend verwenden (Marken), ohne Logo.
- Keine Wörter wie „dopingfrei“ oder „garantiert sauber“ (Liste 3.8).

### 3.7 Proteinpulver und der Ernährungsplan

- **Wann „passt“ (S7):** Es gibt eine **Eiweiß-Lücke**, und zwar aus einer Gratis-Quelle:
  1. **Tagebuch:** Im Schnitt der letzten 7 Tage (mindestens 4 Tage mit Einträgen) liegt das gegessene Eiweiß unter
     `proteinMinShare` (90 %) des Eiweißziels, **oder**
  2. **Selbsteinschätzung:** Frage „Schaffst du dein Eiweißziel meist über das Essen?“ mit „eher nicht“.
     Ohne diese Daten nur Info. **„Vegan“ allein ist kein Grund**; vegan wirkt nur zusammen mit der Lücke (Text nennt
     dann die pflanzliche Variante). Ohne Kalorienziel (Modus `no_targets`) keine Empfehlung.
- Die Selbsteinschätzung wird in `user_supplements` nicht gespeichert, sondern nur im Supplement-Check
  (`answers.protein_self_check`, gleiche Regeln).
- **Kalorien:** Proteinpulver hat Kalorien (etwa 110–130 kcal je 30-g-Portion). Phase 6 plant es **nicht**
  automatisch ein (SU-G6). Wer es nutzt, trägt es ins Tagebuch ein (Barcode oder Katalog-Eintrag „Proteinpulver
  (Molke)“ / „Proteinpulver (Erbse)“ aus der Nährwertdatenbank, falls vorhanden). Fester Satz: „Ein Shake zählt wie
  eine Mahlzeit. Trag ihn ein, dann stimmt deine Übersicht.“
- **„Kalorienzahlen anzeigen“ aus:** Die Seite nennt keine kcal, nur „zählt wie eine kleine Mahlzeit“.
- **Unverträglichkeiten:** Bei Milch-Unverträglichkeit nur pflanzliche Variante im Text.
- **Später (optional):** Schalter „Proteinshake einplanen“ (wie `fill_snacks`). Eigener Nachtrag, Wächter-Prüfung.

### 3.8 Formulierungsregeln (keine Heilversprechen)

**Rechtlicher Rahmen:** VO (EG) 1924/2006 (Health-Claims-Verordnung, inkl. Art. 10 Abs. 2: Pflichtangaben neben
gesundheitsbezogenen Angaben) und VO (EU) 432/2012 (Liste zugelassener Angaben, **in der konsolidierten Fassung**
bzw. laut EU-Register). Werbe-Kennzeichnung: UWG § 5a Abs. 4, DDG § 6 Abs. 1 Nr. 1, MStV § 22 Abs. 1; Österreich
MedienG § 26 („Anzeige“/„Werbung“); Schweiz UWG (K4). Weil die App über Abo und Affiliate kommerziell ist, gelten
die Texte als kommerzielle Mitteilung (Art. 2 Abs. 2 Nr. 5, Art. 10 Abs. 1 VO 1924/2006). Deshalb streng:

1. **Wirkaussagen nur aus einer festen Liste** `APPROVED_CLAIMS` in `packages/core/src/supplements/claims.ts`,
   **wörtlich**, mit Bedingung **und Pflichthinweis** `required_info_de` (B2.1). Die Detailseite zeigt den
   Pflichthinweis immer direkt unter der Angabe. Startliste (Wortlaute VOR LIVEGANG gegen das EU-Register prüfen):

   | ID                         | Angabe (deutsche Fassung)                                                                                                     | Bedingung                                             | Pflichthinweis `required_info_de`                                                                                                                          |
   | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `creatine_performance`     | „Kreatin erhöht die körperliche Leistung bei Schnellkrafttraining im Rahmen kurzzeitiger intensiver körperlicher Betätigung.“ | Tagesdosis ≥ 3 g; Erwachsene mit intensivem Training  | „Die positive Wirkung stellt sich bei einer täglichen Aufnahme von {dose} Kreatin ein. Gilt für Erwachsene, die intensive körperliche Betätigung ausüben.“ |
   | `protein_muscle_mass`      | „Protein trägt zu einer Zunahme an Muskelmasse bei.“                                                                          | nur Proteinpulver                                     | (laut Register prüfen; bis dahin der allgemeine Pflichtsatz zur abwechslungsreichen Ernährung)                                                             |
   | `vitamin_d_bones`          | „Vitamin D trägt zur Erhaltung normaler Knochen bei.“                                                                         | Dosis ≥ 15 % NRV                                      | (laut Register prüfen)                                                                                                                                     |
   | `vitamin_d_muscle`         | „Vitamin D trägt zur Erhaltung einer normalen Muskelfunktion bei.“                                                            | Dosis ≥ 15 % NRV                                      | (laut Register prüfen)                                                                                                                                     |
   | `epa_dha_heart`            | „EPA und DHA tragen zu einer normalen Herzfunktion bei.“                                                                      | 250 mg EPA+DHA täglich; **nicht** bei Herz-Flags (S6) | „Die positive Wirkung stellt sich bei einer täglichen Aufnahme von {dose} EPA und DHA ein.“                                                                |
   | `creatine_strength_55plus` | Kandidat aus VO (EU) 2017/672 (Krafttraining, Erwachsene ab 55, 3 g/Tag) – **nur nach Prüfung des Wortlauts** (K1)            | ab 55, Tagesdosis 3 g                                 | laut Register                                                                                                                                              |

   **Gestrichen (B2.2):** die Angabe zu Kohlenhydrat-Elektrolyt-Lösungen. Sie gilt nur für Lösungen mit festgelegter
   Zusammensetzung, nicht für Gels oder den W1-Plan; W1 bleibt ohne Health Claims.

   **Koffein hat keine zugelassene Angabe.** Der Koffein-Text nennt nur Grenzen, keine Wirkung (3.5).

2. **Verbotene Wörter** im Freitext: die bestehenden Listen (`FORBIDDEN_MEDICAL_TERMS`, `HEALTH_CLAIM_TERMS`,
   `FORBIDDEN_BRANDS`) plus neu `SUPPLEMENT_FORBIDDEN_TERMS`: „steigert“, „Leistungssteigerung“, „leistungsfähig“,
   „verbessert“, „boost“/„Booster“, „beschleunigt“ (Muskelaufbau, Regeneration), „Konzentration“, „wach“,
   „anabol“, „Testosteron“, „Hormon“, „bewiesen“/„wissenschaftlich belegt“, „klinisch“, „Mangel“ (klingt nach
   Diagnose – stattdessen fester Satz „Lass deine Blutwerte ärztlich prüfen.“), „dopingfrei“, „sauber“, „100 %“,
   „natürlich“, „Abnehmen mit“, „schützt“, „stärkt“, „Wirkung“. Nicht abschließend, im Zweifel umformulieren.
   Die Angaben aus `APPROVED_CLAIMS` sind davon ausgenommen (eigener Prüfweg).
3. **Keine Zahlen im Freitext:** Dosis, mg, g, µg, IE nur über Platzhalter (`{dose}`), die der Core füllt. So
   können Text und Regel nie auseinanderlaufen.
4. **Pflichtsätze** (feste App-Texte, nicht im Inhalt) auf jeder Detailseite: „Nahrungsergänzungsmittel sind kein
   Ersatz für eine abwechslungsreiche, ausgewogene Ernährung und eine gesunde Lebensweise.“ und „Bei Vorerkrankungen,
   Medikamenten, in Schwangerschaft und Stillzeit vorher ärztlich abklären.“ (Art. 10 Abs. 2 VO 1924/2006 –
   juristisch prüfen, ob das genügt.)
5. **Tests:**
   - Alle Inhaltsdateien **und** alle App-Texte (`i18n/de-supplements.ts`) gegen die Listen; Positiv- und
     Negativbeispiele je Wort.
   - Jede `claim_id` existiert, ihre Bedingung passt zur Dosis aus dem Core (z. B. Kreatin-Angabe nur, wenn
     `SUPPLEMENT_RULES.creatine.dailyG >= 3`).
   - **Angabe ohne `required_info_de` → rot**, wo das Register einen Pflichthinweis verlangt; App-Test: die
     Komponente `ClaimBlock` rendert Angabe und Pflichthinweis immer zusammen.
   - Koffein: Inhalt und App-Text enthalten keine Stufe und keinen Zweck (eigener Test).

---

## 4. Etappe SU0 – Plan, Ist-Stand, Grundlagen

- Dieses Dokument, Querverweis in `docs/PROMPTS.md` Phase 6.
- Nach Freigabe: Gründer-Entscheidungen eintragen, Querverweise in KONZEPT 7, 12 (Abweichungen), 13 und 14 (DSFA).
- Quellen gegen das Original prüfen (Maughan 2018, Kreider 2017, Guest 2021, Jäger 2017, EFSA 2015, DGE, BfR 2021,
  Drake 2013, EMA/PRAC 2023, Wortlaute und Pflichthinweise aus VO 432/2012 und 2017/672 im EU-Register).
- Fachprüfung und Rechtsprüfung anfragen (Abschnitt 18).
- _DoD:_ Wächter-Prüfung des Plans (Runde 2), Gründer-Entscheidungen eingetragen.

**Erledigt 19.10.2026:** Plan freigegeben, SU-G1 bis SU-G19 alle „Ja, wie empfohlen“ (Abschnitt 17). Offen und
parallel (Abschnitt 18): Quellen gegen das Original, Fachprüfung, Rechtsprüfung; Querverweise in KONZEPT 7, 12, 13,
14 folgen mit den Etappen, die diese Abschnitte berühren (SU3/SU4).

---

## 5. Etappe SU1 – Core: Regeln, Dosis, Zeitplan, Texte

**Ordner** `packages/core/src/supplements/` (reine Funktionen, keine UI, kein Netzwerk):

- `packages/core/src/supplement-ids.ts` (**außerhalb** beider Ordner, S1) – `SUPPLEMENT_IDS` (`creatine`,
  `caffeine`, `protein_powder`, `vitamin_d`, `omega3`). Ein Blatt **ohne eigene Importe**. Die einzige
  Core-Datei, die das Affiliate-Modul importieren darf.
- `screening.ts` – Zusatzfragen, `supplementScreeningAnswersSchema` (Zod, strikt, Stillzeit nicht bei „männlich“,
  optional `protein_self_check`), `evaluateSupplementScreening()` → Flags.
- `inputs.ts` – `SupplementInputs`: Alter, Geschlecht, Gültigkeit der Einwilligung (v2), Gesundheits-Flags (oder
  `null`), Supplement-Flags (oder `null`), Gewicht (oder `null`), Haupt- und Nebenziel, Level, Ernährungsform,
  „Fisch mag ich nicht“, `training_time`, Eiweiß-Lücke (aus Tagebuch-Schnitt oder Selbsteinschätzung, `null` ohne
  Daten), Monat, Wettkampf ja/nein. **Kein** Feld für Shops, Links oder Provisionen.
- `protein-gap.ts` – `proteinGapFromLog(last7Days, target)` (mind. 4 Tage mit Einträgen) und Selbsteinschätzung (S7).
- `eligibility.ts` – `recommendSupplements(inputs)` → je Supplement `recommended` | `info_only` | `adult_only` |
  `excluded` mit Grund-Schlüsseln; Koffein nur `safety_info` | `safety_info_excluded`. Strengste Regel gewinnt
  (Tabelle 3.3).
- `dosage.ts` – `supplementDose()` (Koffein-Grenze: `min(3 mg/kg, 200 mg)`, auf 10 mg gerundet; ohne Gewicht Text
  statt Zahl), Einheiten-Umrechnung µg/IE.
- `schedule.ts` – `supplementSchedule(recommendation, trainingWeek, chosen)` → Zeitpunkte je Tag für die Supplements,
  die die Person unter „Meine Supplements“ gewählt hat (gratis, SU6). Koffein kommt nicht vor.
- `claims.ts` – `APPROVED_CLAIMS` mit Bedingungen und `required_info_de`.
- `text-rules` – `SUPPLEMENT_FORBIDDEN_TERMS`, `checkSupplementText()` (nutzt die vorhandenen Listen mit).
- `notices.ts` – feste Hinweis-Schlüssel (Arzt, ab 18, Doping, Koffein-Grenzen, Kreatin-Wasser, Vitamin-D-Blutwerte).
- **Keine** `index.ts`/Barrel-Datei im Ordner; Importe nur mit direktem Dateipfad (S1).

**Konstanten** in `constants.ts`: `SUPPLEMENT_RULES`, `CAFFEINE_LIMITS`, `SUPPLEMENT_SCREENING_VERSION`, je mit
Quelle oder PRODUKTENTSCHEIDUNG.

**Tests (Grenzfälle laut CLAUDE.md):**

- Alter 17 Jahre 364 Tage / 18 Jahre 0 Tage; 16, 55, 65 und 90 Jahre.
- Gewicht 40 kg (Koffein-Grenze 120 mg), 66,7 kg (genau 200 mg), 150 kg (Deckel 200 mg), ohne Gewicht.
- 1 vs. 7 Trainingstage (Zeitplan), Ruhetag (Kreatin trotzdem täglich).
- `training_time` jeder Wert; `afternoon` und `varies` mit 16-Uhr-Satz.
- **Eigenschaftstest Monotonie (K14):** über alle Flag-Kombinationen (2^9) **und** Alter, Einwilligung (keine/v1/v2),
  `training_time` und Monat: ein gesetztes Sperr-Flag führt nie zu `recommended`; mehr Flags, jüngeres Alter unter
  18 oder fehlende Einwilligung machen das Ergebnis nie lockerer.
- Keine Einwilligung / nur v1 / kein Check → nur Info.
- Vegan ohne Lücke (Info), vegan mit Lücke (passt, pflanzlich), Tagebuch mit 3 bzw. 4 Tagen (S7).
- Omega-3 mit und ohne Herz-Flag (keine Herz-Angabe).
- Textregeln: jedes verbotene Wort positiv und negativ (z. B. „Medizinball“ erlaubt, „steigert“ verboten).

_DoD:_ alle Funktionen getestet, keine Migration, keine sichtbare App-Änderung, CI-Zusammenfassung
„Beispiel-Empfehlungen“ (`pnpm supplements:examples`, 10 Beispielpersonen) wie bei `adjust:examples`.

### Umsetzungsstand SU1 (19.10.2026)

**Was gilt:**

- **`packages/core/src/supplement-ids.ts`** (Blatt ohne Importe): `SUPPLEMENT_IDS`, `RATED_SUPPLEMENT_IDS` (alles außer
  Koffein, feste Reihenfolge), Typen `SupplementId`/`RatedSupplementId`.
- **`supplements/screening.ts`:** `SUPPLEMENT_FLAGS` (`kidney`, `breastfeeding`, `heart_rhythm`, `caffeine_sensitive`),
  die vier Fragen (3.4), `supplementScreeningAnswersSchema` (strikt, optional `protein_self_check`
  `mostly_yes`/`rather_not`), `createSupplementScreeningAnswersSchema(sex)` (Stillzeit nicht bei „männlich“, sonst
  Pflicht), `supplementScreeningQuestionsFor`, `evaluateSupplementScreening` → Flags.
- **`supplements/inputs.ts`:** `supplementInputsSchema` (Zod, strikt) – Geburtsdatum + Stichtag (daraus Alter und
  Monat), Geschlecht, Fassung der Einwilligung `health_data`, Gesundheits-Flags, Supplement-Flags, Gewicht, Haupt- und
  Nebenziel, Level, Intervall-Einheiten, Ernährungsform, „meidet Fisch“, „meidet Milch“, Trainingszeit, Eiweiß-Lücke,
  „hat Ernährungsziele“, Wettkampf. **Kein Feld für Shops, Links oder Provisionen** (Test). Ohne Einwilligung v2
  müssen alle Gesundheitsdaten `null` sein (Schema-Fehler sonst). `hasSupplementConsent`, `isMinorForSupplements`.
- **`supplements/protein-gap.ts`:** `proteinGapFromLog` (höchstens 7 Tage, mind. 4 mit Einträgen, Schnitt < 90 % des
  Ziels), `proteinGapFromSelfCheck`, `resolveProteinGap` (Tagebuch vor Selbsteinschätzung).
- **`supplements/eligibility.ts`:** `recommendSupplements(inputs)` → je Supplement `recommended | info_only | adult_only
| excluded` mit Grund-Schlüsseln, Hinweis-Schlüsseln, zugelassenen Angaben und Variante (pflanzlich); Koffein nur
  `safety_info` (Modus `personal | general | pregnancy`) | `safety_info_adult_only` | `safety_info_excluded`;
  Seiten-Hinweise (`medical_check` bei Herzrhythmus, K5; `pregnancy_midwife`). Tabelle 3.3 als `FLAG_RULES`, strengste
  Regel gewinnt; `supplementStatusRank`, `caffeineRank`. Dazu `SUPPLEMENT_EVIDENCE`, `SUPPLEMENT_CATEGORIES`.
- **`supplements/dosage.ts`:** `supplementDose` (Kreatin 3 g/Tag, Proteinpulver 20–30 g Eiweiß je Portion, Omega-3
  250–500 mg, Vitamin D nur als allgemeiner Richtwert 20 µg = 800 IE), `proteinServingG` (nie über das Tagesziel),
  `caffeineSingleLimit` (min(3 mg/kg, 200 mg), auf 10 mg abgerundet; ohne Gewicht Tassen-Satz),
  `caffeinePersonalLimitMg`, `caffeineDailyLimitMg`/`caffeinePersonalDailyLimitMg` (Tagesgrenze min(5,7 mg/kg,
  400 mg), abgerundet; Wächter-Befund 3), `vitaminDUgToIu`/`vitaminDIuToUg`, `formatSupplementDose`.
- **`supplements/schedule.ts`:** `SUPPLEMENT_TIMINGS`, `supplementSchedule(recommendation, trainingWeek, chosen)` –
  Kreatin, Omega-3, Vitamin D täglich zu einer Mahlzeit, Proteinpulver an Trainingstagen nach dem Training, nie Koffein.
- **`supplements/claims.ts`:** `APPROVED_CLAIMS` (5 Angaben mit `requiredInfoDe`, Mindestmenge, Herz-Sperre),
  `CANDIDATE_CLAIMS` (Kreatin ab 55, nie angezeigt), `claimBlockText` (Angabe + Pflichthinweis immer zusammen).
- **`supplements/notices.ts`:** 22 feste Hinweis-Schlüssel mit Texten und Platzhaltern (`{dose}`, `{daily}`, `{cup}`,
  `{cups}`, `{gain}`, `{time}`, `{age}`), `renderSupplementNotice`, die zwei Pflichtsätze (3.8 Nr. 4).
- **`supplements/text-rules.ts`:** `SUPPLEMENT_FORBIDDEN_TERMS` (27 Einträge: die Wörter aus 3.8 Nr. 2 inkl.
  abgeleiteter Formen wie „gesteigerte“, „Energiebooster“, „gestärkt“, „stärker“, dazu „fördert“, „erhöht die
  Leistung“, „Leistungsplus“, „Fett verbrennen“), `SUPPLEMENT_AMOUNT_WORDS` (Einheiten mg, g, kg, µg, IE, Milligramm,
  Gramm, Mikrogramm, Kilogramm; Zahlwörter eins–zwölf, hundert, tausend), `checkSupplementText()` (bestehende Listen +
  neue Wörter + Ziffern, Einheiten und Zahlwörter im Freitext + unbekannte Platzhalter).
- **Konstanten** in `constants.ts` (alle „VOR LIVEGANG FACHLICH PRÜFEN“, Quellen bzw. PRODUKTENTSCHEIDUNG):
  `SUPPLEMENT_SCREENING_VERSION`, `SUPPLEMENT_HEALTH_CONSENT_MIN_VERSION` (2), `SUPPLEMENT_RULES`, `CAFFEINE_LIMITS`.
  `CURRENT_CONSENT_VERSIONS.health_data` bleibt 1 (Seed v2 kommt mit SU3).
- **Kein `index.ts`** in `supplements/`; das Paket-`index.ts` reicht die Dateien einzeln weiter.
- **CI:** Schritt „Beispiel-Empfehlungen (Supplemente)“ (`pnpm supplements:examples`, 10 ausgedachte Personen,
  `packages/content/src/supplement-examples.ts`).
- **Keine Migration, keine App-Änderung, keine Inhalte, keine Affiliate-Teile.**

**Tests:** 196 neue Core-Tests in 9 Dateien (Stand nach den Wächter-Auflagen) – `eligibility.test.ts` (59:
Grund-Person, Einwilligung keine/v1/v2/v3, fehlende Checks, Omega-3 ohne Herz-Angabe ohne Einordnung, Alter
15 Jahre 364 Tage (abgelehnt) / 16 / 17 Jahre 364 Tage / 18 Jahre 0 Tage / 55 / 65 / 90, unter 18 und schwanger bzw.
stillend, jede Zeile der Tabelle 3.3, Schwangerschaft und Medikamente zusammen, jede Trainingszeit, ohne Gewicht, vegan
mit/ohne Lücke, Milch, `no_targets`, Ziele für Kreatin, Omega-3 mit/ohne Herz-Flag, Vitamin D je Monat, Doping,
29/30/300/301 kg), `properties.test.ts` (8: alle 2^9 Flag-Kombinationen; Sperr-Flag nie „passt“; ein Flag mehr nie
lockerer; unter 18 nie lockerer; fehlende Einwilligung/Check nie „passt“ und nie persönliche Koffein-Grenze;
Trainingszeit und Monat ändern keinen Status), `dosage.test.ts` (22: Einzelgrenze 30/40/45/66,6/66,7/150/300 kg,
Tagesgrenze 30/40/70/100/300 kg, ohne Gewicht), `schedule.test.ts` (7: 1 vs. 7 Tage, Ruhetag, nichts gewählt, Flag
kommt hinzu), `text-rules.test.ts` (72: jedes Wort positiv und negativ, abgeleitete Formen, Einheiten und Zahlwörter,
alle Hinweise und Fragen, Pflichtsätze, Koffein ohne Stufe/Zweck), `claims.test.ts` (8), `screening.test.ts` (6),
`protein-gap.test.ts` (6: 3 vs. 4 Tage, 90-%-Grenze), `structure.test.ts` (8). Core 5.111 → 5.307 Tests; Content +4
(`supplement-examples.test.ts`). `pnpm plan:examples`, `pnpm nutrition:examples`, `pnpm adjust:examples` vor/nach der
Änderung zeichengleich.

**Strukturtest (SU1-Teil von 9.3):** `supplement-ids.ts` ohne Importe; kein `index.ts` in `supplements/`; Importe in
`supplements/**` (auch Tests) nur mit direktem Dateipfad, kein Ordner/`index`/Paketname, außerhalb des Pakets nur
`zod` (Tests: `vitest`); transitiver Importgraph mit `ts.resolveModuleName` (inkl. `export … from`, `import()`,
`require()`) erreicht weder `affiliate/**` noch `retail/**`; Negativ-Fixtures werden erkannt: `supplements/__fixtures__/forbidden-import.ts` (Ordner-Import) und die Kette
`chain-a.ts` → `chain-b.ts` → `retail/provider.ts` (nur transitiv sichtbar); `import()`/`require()` mit Variable oder
Template-Literal mit `${…}` gilt als dynamisch und wird gemeldet. `typescript` ist devDependency von `packages/core`. Prüfung über `apps/mobile`/`apps/web`, Treffpunkt `compose.ts` und ESLint-Regel folgen mit SU5.

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Koffein unter 18:** eigener Status `safety_info_adult_only` (Tabelle 3.3 „ab 18“; Abschnitt 5 nannte nur
   `safety_info | safety_info_excluded`). Sonst hätte das Alter wie ein Befund geklungen (K2).
2. **Koffein bei `evening`:** Tabelle 3.3 sagt „aus“, 3.5 „keine Angabe vor dem Training“. Umgesetzt wie 3.5: Status
   bleibt Sicherheits-Info, Satz „Du trainierst abends: Nimm vor dem Training kein Koffein.“ – „aus“ hieße
   „ärztlich abklären“ und wäre bei der Uhrzeit falsch. Ohne Trainingszeit (`null`) gilt der 16-Uhr-Satz wie bei
   `varies`.
3. **Ohne Einwilligung v2 werden Gesundheitsdaten nicht verwendet** (Schema verlangt `null`). Damit ist ohne
   Einwilligung alles „Info“, auch wo mit Einwilligung „Nicht für dich“ stünde. Monotonie K14 für die Einwilligung
   daher so geprüft: nie „passt“, nie persönliche Dosis/Koffein-Grenze, nie lockerer als dieselbe Person ohne Flags.
   Die Info-Seite trägt immer die Pflichtsätze („in Schwangerschaft und Stillzeit vorher ärztlich abklären“).
4. **Rangfolge der Koffein-Info:** persönlich < allgemein < nur BfR-Hinweis < ab 18 < ärztlich abklären. Wer
   schwanger ist und Medikamente nimmt, bekommt „ärztlich abklären“. Unter 18 und schwanger oder stillend: „ab 18“
   und zusätzlich der BfR-Hinweis (Wächter-Befund 1).
5. **Kreatin „passt“** bei Haupt- **oder** Nebenziel Muskelaufbau/Definition; beim Ziel Ausdauer nur mit
   `hasIntervalSessions` (neues Eingabefeld, die App liest es aus dem Plan). Fettabbau und Fitness → Info (Tabelle 3.2).
   Der Wasser-Hinweis steht auch auf der Info-Seite.
6. **Proteinpulver-Lücke:** Tagebuch geht vor Selbsteinschätzung (gemessen vor geschätzt). Neue Eingaben
   `hasNutritionTargets` (Modus `no_targets` → nie „passt“, 3.7) und `avoidsDairy` (pflanzliche Variante). Die Portion
   wird auf 5 g abgerundet, unter 5 g Rest kein Shake.
7. **Doping-Hinweis** auf Kreatin **und** Proteinpulver (beide typisch verunreinigt, beide später mit Links), nicht nur
   auf `sport`.
8. **Vitamin D:** zusätzlicher Info-Satz Oktober–März („Sonne reicht oft nicht“, DGE 2012) – einzige Wirkung des
   Monats; nie ein anderer Status. Im Zeitplan erscheint Vitamin D als einziges Info-Supplement, wenn die Person es
   unter „Meine Supplements“ wählt (es ist per Regel nie „passt“).
9. **Zeitplan nur für „passt“** (plus Vitamin D): Info, „ab 18“ und „Nicht für dich“ bekommen keine Zeile.
10. **Pflichthinweise** für `protein_muscle_mass` und die Vitamin-D-Angaben: bis zur Register-Prüfung der allgemeine
    Satz zur abwechslungsreichen Ernährung (`requiredInfoFromRegister: false`). Vitamin-D-Bedingung 15 % NRV = 0,75 µg.
11. **Kreatin ab 55** steht als `CANDIDATE_CLAIMS` ohne Text und wird nie angezeigt (SU-G18: erst nach Prüfung).
12. **Textregeln:** „Mangel“ auch in Zusammensetzungen (Eisenmangel); „Konzentrat“ bleibt erlaubt; „Stärke“
    (Lebensmittel) erlaubt, „stärkt“ verboten; jede Ziffer im Freitext ist ein Fehler (auch „16 Uhr“, „18 Jahre“ –
    deshalb Platzhalter `{time}`, `{age}`). Die Pflichtsätze lösen nur „gesund“ aus (vorgeschriebener Wortlaut, eigener
    Prüfweg), die Angaben nur „Wirkung“ (eigener Prüfweg).
13. **Strukturtest** prüft zusätzlich `retail/**` (Händler-Anbindung mit „Anzeige“) als verbotenes Ziel.
14. **Koffein-Tagesgrenze persönlich** (Wächter-Befund 3): min(5,7 mg/kg, 400 mg), auf 10 mg abgerundet (30 kg →
    170 mg, 40 kg → 220 mg, 70 kg → 390 mg, ab etwa 70,2 kg 400 mg). Der Satz `caffeine_daily` nennt die niedrigere
    Zahl. Fachprüfung vorgemerkt (Abschnitt 18 Nr. 1).
15. **Omega-3-Herz-Angabe nur bei persönlicher Einordnung** (Wächter-Befund 4): ohne Einwilligung v2 oder ohne Checks
    wissen wir nicht, ob ein Herz-Flag vorliegt – die Angabe entfällt dann.
16. **Mindestalter 16** wird auch im Eingabe-Schema geprüft (Wächter-Befund 7).
17. **Tabelle 3.3** trägt zur Zeile „Einheit am Abend“ eine Fußnote zu Präzisierung 2 (Wächter-Befund 6).

**Gegenproben (Regel absichtlich gebrochen → rot → zurückgesetzt):** G1 Medikamente sperren Kreatin nicht (2 Tests
rot), G2 Koffein-Deckel 250 mg (3), G3 Koffein aufgerundet (2), G4 volljährig ab 17 (6), G5 Einwilligung v1 reicht
(2), G6 Herz-Angabe trotz Herz-Flag (2), G7 Abend-Training ohne Koffein-Satz (2), G8 „Booster“ erlaubt (1), G9
Tagebuch mit 3 Tagen (1), G10 Vitamin D „passt“ bei vegan (3), G11 Zeitplan für Info-Einträge (1), G12
`supplement-ids.ts` mit Import (1), G13 Engine importiert `retail/` (1, transitiv), G14 Barrel-Import `'..'` (2), G15
leerer Pflichthinweis (2). Nach den Wächter-Auflagen: G16 unter 18 und schwanger ohne BfR-Hinweis (2), G17 „boost“
nur am Wortanfang (1), G18 Tagesgrenze 6 statt 5,7 mg/kg (4), G19 Herz-Angabe ohne Einordnung (1), G20 Einheiten und
Zahlwörter nicht geprüft (9), G21 Mindestalter nicht geprüft (1), G22 Template-Literal nicht als dynamisch erkannt (1),
G23 „gestärkt“/„stärker“ erlaubt (2).

**Nicht verifiziert:** Quellen und Wortlaute (EU-Register, DGE, BfR, EFSA, Drake 2013) wurden nicht gegen das Original
geprüft (SU0/Abschnitt 18); alle Werte bleiben „VOR LIVEGANG FACHLICH PRÜFEN“. CI-Lauf auf GitHub steht aus (lokal:
`pnpm format:check`, Lint, Typen, Tests für core, db, mobile, content grün).

---

## 6. Etappe SU2 – Inhalte: Schema, Pipeline, Startbestand

- **Inhaltsart** `supplement` in `packages/content/src/pipeline/kinds/` und `content/supplements/<id>.json`.
- **Felder:** `id` (muss in `SUPPLEMENT_IDS` stehen), `version`, `status` (`draft`/`published`/`archived`), `meta`
  (`origin`, `reviewed_by`, `expert_reviewed`), `name_de`, `evidence_level` (bei Koffein leer), `category`,
  `summary_de` (2–3 Sätze), `how_to_de` (mit Platzhaltern), `claim_ids[]`, `sources[]` (Autor, Jahr, Titel,
  Zeitschrift, **DOI oder PMID**), `not_recommended_reason_de` (nur Stufe C).
- **Nicht im Inhalt:** Dosis, Gegenanzeigen, Zeitpunkte, Pflichthinweise. Die stehen im Code (eine Wahrheit,
  getestet).
- **Prüfregeln SK1–SK7** in `packages/core/src/content/` (laufen in `pnpm content:validate` und CI):
  - **SK1** Schema (rot, immer).
  - **SK2** `id` bekannt, keine Doppelungen (rot).
  - **SK3** Textregeln 3.8 Punkt 2 (rot).
  - **SK4** `claim_ids` gültig, Bedingung erfüllt, Pflichthinweis vorhanden (rot).
  - **SK5** keine Dosis-Zahlen im Freitext, nur bekannte Platzhalter (rot).
  - **SK6** Quellen-Pflicht für Stufe A/B, jede Quelle mit DOI oder PMID (rot, K10).
  - **SK7** Stufe C und Koffein ohne `claim_ids`; Koffein ohne `evidence_level` (rot); Texte länger als 600 Zeichen
    (gelb).
- **Startbestand:** 5 Einträge + etwa 12 „Nicht empfohlen“-Einträge als Entwurf aus einer Claude-Sitzung
  (`origin: claude_session`, „KI-Entwurf – fachlich prüfen“). Die Gemini-Batch-Pipeline (`content-generate`)
  kennt die Art ebenfalls, wird für den Startbestand aber nicht gebraucht (SU-G13).
- **Freigabe** wie gehabt: `content-review` setzt `published` per Pull Request, Merge durch einen Menschen.
  `expert_reviewed: true` erst nach der Fachprüfung.
- **Ratgeber-Regel R21H** bleibt: Ratgeber nennen keine Supplement-Dosis, sondern verweisen auf das Modul.

_DoD:_ Schema, Prüfregeln mit Tests, Pipeline-Art mit Probelauf ohne Schlüssel, Startbestand als Entwurf.

### Umsetzungsstand SU2 (19.10.2026)

**Was gilt:**

- **Schema** `packages/core/src/content/supplement-schema.ts` (`supplementContentSchema`, Zod strikt): `id`, `version`,
  `status`, `name_de`, `evidence_level` (`a`/`b`/`c`, bei Koffein `null`), `category` (`sport`, `food`, `diet_season`,
  `safety_info`), `summary_de`, `how_to_de` (Platzhalter; `null` bei Stufe C), `claim_ids[]`, `sources[]` (`authors`,
  `year`, `title`, `journal`, `doi`, `pmid` – DOI im Format `10.xxxx/…`, PMID nur Ziffern), `not_recommended_reason_de`
  (nur Stufe C), `meta` (gleiches Herkunftsschema wie alle Inhalte: `origin`, `model`, `reviewed_by`,
  `expert_reviewed` …). Freigegeben nur mit Prüfer. Höchstens 1.000 Zeichen je Text (`SUPPLEMENT_CONTENT_LIMITS` in
  `constants.ts`).
- **Liste „Nicht empfohlen“** `NOT_RECOMMENDED_SUPPLEMENTS` (ID → Kategorie) im selben Schema-Modul, **nicht** in
  `supplement-ids.ts`: Dieses Blatt teilen Empfehlung und Affiliate-Modul (SU5); dort stehen nur Supplemente, die
  eingeordnet werden. Technisch verhindert das allein noch nichts (das Schema-Modul ist importierbar). **Für SU5
  vorgemerkt:** Strukturtest „keine ID aus `NOT_RECOMMENDED_SUPPLEMENTS` und kein Koffein in der
  Affiliate-Konfiguration“. `SUPPLEMENT_CONTENT_IDS` = `SUPPLEMENT_IDS` + diese Liste.
- **Prüfregeln** `packages/core/src/content/supplement-checks.ts`, eingebunden in `validateContent` (damit in
  `pnpm content:validate`, ci, content-collect/-review/-seed und im Redaktionsbereich):
  - **SK1** Schema (rot, blockiert immer – wie Ü1/R1).
  - **SK2** ID bekannt, keine Doppelung (zwei Dateien mit gleicher ID), Kategorie wie im Core (`SUPPLEMENT_CATEGORIES`
    bzw. `NOT_RECOMMENDED_SUPPLEMENTS`).
  - **SK3** `checkSupplementText` (alle Listen aus SU1) in Name, Beschreibung, Anwendung und Grund. Quellen-Titel sind
    Zitate und werden nicht geprüft.
  - **SK4** jede `claim_id` steht in `APPROVED_CLAIMS` (Kandidaten wie `creatine_strength_55plus` nie), gehört zu
    diesem Supplement, ihre Mindestmenge wird von der Core-Dosis erfüllt (`claimConditionMet`: Kreatin `dailyG` ≥ 3 g,
    Omega-3 Untergrenze ≥ 250 mg, Vitamin D Richtwert ≥ 15 % NRV) und ihr Pflichthinweis ist nicht leer
    (`claimRequiredInfo`).
  - **SK5** keine Ziffern, Einheiten oder Zahlwörter im Freitext; nur Platzhalter, die der Core für dieses Supplement
    füllt (`SUPPLEMENT_CONTENT_PLACEHOLDERS`: Kreatin `{dose}` `{gain}`, Proteinpulver/Vitamin D/Omega-3 `{dose}`,
    Koffein `{dose}` `{daily}` `{cup}` `{cups}` `{time}`, Stufe C keine). Im Namen sind Ziffern erlaubt („Omega-3“),
    Platzhalter nicht.
  - **SK6** Stufe A/B mit mindestens einer Quelle; jede Quelle mit DOI oder PMID; keine doppelte Quelle.
  - **SK7** Stufe wie im Core (`SUPPLEMENT_EVIDENCE`; Koffein `null`; Liste „Nicht empfohlen“ `c`); Stufe C und Koffein
    ohne `claim_ids`; Koffein-Texte ohne Zweck oder Stufe (gleiche Wortliste wie der SU1-Test); Stufe C ohne Anwendung
    und mit Grund, sonst Anwendung Pflicht und kein Grund.
  - **SK7H** (gelb) Text länger als 600 Zeichen.
  - Rot blockiert wie bei allen Inhalten nur freigegebene Einträge (SK1 immer); dazu gelten DATEI, VERSION und
    PROBELAUF.
- **Pipeline-Art** `supplement` (`packages/content/src/pipeline/kinds/supplement.ts`, Workflow-Eingabe `supplements`,
  Standard `gemini-3.8-flash`, Denktiefe `medium`, 6.000 Token): eine Zelle je ID, Auswahl über `empfohlen` /
  `nicht_empfohlen` oder die ID. Das Modell schreibt **nur** Name, Beschreibung und Anwendung bzw. Grund; Stufe,
  Kategorie und Angaben setzt der Code aus dem Core; `sources` bleibt leer (eine KI erfindet leicht DOIs – Quellen trägt
  ein Mensch ein, bis dahin meldet SK6 den Entwurf rot). Probelauf ohne Schlüssel: zwei gültige Entwürfe
  (`probelauf-creatine`, `probelauf-bcaa`), eine ungültige und eine abgelehnte Antwort, bis zum Pull Request
  (Ende-zu-Ende-Test).
- **Seed:** `content-seed` prüft die Supplemente mit (ein Schemafehler blockiert wie überall), spielt sie aber **nicht**
  ein – auch freigegebene nicht – und nennt im Bericht nur die Anzahl. Einspielen kommt mit SU3.
- **content-review:** kannte die Supplemente in SU2 noch nicht – seit SU3 Art „ids“ mit Supplement-IDs bzw. dem
  Stichwort `supplemente` (Umsetzungsstand SU3).
- **Startbestand** `content/supplements/` (18 Dateien, alle `draft`, `origin: claude_session`, `expert_reviewed:
false`, in der App „KI-Entwurf – fachlich prüfen“): Startliste `creatine`, `protein_powder`, `vitamin_d`, `omega3`,
  `caffeine`; „Nicht empfohlen“ `bcaa`, `glutamine`, `l_carnitine`, `cla`, `fat_burner`, `testo_booster`,
  `pre_workout`, `hmb`, `ashwagandha`, `collagen`, `multivitamin`, `iron`, `melatonin`. Quellen (nur DOI):
  Kreider 2017, Maughan 2018, Jäger 2017, Morton 2018, DGE 2012 (Ann Nutr Metab), EFSA 2016 (Vitamin D), EFSA 2012
  (UL Vitamin D; UL EPA/DHA), EFSA 2023 (UL Vitamin D, Erwachsene weiter 100 µg), EFSA 2010 (Fette), EFSA 2015
  (Koffein), Drake 2013, Wolfe 2017 (BCAA); bei Kreider 2017 zusätzlich PMID 28615996.

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **IDs der Liste „Nicht empfohlen“:** Plan 6 verlangt `id` ∈ `SUPPLEMENT_IDS`, der Startbestand aber etwa 12
   Einträge außerhalb davon. Gelöst mit der getrennten Liste `NOT_RECOMMENDED_SUPPLEMENTS` (SK2 kennt beide).
   **Für SU3 vormerken:** Die Aufzählung `supplement_id` (7.1) braucht diese IDs ebenfalls, oder die Tabelle
   `supplements` nutzt `text` mit Prüfung gegen die Liste.
2. **Natriumbicarbonat** fehlt vorerst (13 statt 14 Einträge): Die Studienlage ist gut, Stufe C wäre falsch
   beschriftet. Das ist **keine** getroffene Entscheidung, sondern offen als SU-G20 (Abschnitt 17) mit Empfehlung.
3. **Namen ohne verbotene Wörter:** „Fatburner“, „Testo-Booster“ und „Pre-Workout-Booster“ verstoßen selbst gegen 3.8
   Nr. 2. Sie heißen „Abnehm-Kapseln und -Pulver“, „Tribulus, D-Asparaginsäure und ähnliche Mischungen“ und
   „Pre-Workout-Mischungen“ (IDs bleiben `fat_burner`, `testo_booster`, `pre_workout`).
4. **Kategorie bei Stufe C:** Melatonin, Ashwagandha und die Mischungen als `sport` (dort begegnen sie Nutzerinnen und
   Nutzern), Kollagen als `food`, Multivitamin und Eisen als `diet_season`. Nie `safety_info`.
5. **SK7 deckt zusätzlich ab:** Stufe C hat keine Anwendung (`how_to_de: null`), sonst ist sie Pflicht – „nicht
   empfohlen“ und eine Anleitung zur Einnahme passen nicht zusammen.
6. **Doppelte Quellen** (gleiche DOI, Groß-/Kleinschreibung egal) sind SK6 rot.
7. **Probelauf-IDs** (`probelauf-…`) sind im Schema erlaubt (Bindestrich), SK2 meldet sie als unbekannt – rot am
   Entwurf, nie freigebbar (PROBELAUF).

**Tests:** Core 5.307 → 5.357 (48 in `supplement-checks.test.ts`: jede Regel positiv und negativ, Grenzfälle 600/601 und 1.000/1.001
Zeichen, Kreatin 3 g / 2,99 g, Omega-3 249 mg, Vitamin D 0,74/0,75 µg, falsche Einheit, leerer Pflichthinweis,
Blockieren nur bei „published“, PROBELAUF, Versionsregel; `rules.test.ts` Regeltabelle). Content: Startbestand
(`supplements-startbestand.test.ts`: genau die bekannten IDs, keine Befunde – auch keine gelben –, alle Entwurf aus der
Claude-Sitzung, jede zugelassene Angabe genau einmal), Pipeline (Zellen, Antwort → Datei, Anfrage-Text, Probelauf
Ende-zu-Ende), Seed (geprüft, nicht eingespielt, SK1 blockiert), `content:validate` (Ordner, fremde Datei).

**Wächter-Auflagen SU2 (19.10.2026, „freigabefähig mit Auflagen“) umgesetzt:**

- **M1** Mengenwörter: dreizehn–neunzehn, zwanzig–neunzig (auch „einundzwanzig“ … „neunundneunzig“), alles mit
  hundert/tausend („dreihundert“), „Dutzend“, „halb…“/„doppel…“ (auch „Halbmarathon“), Einheiten „gr“ und
  „Internationale Einheit(en)“. Keine Fehltreffer bei „halten“, „deshalb“, „zehnmal“.
- **M2** Schema-Texte lehnen unsichtbare Zeichen (`\p{Cf}`, `\p{Cc}` außer Zeilenumbruch, z. B. weiches Trennzeichen,
  Nullbreiten-Leerzeichen) und Zeichen außerhalb von Latin/Common/Inherited (z. B. kyrillisches „о“) ab → SK1.
- **M3** `name_de` wird auf Mengenwörter geprüft; Ziffern nur als „-3“ ohne folgenden Buchstaben (Omega-3).
- **M4** SK3 zusätzlich: alle Formen von „wirk…“ („wirksamsten“), „effektiv“, „verbrenn…“, „mehr
  Kraft/Muskeln/Ausdauer/Energie/Power“, „erhöht … Kraft/Muskel“, „hilft (dir) bei(m)“, „gegen …“.
- **M5** Koffein-Zweckwörter zusätzlich: Power, Schwung, müd…, munter, Kick, Push, wach.
- **N6** „{{dose}}“ und einzelne Klammern → SK5. **N3** Namen der Pipeline = Namen im Startbestand (Test). **N7/N8**
  Texte Kreatin, L-Carnitin, Ashwagandha (Satz zu Schwangerschaft/Stillzeit gestrichen – dafür gilt der feste
  Pflichtsatz) angepasst. **N10** EFSA 2023 bei Vitamin D und im Quellkommentar in `constants.ts`.
- Bewusst **nicht** rot (Probeskript des Wächters): Quellen-Titel (Zitate, keine eigene Aussage); formal gültige, aber
  falsche DOI (offline nicht prüfbar – dafür die Quellenprüfung); römische Zahlen („V“, Fehltreffer bei „Vitamin D“);
  Stufe C ohne Quelle (Plan: Pflicht nur für A/B); Text über 600 Zeichen (gelb laut Plan).

**Quellen:** DOIs am 19.10.2026 per Websuche bestätigt (Wächter). Alle Texte sind KI-Entwürfe – Fachprüfung und
Rechtsprüfung (Health-Claims) stehen aus.

---

## 7. Etappe SU3 – Datenbank (nur additiv, RLS, pgTAP)

### 7.1 Neue Aufzählungen

`supplement_id`, `supplement_evidence` (`a`, `b`, `c`), `supplement_category` (`sport`, `food`, `diet_season`,
`safety_info`), `supplement_timing`, `supplement_flag` (`kidney`, `breastfeeding`, `heart_rhythm`,
`caffeine_sensitive`), `user_supplement_status` (`taking`, `not_for_me`), `dose_unit` (`g`, `mg`, `ug`). Gleich in
`enums.ts` (`db-sync.test.ts`).

### 7.2 Tabellen und Funktionen

| Tabelle / Funktion               | Inhalt                                                                                                                                                                                                                                                                                         | RLS / Zugriff                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `consent_documents` (bestehend)  | **Seed `health_data` v2** (Text aus 11.1)                                                                                                                                                                                                                                                      | wie bisher                                                                                                 |
| `supplements`                    | freigegebene Inhalte aus `content/supplements` (nur `published`/`archived`)                                                                                                                                                                                                                    | lesen: alle Angemeldeten; schreiben nur `seed_content()` (`service_role`)                                  |
| `supplement_screening`           | `user_id` (PK), `answers` jsonb (strikte Schlüssel), `flags supplement_flag[]` (Trigger), `version`, Zeit                                                                                                                                                                                      | nur eigene Zeile; Schreiben nur über RPC mit gültiger Einwilligung `health_data` **v2** (Sperre FOR SHARE) |
| `user_supplements`               | `user_id`, `supplement_id`, `status`, `updated_at` (PK `user_id, supplement_id`)                                                                                                                                                                                                               | nur eigene Zeilen; Schreiben nur mit gültiger Einwilligung `health_data` v2                                |
| `affiliate_shops`                | `id`, `name`, `countries app_locale[]`, `network`, `active`                                                                                                                                                                                                                                    | lesen nur, wenn Flag `affiliate_enabled` an **und** `active` (S2); schreiben nur Seed                      |
| `affiliate_links`                | `id` (zufällig), `supplement_id`, `shop_id`, `url` (Partner-Link, https), `target_url` (Shop-Seite für die Link-Prüfung, S9), `product_name_de`, `dose_per_daily_serving` + `dose_unit`, `single_ingredient`, `contains_caffeine`, `tested_list`, `tested_checked_on`, `valid_until`, `active` | lesen nur, wenn Flag an, aktiv, `valid_until >= now()`; schreiben nur Seed; **keine** Spalte für Provision |
| `private.affiliate_click_counts` | `link_id`, `day`, `platform`, `count` (PK aus den drei)                                                                                                                                                                                                                                        | kein Zugriff für App-Rollen                                                                                |
| `public.count_affiliate_click()` | Wrapper-RPC (K13, Muster `ai_food_photo_*`), ruft `private.count_affiliate_click()`; prüft Flag und Link                                                                                                                                                                                       | `execute` nur für `service_role`                                                                           |

Die SELECT-Policies lesen das Flag über eine `security definer`-Funktion `private.feature_enabled('affiliate_enabled')`.
`constants.ts` enthält nur den Standard für den Testmodus – die Datenbank ist die eine Wahrheit (S2).

**Abweichung von KONZEPT 12:** Keine Tabelle `supplement_contraindications` (Regeln stehen nur im Core,
eine Wahrheit) und `user_supplements` statt `user_supplement_plans` (der Plan wird berechnet, gespeichert wird nur,
was die Person selbst gewählt hat).

### 7.3 Widerruf, Konto löschen, Export

- Widerruf `health_data` löscht `supplement_screening` und `user_supplements` (gemeinsame Widerrufs-Funktion wie
  `weight_goals`). Dialogtext nennt „Supplement-Check und Meine Supplements“.
- Konto löschen: Kaskade.
- Export: beide Tabellen in `DATA_EXPORT_TABLES` und im App-Export (Testmodus).
- Klick-Zähler enthalten keine personenbezogenen Daten und gehören nicht in den Export.

### 7.4 pgTAP und Abgleich

- RLS: fremde Zeilen unsichtbar; Schreiben ohne Einwilligung schlägt fehl; Widerruf löscht.
- **Einwilligung v2 (B1):** Schreiben in `supplement_screening`/`user_supplements` **nur mit v2**; mit nur v1 scheitert
  es. Bestehende Gesundheitsdaten (v1) bleiben lesbar und erhalten; Schreiben anderer Gesundheitsdaten folgt der
  bestehenden Versionsregel (`current_consent_version`) – Test, dass nach dem Seed von v2 und erneuter Zustimmung
  alles wieder schreibbar ist.
- `private.affiliate_click_counts` hat genau die Spalten `link_id, day, platform, count` (Test schlägt fehl, wenn
  jemand `user_id` o. Ä. ergänzt).
- Flag aus → `affiliate_links`/`affiliate_shops` liefern 0 Zeilen, `count_affiliate_click` zählt nicht (S2).
- Abgelaufene Links (`valid_until` in der Vergangenheit) sind unsichtbar.
- Flags im Trigger = `evaluateSupplementScreening()` (`db-sync.test.ts`).
- Seed: `content-seed` spielt Supplements und Affiliate-Daten in einer Transaktion ein.

_DoD:_ Migrationen additiv, RLS auf jeder Tabelle, Seed `health_data` v2, pgTAP grün (`db-test`), Typen generiert
(`db-types`).

### Umsetzungsstand SU3 (21.10.2026)

**Was gilt:**

- **Migrationen (nur additiv):** `20261021120000_supplement_enums.sql` (`supplement_id`, `supplement_evidence`,
  `supplement_category`, `supplement_flag`, `user_supplement_status`), `20261021120100_supplements.sql` (Tabelle
  `supplements` + `seed_supplements`), `20261021120200_supplement_user_data.sql` (Einwilligung v2, Supplement-Check,
  „Meine Supplements“, Widerruf, Export).
- **`supplements`:** nur `published`/`archived` (CHECK), `data` = Datei mit neutralisierten Prüfer-Namen, `name_de`,
  `evidence_level` (Koffein `NULL`, CHECK), `category` (`safety_info` nur Koffein), `expert_reviewed` berechnet. RLS:
  Angemeldete lesen nur `published`, anon nichts; schreiben nur `seed_supplements` (`service_role`): eine Transaktion,
  idempotent, nur bekannte IDs (`SUPPLEMENT_CONTENT_IDS`, keine Probelauf-Einträge), Versionen sinken nie, archivieren
  statt löschen, Testphase-Schalter `p_require_expert_review` wie bei Workouts.
- **Einwilligung `health_data` Fassung 2** (Text 11.1, wörtlich gleich `consent-texts.ts`): als **Entwurf**
  (`published_at NULL`). Damit verliert niemand eine Einwilligung, bis die juristische Prüfung durch ist; die
  Veröffentlichung ist eine eigene kleine Migration (HANDY-ANLEITUNG Teil 7u). `CURRENT_CONSENT_VERSIONS.health_data`
  = 2 (höchste Fassung im Seed; Testmodus nutzt Fassung 2). Die pgTAP-Tests, die selbst eine Fassung 2 anlegen
  (02, 13, 18, 43), veröffentlichen sie jetzt per Upsert.
- **`supplement_screening`** (eine Zeile je Person, SENSIBEL): Antworten strikt, Stillzeit nicht bei „männlich“,
  Flags berechnet der Trigger (= `evaluateSupplementScreening`), Fassung der Fragen. **`user_supplements`**
  (SENSIBEL): `taking`/`not_for_me`, nie Koffein (CHECK). Lesen nur eigene Zeilen; Schreiben nur über
  `save_supplement_screening` bzw. `set_user_supplement` – beide über `private.require_supplement_consent()` (eigene
  Einwilligung FOR SHARE, gültig UND aktuelle Fassung ≥ 2). `set_user_supplement(…, NULL)` und
  `delete_my_supplement_data()` gehen immer (Recht auf Löschung).
- **Widerruf und Export:** `consents_after_revoke` löscht beide Tabellen (am Anfang und in der Wiederholung),
  `export_my_data` enthält beide (Obermengen der neuesten Fassungen; `DATA_EXPORT_TABLES` ergänzt). Konto löschen:
  Kaskade.
- **Seed:** `content-seed` spielt freigegebene Supplemente mit derselben Einspiel-Regel und demselben Schutz vor
  Massen-Archivierung wie Workouts ein; fehlt die Tabelle, mit Hinweis übersprungen.
- **Freigabe:** `content-review` Art `ids` erkennt Supplement-IDs (Unterstrich) bzw. das Stichwort `supplemente` (alle
  Entwürfe) → `planSupplementRelease` (Core): nur Entwürfe ohne roten Befund im Stand danach, Prüfer und Datum, Häkchen
  „fachlich geprüft“; gemischte Läufe (Supplemente + andere Inhalte) werden abgelehnt.

**Bewusst noch nicht (Präzisierungen):**

1. **Keine Affiliate-Tabellen** (`affiliate_shops`, `affiliate_links`, Klick-Zähler, Flag `affiliate_enabled`) –
   Gründer-Auftrag 21.10.2026: Supplemente ohne Shops. Sie kommen vollständig mit SU5.
2. Aufzählungen `supplement_timing` und `dose_unit` fehlen (nur der Core rechnet Zeitpunkte; Mengen je Produkt erst
   mit SU5).
3. `supplements.id` ist `text` mit Format-CHECK und bekannter ID-Liste im Seed (Präzisierung SU2 Nr. 1), die Auswahl
   „Meine Supplements“ nutzt die Aufzählung `supplement_id` (nur eingeordnete Supplemente).
4. `delete_my_supplement_data()` (nicht im Plan): Löschen ohne Widerruf der ganzen Einwilligung.

**Tests:** pgTAP `70_supplements.test.sql` (34: Tabelle, CHECKs, RLS, Seed mit allen Regeln) und
`71_supplement_user_data.test.sql` (48: Fassung 2 Entwurf/veröffentlicht, Schreiben mit nur v1 scheitert, v1-Daten
bleiben lesbar und nach erneuter Zustimmung schreibbar, Trigger-Flags, Stillzeit/männlich, RLS, Koffein, Export,
Löschen ohne Einwilligung, Widerruf). `db-sync.test.ts` (Aufzählungen, IDs, Fragen, Fassungen, Sperre, RLS, neueste
Widerruf-/Export-Fassung, SENSIBEL-Test). Core: `supplement-release.test.ts`, `profile-inputs.test.ts`,
`overview.test.ts`. Content: `review-supplements.test.ts`, Seed-Tests für Supplemente.

---

## 8. Etappe SU4 – App (Testmodus zuerst, dann Supabase)

### 8.1 Bildschirme

- **Re-Consent (B1):** Wer nur `health_data` v1 hat, sieht in Ernährung → Supplemente (und auf „Heute“ einmalig) eine
  Hinweis-Karte „Wir haben die Einwilligung zu Gesundheitsdaten ergänzt“ mit Link zum neuen Text und „Zustimmen“.
  Nichts wird gelöscht; ohne Zustimmung bleibt das Modul im Info-Modus. Gleicher Ablauf wie bei anderen neuen
  Fassungen (`einwilligungen.tsx`).
- **Ernährung → „Supplemente“** (neuer Abschnitt) → `/supplemente`:
  - Einleitung: „Zuerst kommt das Essen. Diese Ergänzungen haben eine gute Studienlage.“
  - Gruppen „Passt zu dir“, „Zur Info“ (inkl. Vitamin D), „Ab 18 Jahren“, „Nicht für dich – bitte ärztlich
    abklären“, darunter „Koffein: Was du wissen solltest“ (Sicherheits-Info), unten „Nicht empfohlen“ (Stufe C,
    eingeklappt).
  - Ohne Einwilligung oder Check: nur allgemeine Liste mit Knopf „Check machen“ bzw. Hinweis auf die Einwilligung.
- **`/supplemente/check`** – 4 Fragen (+ optional Eiweiß-Selbsteinschätzung), Fortschritt, Speichern. Erklärt
  vorher, wofür die Antworten dienen.
- **`/supplemente/[id]`** – Name, Studienlage als Wort (ohne Zweck), zugelassene Angabe mit Pflichthinweis
  (`ClaimBlock`), persönliche Dosis und Zeitpunkt, Hinweise, Doping-Hinweis (falls zutreffend), Pflichtsätze, Quellen
  (eingeklappt). Darunter, **klar abgesetzt**, der Bereich „Wo kaufen“ mit Shop-Links (SU5). Knopf „Nehme ich“ /
  „Nicht für mich“.
- **Einstellungen → „Meine Supplements“** und „Supplement-Check ändern“.

### 8.2 Zustände

Laden, leer (keine freigegebenen Inhalte: „Kommt bald“), Fehler, offline (Inhalte aus dem Zwischenspeicher, Check
offline lesbar, Speichern später), keine Einwilligung, nur v1 (Re-Consent-Karte), Check fehlt, unter 18 (nur
allgemeine Infos, freundlicher Satz).

### 8.3 Testmodus

`localDb.supplementScreening`, `localDb.userSupplements` mit denselben Regeln (`local-rules.ts`, inkl. v2-Pflicht),
Beispiel-Inhalte aus dem Repository, „Testdaten löschen“ und Export. Testschalter „Einwilligung nur v1“ zum Prüfen
der Re-Consent-Karte.

### 8.4 Texte und Barrierefreiheit

`i18n/de-supplements.ts`, geprüft gegen die Listen aus 3.8 (Test). Hell/dunkel, Screenreader-Beschriftungen, große
Schrift. Keine Farben als einziges Signal („Nicht für dich“ mit Symbol und Text).

_DoD:_ Playwright im Testmodus (Re-Consent v1 → v2 ohne Datenverlust, Übersicht, Check, Sperre bei Schwangerschaft,
unter 18, Abend-Training, Koffein ohne „passt“), Unit-Tests der App-Helfer, Supabase-Modus mit RPCs.

### Umsetzungsstand SU4 (21.10.2026)

**Was gilt:**

- **Core:** `buildSupplementInputs` (`supplements/profile-inputs.ts`) entscheidet, welche Angaben in die Einordnung
  dürfen – Gesundheits-Check, Supplement-Check, Gewicht, Eiweiß-Lücke (Tagebuch der letzten 7 Tage, nur vollständige
  Tage, vor der Selbsteinschätzung) und Unverträglichkeiten nur mit gültiger Einwilligung Fassung ≥ 2; „Fisch mag ich
  nicht“ immer; Check älterer Fragen-Fassung zählt nicht; Stillzeit-Antwort nicht bei „männlich“.
  `supplementOverview`/`supplementDetail` (`supplements/overview.ts`): Gruppen, Menge nur wo der Core eine liefert,
  Anwendung nur mit Menge, Angaben nur mit Pflichthinweis und nur, wenn Inhalt UND Einordnung sie nennen, Pflichtsätze,
  „Nehme ich“ nur bei persönlicher Einordnung und „passt“ (bzw. Vitamin D als Info), veraltete Auswahl wird gemeldet.
  `user-data.ts`: Schemas für Check und Auswahl.
- **App:** `/supplemente` (Übersicht), `/supplemente/check`, `/supplemente/[id]`; Einstieg über **Mehr → Essen →
  Supplemente**, **Ernährung** (Knopf unten) und **Einstellungen** („Meine Supplements“, „Supplement-Check ändern“).
  Bereichsfarbe Ernährung (grün), neues Icon `pill` in `design.tsx`, `SupplementRow`, `StatusPill` (Symbol + Text) und
  `ClaimBlock` in `components/supplements.tsx`, Texte in `i18n/de-supplements.ts` (Textregeln-Test).
- **Zustände:** Laden, Fehler mit „Erneut versuchen“, leer („Kommt bald“), offline (Inhalte aus dem Zwischenspeicher;
  Check und Auswahl brauchen Verbindung – sie werden im Supabase-Modus nie auf dem Gerät gespeichert), keine
  Einwilligung, alte Fassung (Karte „Einwilligung ergänzt“ → `/health-consent`), Fassung 2 noch nicht veröffentlicht
  (Hinweis, Info-Modus), Gesundheits-Check fehlt, Check fehlt, unter 18, Testphase-Kennzeichen je Eintrag.
- **Testmodus:** Inhalte aus dem Bündel (Entwürfe ohne roten Befund, gelber Hinweis „Entwürfe“), Check und Auswahl im
  Gerätespeicher mit denselben Regeln (`supplement-local.ts`), Widerruf löscht, Export enthält beides, Testschalter
  „Einwilligung nur alte Fassung“.
- **Supabase-Modus:** Tabelle `supplements` (Zwischenspeicher nur Inhalte), RPCs aus SU3; Fehler „Einwilligung fehlt“
  → klarer Hinweis.
- **Widerrufs-Dialog** nennt „den Supplement-Check und „Meine Supplements““.

**Bewusst noch nicht:** kein Bereich „Wo kaufen“ (SU5), keine Zeile auf „Heute“ (SU6), keine Hinweis-Karte auf
„Heute“ (Re-Consent nur im Supplement-Bereich und wie bisher in Einstellungen/Einwilligungen), „Supplemente“ ist kein
eigener Menüleisten-Knopf (nur Kachel unter „Mehr“; ein Knopf bräuchte eine Änderung an `save_app_layout`).

**Tests:** App-Vitest `supplements.test.ts` (Bündel, Datenbank-Zeilen, Abbildung der Zeilen inkl. Einwilligung
v1/v2/keine, Testmodus-Regeln, Export, Widerruf, Testschalter), `de-supplements.test.ts` (Textregeln für alle Texte),
`consent-texts.test.ts` (Fassung 2 = Seed). Playwright `supplements.spec.ts` (Check → Kreatin passt, Koffein abends,
Detail mit Angabe + Pflichthinweis, Quellen, „Nehme ich“, „Nicht empfohlen“; Re-Consent ohne Datenverlust;
Medikamente → „Nicht für dich“; unter 18; ohne Einwilligung).

---

## 9. Etappe SU5 – Affiliate (getrennt von der Empfehlung)

### 9.1 Grundregel

**Affiliate beeinflusst nur, WELCHER Shop verlinkt wird – nie, OB oder WELCHES Supplement empfohlen wird.**

### 9.2 Aufbau

- **Modul** `packages/core/src/affiliate/` (ohne `index.ts`):
  - `schemas.ts` – Zod für Shops und Links: `url` nur https, keine Platzhalter für Nutzer-IDs; Query-Parameter nur
    aus einer **weißen Liste je Partnernetzwerk** (K7), nie Nutzer- oder Sub-ID.
  - `select.ts` – `affiliateLinksFor({ supplementIds, country })` (Zod `strictObject`: zusätzliche Felder wie Alter
    oder Flags werden abgelehnt). **Kein Parameter `requireTested`** – die Prüf-Pflicht gilt immer (S1). Gibt je
    Supplement höchstens 3 Links zurück.
  - **Reihenfolge:** alphabetisch nach Shop-Name (SU-G9). Es gibt **kein Feld für Provision**.
- **Zusammenführen** nur in `packages/core/src/supplements-view/compose.ts`: nimmt das fertige Ergebnis von
  `recommendSupplements()` und hängt Links **nur** an Einträge mit `recommended` an. `info_only`, `adult_only`,
  `excluded` und Koffein bekommen nie Links. Unter 18 nie Links.
- **Inhalte** unter `content/affiliate/shops.json` und `content/affiliate/links.json` – das Repository ist die
  Wahrheit, Änderungen per Pull Request mit Prüfvermerk (Prüfliste, Datum, Dosis-Beleg).
- **Prüfregeln AF1–AF5:**
  - **AF1** Schema, weiße Liste der Parameter (rot).
  - **AF2** Supplement bekannt und nicht Koffein (rot).
  - **AF3** Prüfliste gesetzt, Prüfdatum höchstens 12 Monate alt (S8: **rot nur für Links, die im Pull Request
    geändert werden**, sonst gelb).
  - **AF4** `valid_until` in der Zukunft (S8: rot nur für geänderte Links, sonst gelb; die Laufzeit blendet
    Abgelaufenes ohnehin aus).
  - **AF5** Produkt passt zur Dosis (S4): Vitamin D ≤ 20 µg je Tagesdosis, EPA+DHA ≥ 250 mg, Kreatin reines
    Monohydrat (`single_ingredient`), kein Produkt mit `contains_caffeine`, Proteinpulver ohne Stimulanzien (rot).

### 9.3 Strukturtest (Pflicht, läuft in CI)

1. **Transitiver Importgraph (S1):** Ein Vitest-Test löst für jede Datei in `packages/core/src/supplements/**` alle
   Importe mit der TypeScript-Modulauflösung (`ts.resolveModuleName`) auf, auch über Zwischenmodule, `export … from`,
   `require()` und `import()`. Kein erreichbares Ziel darf in `affiliate/**` liegen.
2. **Keine Barrels:** In `supplements/**` und `affiliate/**` sind Importe von `index.ts`, Ordnern (`..`) und dem
   eigenen Paketnamen (`@…/core`) verboten; `import()` nur mit festem Text.
3. **Weiße Liste für `affiliate/**`:** nur `supplement-ids.ts` (ein Blatt ohne Importe) und `zod`.
4. **Einziger Treffpunkt:** `affiliate/**` wird nur von `supplements-view/compose.ts` (Core) und
   `apps/mobile/src/lib/affiliate*` importiert. `compose.ts` ist die **einzige** Datei, die beide Module erreicht –
   geprüft über Core, `apps/mobile` und `apps/web`.
5. **Negativ-Fixture:** Eine absichtlich verbotene Testdatei unter `__fixtures__` muss den Test rot machen (Test des
   Tests), sonst bliebe unbemerkt, wenn der Test nichts mehr findet.
6. **ESLint** `no-restricted-imports` zusätzlich für schnelle Rückmeldung im Editor.
7. **Eigenschaftstest:** Für 500 zufällige Link-Sammlungen (auch leer) ist die Liste und Reihenfolge der empfohlenen
   Supplements nach `compose()` identisch mit `recommendSupplements()`. Ein Supplement ohne Link wird trotzdem
   empfohlen.

### 9.4 Klick-Tracking ohne Gesundheitsdaten

- **Laden der Links (S3):** Die App lädt **alle** aktiven Links ungefiltert (ohne `supplement_id=in.(…)`) und wählt
  auf dem Gerät aus. So steht die Eignung nie in Supabase-API-Logs. Test im Supabase-Backend der App: Abfrage ohne
  Filter.
- Link in der App zeigt auf `https://<web>/go/<link_id>` (Route in `apps/web`, `preferredRegion = 'fra1'`,
  `runtime = 'nodejs'`).
- Die Route prüft Flag und Link (sonst **404**, S2), erhöht über `public.count_affiliate_click()` den Zähler (Link,
  Tag, Plattform) und leitet mit 302 zum Shop weiter. Kopfzeilen `Referrer-Policy: no-referrer`,
  `Cache-Control: no-store`.
- **In unserer Datenbank nicht gespeichert:** Nutzer-ID, IP, Gerät, Seite, von der geklickt wurde, Grund der
  Empfehlung. Keine Cookies, kein `Authorization`-Kopf. In der Shop-URL steht keine Nutzer- oder Sub-ID.
- **Vercel-Protokolle (S3):** Vercel speichert IP und Pfad (`/go/<link_id>`) kurzzeitig in den eigenen Request-Logs.
  Keine Log Drains, kein Vercel Web Analytics; ein Vitest-Test fängt `console.*` in der Route ab (nichts wird
  geloggt). Speicherdauer in DSFA und Datenschutzerklärung.
- Die Link-ID ist eine zufällige Kennung (keine sprechende ID wie „kreatin-shop-x“).
- **Auswertung:** Workflow `affiliate-report` (manuell **und** monatlich per `schedule`, S9) gibt Klicks je Link und
  Monat aus (ohne Personenbezug) und prüft per HEAD-Anfrage **nur `target_url`** (die Shop-Seite), nie die
  Partner-URL – so entstehen keine falschen Klicks. Ist das Repository öffentlich, schreibt der Workflow nur Summen
  ohne Link-Bezug (K12).
- **Öffnen:** nativ im externen Browser (`Linking.openURL`), im Web `target="_blank" rel="noopener noreferrer sponsored"`.
  Keine eingebettete Web-Ansicht.
- Missbrauch (künstliche Klicks) verfälscht nur die eigene Statistik. Abrechnung macht das Partnernetzwerk.

### 9.5 Kennzeichnung „Anzeige“

- Jeder Shop-Link trägt sichtbar das Wort **„Anzeige“** direkt am Link (nicht nur in einer Fußnote); Rechtsgrundlagen
  siehe 3.8 (K4).
- Über den Links ein fester Satz: „Wenn du über diese Links kaufst, erhalten wir eine Provision. Das ändert nicht,
  was wir dir empfehlen.“
- Die Komponente `AffiliateLink` hat `label` nicht als Option, sondern fest eingebaut. Test: jede gerenderte
  Shop-URL hat „Anzeige“ im selben Element (Unit-Test und Playwright).
- Der Link sieht anders aus als App-Knöpfe (Symbol „externer Link“).

### 9.6 Feature-Flag

`affiliate_enabled` in `private.feature_flags` (Name bewusst anders als die Tabelle, S2), **aus** bis zur
Rechtsprüfung und zu den Partnerverträgen. Geprüft in den SELECT-Policies und in `/go/<id>`. `constants.ts` enthält
nur den Testmodus-Standard. Im Testmodus Beispiel-Links zu `example.org` mit „Anzeige“. Der Workflow `beta-grant`
bekommt die Auswahl `affiliate_enabled`.

_DoD:_ Strukturtests grün (inkl. Negativ-Fixture), Route mit Tests (aktiv/inaktiv/unbekannt/Flag aus → 404, keine
Logs, keine Kopfzeilen mit Nutzerbezug), pgTAP für Zähler und Flag-Policy, Test „Links ungefiltert laden“, Option in
`beta-grant.yml`, Workflow `affiliate-report`, Playwright „Anzeige an jedem Link“.

---

## 10. Etappe SU6 – Zeitplan an geplanten Einheiten (gratis, nach SU4)

- `supplementSchedule()` zeigt für gewählte Supplements („Nehme ich“) eine kleine Zeile an der Trainingskarte auf
  „Heute“ bzw. im Kalender (z. B. „Nach dem Training: Proteinshake“, „Täglich: Kreatin“). **Kein Koffein** (B2.3).
- **Gratis** (B3, SU-G7): rechnet auf dem Gerät, keine KI, keine Kosten. Alternative „Premium“ nur mit Server-Weg:
  Zeitplan-Zeilen kommen über eine RPC mit `has_entitlement_for`, Restrisiko „wer den Core kennt, kann es lokal
  nachrechnen“ – nicht empfohlen.
- **Renntag:** keine Änderung an W1 (SU-G5b). Die drei Code-Stellen aus 2.2 und PLAN-PHASE-10 W1 bleiben unverändert.
  Falls die Gründer später „ja“ sagen: eigener Nachtrag mit Änderung aller drei Stellen, Tests (Renntag mit und ohne
  Flag, unter 18, Abendstart) und Nachtrag in PLAN-PHASE-10 – erst nach Rechtsfreigabe zu Koffein.

_DoD:_ Tests (Ruhetag, 1 vs. 7 Tage, nichts gewählt, Flag kommt hinzu → Zeile verschwindet), keine Änderung an W1
(Regressionstest der W1-Ausgabe).

---

## 11. Datenschutz (DSGVO)

### 11.1 Einwilligung `health_data` v2 (B1)

- **Neue Fassung ist Pflicht** (Art. 9 Abs. 2 lit. a i. V. m. Art. 4 Nr. 11 DSGVO: bestimmt und informiert). v2
  ergänzt gegenüber v1:
  - Datenarten: **Supplement-Check** (Nieren, Stillzeit, Herzrhythmus, Koffein-Empfindlichkeit, optional
    Eiweiß-Selbsteinschätzung) und **„Meine Supplements“**.
  - Zweck: „Supplement-Hinweise und das Ausblenden von Shop-Links, wenn eine Ergänzung bei deinen Angaben nicht
    passt.“ Ausdrücklich: „Shops und Partnernetzwerke erhalten keine dieser Angaben.“
  - Widerruf: „… löscht auch Supplement-Check und Meine Supplements.“
- **Ablauf:** Seed v2 in SU3, Re-Consent-Karte in SU4 (8.1), kein Datenverlust, Info-Modus bis zur Zustimmung.
- **Tests:** pgTAP „Schreiben mit v1 scheitert, mit v2 klappt“; Playwright Re-Consent; Abgleich Text in App und Seed
  (`db-sync.test.ts`).
- **Juristische Prüfung** des v2-Texts vor dem Seed in Produktion (Abschnitt 18).

### 11.2 Weitere Regeln

- **Gesundheitsdaten:** Supplement-Check und „Meine Supplements“ sind Gesundheitsdaten (Art. 9). Nur mit
  Einwilligung v2, RLS, Löschung beim Widerruf, Export.
- **Nie** im Partner-Modus, nie im Trainings- oder Ernährungs-PDF, nie in Crash-Reports, Logs oder Analytics (S12,
  wie `weight_goals`).
- **Nie an Shops, Partnernetzwerke oder Analytics:** kein Profil, keine Flags, keine Ziele, keine Nutzer-ID in
  Links. Test, der die Shop-URLs und die Weiterleitung auf Nutzerbezug prüft. Links ungefiltert laden (9.4).
- **Empfehlung läuft auf dem Gerät** (Core in der App, wie die Ernährungs-Engine). Der Server sieht nur, was ohnehin
  gespeichert wird.
- **Vercel-Request-Logs** (IP, Pfad, kurze Speicherdauer) in DSFA und Datenschutzerklärung nennen.
- **Partnernetzwerke** setzen beim Shop eigene Cookies. Das passiert auf deren Seite, nicht in der App. Die
  Datenschutzerklärung erklärt Weiterleitung und Zähler.
- **DSFA-Ergänzung:** Supplement-Check (neue Fragen), „Meine Supplements“, Ausblenden von Werbelinks anhand von
  Gesundheitsdaten (nur Unterdrückung, kein Targeting).

---

## 12. Gratis / Premium und Kosten

- Alles gratis (2b.3, SU-G7). Kein Premium-Teil in Phase 6, daher keine Server-Prüfung nötig.
- **Laufende Kosten:** keine KI-Kosten. Die Weiterleitung kostet bei Vercel praktisch nichts.
- **Einnahmen:** Affiliate-Provisionen erst nach Partnerverträgen. Erwartung bewusst niedrig ansetzen; die
  Empfehlungsliste ist kurz, Koffein und Vitamin D ohne Links.

---

## 13. Definition of Done (je Etappe, CLAUDE.md)

1. Typen + Zod-Schemas (Supplement-Check, Inhalte, Shops, Links).
2. Migration nur additiv, mit RLS und pgTAP; Enums gleich in `enums.ts`.
3. Core-Logik in `packages/core` mit Tests inkl. Grenzfällen (sehr leicht/schwer, sehr jung/alt, 1 vs. 7 Tage,
   jede Flag-Kombination); neue Werte mit Quelle bzw. „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“.
4. UI mobil + Web-Export, Playwright im Testmodus.
5. Lade-, Leer-, Fehler-, Offline- und Einwilligungs-Zustände (inkl. Re-Consent v1 → v2).
6. Texte auf Deutsch, Textregeln-Test grün, keine Health Claims außer `APPROVED_CLAIMS` mit Pflichthinweis.
7. **Einwilligungstext `health_data` v2 und DSFA-Ergänzung** (B1).
8. Doku: dieser Plan (Umsetzungsstand), KONZEPT 7/12/13/14, HANDY-ANLEITUNG („Supplemente testen“), SETUP
   (Partnernetzwerk, Flag), `.env.example`.
9. Pull Request mit deutscher Zusammenfassung und „So testest du es am Handy“; Wächter-Prüfung.

---

## 14. So testet ihr es am Handy

Getestet mit **Chrome am iPhone** (Vorschau-Link aus dem Pull Request), am besten im **Inkognito-Tab**: Chrome →
unten rechts **⋯** → **Neuer Inkognito-Tab**. Für jeden Durchgang einen neuen Inkognito-Tab öffnen.

**SU4 (Testmodus):**

1. Link öffnen → „Ohne Konto testen“ → Geschlecht **weiblich**, Geburtsdatum 30 Jahre, Einwilligung
   Gesundheitsdaten zustimmen, Gesundheits-Check alles „nein“, Ziel Muskelaufbau, Training morgens.
2. Ernährung → **Supplemente** → „Check machen“ → alle Fragen „nein“ → Kreatin steht unter „Passt zu dir“ mit Dosis;
   Koffein steht unter „Was du wissen solltest“, **ohne** „passt“; Vitamin D unter „Zur Info“.
3. Kreatin antippen → Angabe mit Pflichthinweis „… täglichen Aufnahme von 3 g …“, Hinweis zu 1–2 kg Wasser,
   Pflichtsätze, Quellen.
4. Einstellungen → Gesundheits-Check → Schwangerschaft „ja“ → zurück zu Supplemente → alles unter „Nicht für dich“,
   **keine** Shop-Links.
5. Neuer Inkognito-Tab → Geburtsdatum 17 Jahre → Supplemente zeigt „Ab 18 Jahren“, keine Dosis, keine Links.
6. Neuer Tab → Trainingszeit „abends“ → Koffein „vorher nicht“; „nachmittags“ → Satz „nur vor 16 Uhr“.
7. Neuer Tab → Ernährung vegan → Omega-3 erscheint; Proteinpulver erst nach „Schaffst du dein Eiweißziel …?“ =
   „eher nicht“.
8. Testmodus-Schalter „Einwilligung nur v1“ → Karte „Einwilligung ergänzt“ erscheint → „Zustimmen“ → Check bleibt
   erhalten.

**SU5 (Testmodus, Beispiel-Links):**

1. Wie oben bis Kreatin-Detail → unten „Wo kaufen“ → jeder Link trägt **„Anzeige“**, darüber der Provisions-Satz.
2. Link antippen → neuer Tab mit `example.org`.
3. Leistungssport wählen → Doping-Hinweis erscheint.
4. GitHub-App → **Actions → affiliate-report → Run workflow** → Ausgabe zeigt Klicks je Link, ohne Namen.

---

## 15. Risiken

1. **Abmahnung wegen Health Claims.** _Gegenmittel:_ nur wörtlich zugelassene Angaben mit Pflichthinweis, Koffein ohne
   Wirkaussage, Wortlisten-Test, Rechtsprüfung vor dem Livegang.
2. **Abmahnung wegen fehlender Werbe-Kennzeichnung** (UWG, DDG, MStV; AT MedienG § 26; CH UWG). _Gegenmittel:_
   „Anzeige“ fest in der Komponente, Test, Provisions-Satz.
3. **Nebenwirkung trotz Regeln** (z. B. unbekannte Nierenerkrankung). _Gegenmittel:_ Zusatzfragen, strenge Sperren,
   Pflichtsätze, keine Ladephase, Fachprüfung.
4. **Verunreinigte Produkte / Doping.** _Gegenmittel:_ nur geprüfte Produkte verlinken, Prüfdatum ≤ 12 Monate,
   Hinweis „chargenbezogen, Restrisiko“.
5. **Interessenkonflikt** (Vertrauen der Nutzer). _Gegenmittel:_ transitiver Strukturtest, kein Provisionsfeld,
   alphabetische Reihenfolge, keine Links bei Info/ab 18/aus, Koffein und Vitamin D ohne Links.
6. **Abgrenzung Medizinprodukt (MDR) / Therapieaussage.** _Gegenmittel:_ keine Diagnose, keine Therapie, kein
   „Mangel“; Omega-3 ohne Herz-Angabe bei Herz-Flags; allgemeine Fitness-Information mit Arzt-Hinweis.
7. **Kreatin-Wasser verwirrt Abnehm-Ziel und Live-Anpassung** (+1–2 kg). _Gegenmittel:_ fester Hinweis; später
   prüfen, ob „Nehme Kreatin seit …“ die Gewichts-Auswertung beeinflussen soll (eigener Nachtrag).
8. **Koffein-Überdosis zusammen mit Kaffee.** _Gegenmittel:_ Grenzen 3 mg/kg und 200 mg, Tagesgrenze-Satz, keine
   Links, kein Koffein-Produkt bei anderen Links (AF5).
9. **Tote oder veränderte Links.** _Gegenmittel:_ `valid_until`, AF-Prüfregeln, monatlicher Check nur auf
   `target_url` im Workflow `affiliate-report`.
10. **Werbung an Minderjährige.** _Gegenmittel:_ unter 18 keine Links.
11. **Zu viel Text, keiner liest die Hinweise.** _Gegenmittel:_ kurze Sätze, Pflichtsätze oben, Quellen eingeklappt.
12. **App-Store-Regeln.** Physische Waren dürfen über externe Links verkauft werden (kein In-App-Kauf nötig).
    **Apple 5.1.3 und Google-Play-Health-Richtlinien** verbieten, Gesundheitsdaten für Werbung oder Marketing zu
    nutzen; wir nutzen sie nur, um Links **auszublenden** (Schutz, kein Targeting, kein Datenabfluss). _Gegenmittel:_
    Begründung dokumentieren, Store-Texte, Privacy-Labels und Play-Datensicherheit prüfen (S11, Abschnitt 18).
13. **Re-Consent v2 nervt oder wird übersehen.** _Gegenmittel:_ eine Karte, kein Datenverlust, Info-Modus bleibt
    nutzbar; Gesundheitsdaten-Schreiben bleibt bis zur Zustimmung gesperrt (wie bei jeder neuen Fassung).

---

## 16. Zeitplan

Laufend: Phase 4b (nächste Etappe E), danach Phase 7.

**Empfohlene Reihenfolge (je Schritt ein Pull Request):**

1. **SU0** freigeben. **Parallel ihr:** Fachprüfung und Rechtsprüfung anfragen (inkl. v2-Text und Koffein),
   Partnerprogramme prüfen.
2. **SU1** (Core) und **SU2** (Inhalte) – sofort möglich, keine Konflikte mit 4b.
3. **SU3** (Datenbank, inkl. Seed v2) – nach 4b B ohne Konflikt; v2 in Produktion erst nach juristischer Prüfung
   des Texts.
4. **SU4** (App) – Testmodus zuerst.
5. **SU5** (Affiliate) – Code fertig, Flag **aus**. Einschalten erst nach Rechtsprüfung und Verträgen.
6. **SU6** (Zeitplan, gratis) – nach SU4.

Grobe Größe: SU0 + 6 Etappen ≈ 6–7 Pull Requests.

---

## 17. Was wir von euch brauchen (Gründer-Entscheidungen)

**Entschieden 19.10.2026: SU-G1 bis SU-G19 alle „Ja, wie empfohlen“.** Die Empfehlungen unten gelten damit verbindlich.

Format: _Worum es geht – Warum wir fragen – Empfehlung._

- **SU-G1 Startliste.** Welche Supplements die App kennt. – Jede Aufnahme braucht Quellen, Regeln, Fachprüfung und
  Rechtsprüfung. – **Empfehlung:** Kreatin-Monohydrat, Proteinpulver, Omega-3 als mögliche Empfehlung; Vitamin D
  und Koffein nur als Info; Gels/Elektrolyte nur als Verweis auf W1. Nitrat als zweite Welle, Beta-Alanin vorerst
  nicht.
- **SU-G2 Supplement-Check.** 4 Zusatzfragen (Niere, Stillzeit, Herzrhythmus, Koffein-Empfindlichkeit), gespeichert
  in einer eigenen Tabelle. – Ohne sie können wir Kreatin nicht verantwortbar empfehlen; mit ihnen speichern wir
  mehr Gesundheitsdaten. – **Empfehlung:** ja, beim ersten Öffnen des Moduls (nicht im Onboarding), eigene Tabelle,
  Löschung beim Widerruf.
- **SU-G3 Unter 18.** – Junge Menschen sollen sich laut IOC aufs Essen konzentrieren; Werbung an Minderjährige ist
  heikel. – **Empfehlung:** keine Sport-Supplemente („ab 18 Jahren“), nur allgemeine Infos, keine Shop-Links.
- **SU-G4 Medikamente.** Der Check kennt nur „ja/nein“, und die Frage umfasst auch die Pille. – Wechselwirkungen
  sind nicht prüfbar, aber viele Frauen wären bis auf Proteinpulver ausgeschlossen. – **Empfehlung:** zum Start
  streng („Nicht für dich – ärztlich abklären“ außer Proteinpulver); die Fachprüfung bewertet, ob eine genauere
  Frage (z. B. „nur hormonelle Verhütung“) später lockern darf.
- **SU-G5a Koffein-Grundregeln.** Sport-Supplement mit „passt zu dir“ oder nur Sicherheits-Info? – Koffein hat keine
  zugelassene Angabe; eine Empfehlung „vor dem Training“ deutet eine Leistungswirkung an (VO 1924/2006). –
  **Empfehlung:** nur neutrale Sicherheits-Info (Grenzen 3 mg/kg und 200 mg je Einnahme, nicht abends/16 Uhr,
  400 mg am Tag), keine Stufe, keine Zeile auf „Heute“, **keine Shop-Links**. Eine Empfehlung nur nach
  ausdrücklicher Rechtsfreigabe vor SU4.
- **SU-G5b Koffein am Renntag.** Soll W1 („kein Koffein im Plan“) geändert werden? – Gleiche Rechtsfrage wie SU-G5a,
  dazu drei Code-Stellen und PLAN-PHASE-10. – **Empfehlung:** **nein**, W1 bleibt unverändert; neu prüfen erst nach
  Rechtsfreigabe zu SU-G5a.
- **SU-G6 Proteinpulver im Ernährungsplan.** – Ein Shake hat Kalorien; automatisch einplanen ändert die
  Ernährungs-Engine. – **Empfehlung:** in Phase 6 nur Hinweis + Eintragen im Tagebuch (Barcode/Katalog); Eiweiß-Lücke
  aus Tagebuch-Schnitt oder Selbsteinschätzung; automatisches Einplanen später als eigener Nachtrag.
- **SU-G7 Gratis oder Premium.** Auch die Kopplung an geplante Einheiten (SU6)? – Alles rechnet auf dem Gerät; eine
  Premium-Sperre wäre dort nicht serverseitig durchsetzbar (CLAUDE.md, PLAN-PHASE-4B Abschnitt 3). –
  **Empfehlung:** **alles gratis**, auch SU6. Alternative Premium nur mit Server-Weg (RPC mit `has_entitlement_for`),
  mehr Aufwand, Restrisiko lokaler Nachrechnung.
- **SU-G8 „Meine Supplements“ und Erinnerungen.** – Praktisch für Nutzer, aber mehr Gesundheitsdaten. –
  **Empfehlung:** „Nehme ich / Nicht für mich“ speichern (Sync über Geräte), **kein** tägliches Abhaken und **keine**
  Erinnerungen in Phase 6.
- **SU-G9 Shop-Auswahl und Reihenfolge.** – Herstellerneutralität muss nachvollziehbar sein. – **Empfehlung:**
  höchstens 3 Shops je Supplement, alphabetisch, kein Provisionsfeld im Datenmodell, nur Produkte, die zur Dosis
  passen (AF5), Pflege im Repository per Pull Request.
- **SU-G10 Klick-Zählung.** – Ohne Zählung wisst ihr nicht, was genutzt wird; mit Zählung entsteht ein
  Datenfluss. – **Empfehlung:** eigene Weiterleitung mit anonymen Tageszählern (Link, Tag, Plattform), ohne
  Nutzer-ID, IP und Cookies in unserer Datenbank; Vercel-Logs in der Datenschutzerklärung; Bericht per Workflow.
- **SU-G11 Geprüfte Produkte (Kölner Liste o. gleichwertig).** – Verunreinigte Produkte sind ein echtes Risiko, auch
  für Freizeitsportler. – **Empfehlung:** Pflicht für **alle** verlinkten Produkte (Kölner Liste oder gleichwertige
  Liste wie Informed Sport), Prüfdatum höchstens 12 Monate alt, Hinweis „chargenbezogen“; Doping-Hinweis für
  Leistungssport und bei eingetragenem Wettkampf.
- **SU-G12 Einwilligung.** – Der v1-Text nennt die neuen Datenarten und den Zweck „Shop-Links ausblenden“ nicht;
  Art. 9 verlangt eine bestimmte, informierte Einwilligung. – **Empfehlung:** **neue Fassung `health_data` v2 ist
  Pflicht** (Text 11.1), Re-Consent-Karte ohne Datenverlust, DSFA-Ergänzung, juristische Prüfung des Texts vor dem
  Seed in Produktion.
- **SU-G13 Texte erzeugen.** Claude-Sitzung oder Gemini-Batch? – Es sind nur etwa 17 Einträge; Batch lohnt sich
  erst bei vielen. – **Empfehlung:** Startbestand als Entwurf aus einer Claude-Sitzung, Pipeline-Art trotzdem
  bauen (für spätere Ergänzungen).
- **SU-G14 Platz in der App.** – Supplements gehören zur Ernährung, sollen aber nicht wie Werbung wirken. –
  **Empfehlung:** Abschnitt „Supplemente“ im Tab Ernährung, keine eigene Kachel auf „Heute“; dort nur die kleine
  Zeile an der Trainingskarte für gewählte Supplements (SU6).
- **SU-G15 Vitamin D.** Empfehlung mit Links oder nur Info? – DGE/BfR empfehlen ein Präparat nur, wenn Sonne und
  Ernährung nicht reichen; KONZEPT 7 sieht nur „Spiegel prüfen lassen“ vor. – **Empfehlung:** nur Info mit dem
  allgemeinen Richtwert 20 µg (DGE-Schätzwert), immer mit „Lass deine Blutwerte ärztlich prüfen.“, kein „Passt zu
  dir“, keine Links. Alternative: Links erst nach Fachprüfung.
- **SU-G16 Affiliate einschalten.** Wann? – Ohne Rechtsprüfung drohen Abmahnungen. – **Empfehlung:** Code mit SU5
  fertig, Flag aus; einschalten erst nach Rechtsprüfung (Health Claims, Kennzeichnung DE/AT/CH), Partnerverträgen,
  Fachprüfung und Store-Prüfung – spätestens mit Phase 12.
- **SU-G17 Omega-3 bei Herz-Flags.** – Die Herz-Angabe liest sich bei Herzkranken wie eine Therapieaussage; die EMA
  sieht ein Vorhofflimmern-Risiko. – **Empfehlung:** bei `medical_clearance_recommended`/`heart_rhythm` nur Info ohne
  Herz-Angabe und ohne Links.
- **SU-G18 Kreatin ab 55.** Zusätzliche Angabe aus VO (EU) 2017/672 nutzen? – Passt zu älteren Nutzern, Wortlaut muss
  geprüft werden. – **Empfehlung:** ja, aber erst nach Prüfung des Wortlauts im EU-Register.
- **SU-G19 Sichtbarkeit von `affiliate-report`.** – In einem öffentlichen Repository wären die Klickzahlen öffentlich
  (kein Personenbezug, aber geschäftlich sensibel). – **Empfehlung:** Repository privat halten; sonst nur Summen ohne
  Link-Bezug.

**Offen (neu aus SU2, noch nicht entschieden):**

- **SU-G20 Natriumbicarbonat.** Gehört es in die Liste „Nicht empfohlen“? – Die Studienlage für kurze, sehr
  intensive Belastungen ist gut (Maughan 2018); die Liste meint bisher Stufe C („keine ausreichende Studienlage“).
  Mit Stufe C wäre Natron falsch beschriftet, ohne Eintrag fehlt der Hinweis auf Magen-Darm-Beschwerden. Im
  SU2-Startbestand fehlt es deshalb vorerst. – **Empfehlung:** einen eigenen Grund „nicht empfohlen wegen Risiko oder
  Nebenwirkungen“ einführen (getrennt von Stufe C) und Natriumbicarbonat damit aufnehmen; Text und Einordnung in der
  Fachprüfung. Gleiches Muster später ggf. für Pre-Workout-Mischungen und Abnehm-Kapseln.

---

## 18. Was ihr selbst tun müsst

1. **Fachprüfung:** Ernährungsfachkraft, Sportmedizinerin oder Apotheker prüft Tabellen 3.2, 3.3, 3.5, die
   Zusatzfragen 3.4, Omega-3 bei Herz-Flags (EMA/PRAC 2023), die Medikamenten-Frage (Pille), die gewichtsabhängige
   Koffein-Tagesgrenze (5,7 mg je kg, höchstens 400 mg; aus EFSA 2015 400 mg bei 70 kg abgeleitet, SU1) und die Texte
   (vor dem Livegang).
2. **Rechtsprüfung:** Health Claims (Wortlaute und Pflichthinweise aus VO 432/2012 und 2017/672, konsolidierte
   Fassung), Koffein-Texte (SU-G5a), Werbe-Kennzeichnung in DE, AT und CH, **Einwilligungstext `health_data` v2**,
   Datenschutzerklärung (Weiterleitung, Zähler, Vercel-Logs), DSFA-Ergänzung.
3. **Store-Prüfung:** App-Store-Privacy-Labels, Play-Datensicherheit und Store-Texte zum Ausblenden von Links anhand
   von Gesundheitsdaten (Apple 5.1.3, Google-Play-Health-Richtlinien).
4. **Partnerprogramme:** Shops bzw. Partnernetzwerke auswählen und Konto anlegen. Die Partner-Kennung steht später
   in `content/affiliate/links.json` (sie ist nicht geheim). Zugangsdaten zum Netzwerk nie im Chat schicken.
5. **Geprüfte Produkte:** Für jedes Produkt prüfen, ob es in der Kölner Liste (koelnerliste.com) oder einer
   gleichwertigen Liste steht, und Datum sowie Dosis je Tagesportion im Pull Request vermerken.
6. **Sichtbarkeit des Repositorys** prüfen (SU-G19): GitHub-App → Repository → **Settings** → **General** → ganz
   unten „Danger Zone“ → „Change visibility“.
7. **Flag einschalten** (nach 1–5): GitHub-App → **Actions → beta-grant → Run workflow** → Aktion `flag_an`,
   Funktion `affiliate_enabled` (die Auswahl ergänzt SU5) → **Run workflow**.
