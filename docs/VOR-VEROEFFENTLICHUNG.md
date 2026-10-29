# Vor einer öffentlichen oder kommerziellen Veröffentlichung

**Stand:** 27.10.2026 · **Anlass:** Gründer-Entscheidung 27.10.2026 – die App wird nur von höchstens fünf Personen
aus dem engen Umfeld (Freunde, Familie) genutzt. Die sichtbaren Hinweise „noch nicht fachlich geprüft“, „Testphase“,
„Testinhalt“, „Entwurf – vor Livegang prüfen“ sind deshalb aus App und Website entfernt, und alle Trainings-Inhalte
sind für diesen privaten Kreis freigegeben (`reviewed_by` = „Karsten (Auftrag an Claude)“, `expert_reviewed` bleibt
`false`).

Diese Liste sammelt, was **vor** einer Öffnung für weitere Personen, vor einem Store-Eintrag oder vor Einnahmen (Abo,
Affiliate, Werbung) fachlich bzw. rechtlich zu prüfen wäre. Die Einzelstellen stehen weiter als Kommentar
„VOR LIVEGANG FACHLICH PRÜFEN“ bzw. „PRODUKTENTSCHEIDUNG“ im Code (vor allem `packages/core/src/constants.ts`) –
Suche nach diesen Wörtern findet sie.

## 1. Rechtliches

1. **Impressum, Datenschutzerklärung, AGB** (Website `apps/web/src/app/(seite)/…`): gelbe Lücken `[PLATZHALTER: …]`
   ausfüllen (Name, Anschrift, Kontakt, Verantwortliche Stelle) und von Anwalt/Datenschutzberatung prüfen lassen
   (DE, AT, CH). Der Hinweis-Kasten „PLATZHALTER – vor Livegang ausfüllen“ ist entfernt; bei Bedarf in
   `_components/Recht.tsx` wieder einbauen.
2. **Einwilligungstexte** (`consent_documents`, Kopie in `apps/mobile/src/data/consent-texts.ts`): Die Fassungen
   tragen in der Datenbank weiter die erste Zeile „ENTWURF – juristisch prüfen“ (bewusst unverändert – eine
   Textänderung braucht eine neue Fassung mit neuer Zustimmung aller Nutzer). Die App blendet diese Zeile seit
   29.10.2026 nur in der Anzeige aus (`consentBodyForDisplay` in `packages/core/src/consent.ts`). Juristisch prüfen,
   dann als neue Fassungen ohne die Zeile per Migration einspielen (`health_data` Fassung 2 ist in der Datenbank noch
   unveröffentlicht).
3. **Allergen-Angaben bei nicht freigegebenen Rezepten** (nur Testmodus ohne Supabase): statt „Entwurf … noch nicht
   freigegeben“ steht seit 29.10.2026 die neutrale Zeile „Allergen-Angaben ohne Gewähr – bitte Zutatenliste prüfen.“;
   Packungsgrößen und Ratgeber tragen kein Entwurfs-Kennzeichen mehr.
4. **Health-Claims** (Supplemente, Ratgeber, Rezepte): Wortlaute und Pflichthinweise gegen das EU-Register prüfen
   (Health-Claims-Verordnung, docs/PLAN-PHASE-6.md 18).
5. **Auftragsverarbeitung**: AVV mit Google (Gemini), Supabase, Vercel, Expo; Wearable-Anbieter (Strava, Garmin)
   prüfen.
6. **Live-Begleitung / Notfallkontakt** (docs/PLAN-PHASE-10.md 21): Rechts- und Haftungsprüfung, bevor mehr als der
   private Kreis sie nutzt; Notrufnummern (DE/AT 112, CH 144/112) gegen offizielle Angaben prüfen.
7. **Lizenzen und Quellen** (App „Lizenzen“, Website `/lizenzen`): Wortlaut juristisch prüfen (Open Food Facts,
   BLS 4.0, Schriften, Strichcode-Leser).
8. **Affiliate/Werbung, Abos (RevenueCat/Stripe)**: Kennzeichnung „Anzeige“, Widerrufsbelehrung, Preisangaben.

## 2. Fachliche Prüfung der Inhalte

Freigegeben sind alle Inhalte, aber keiner davon ist fachlich geprüft (`meta.expert_reviewed = false`). Nach einer
Prüfung `expert_reviewed` per Pull Request auf `true` setzen.

| Bereich                                                                                                     | Prüfen durch                                      |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 239 Übungen (inkl. Calisthenics, Schlingentrainer, Lauf-ABC/Lauf-Kraft, Yoga-/Pilates-Posen), Bilder        | Physiotherapie, Trainer:in                        |
| 49 Plan-Vorlagen (u. a. Calisthenics), Volumen-Hinweise V11 aus `content:validate`                          | Trainer:in, Sportwissenschaft                     |
| 56 Workouts (u. a. Rudern, Yoga, Pilates, Mobility, Erholungstage, Lauf-Kraft)                              | Trainer:in, zertifizierte Yoga-/Pilates-Lehrkraft |
| Ratgeber „Höhe und Höhenkrankheit“, „Sicher Bergwandern“ (inkl. Notrufnummern)                              | Bergführer:in, Sportmedizin                       |
| Hyrox-, Lauf-, Rad-, Triathlon-Regeln und Textbausteine (Wochenumfang, Tempo, Intervalle, Wettkampfplanung) | Lauf-/Hyrox-/Triathlon-Trainer:in                 |
| Supplemente (18): Dosierungen, Warnhinweise, Evidenzstufen                                                  | Ernährungsfachkraft, Sportmedizin                 |
| Rezepte (110, inkl. 6 Snacks rund ums Training), Allergene, Salz-Hinweise R11, Meal-Prep-Haltbarkeit        | Ernährungsfachkraft                               |
| Ratgeber „Unterwegs essen“, „Essen rund ums Training“; Nährstoff-Timing-Regeln (`NUTRIENT_TIMING`)          | Ernährungsfachkraft                               |
| „Auswärts essen“ (`content/food-mapping/auswaerts-zuordnung.json`, Status „entwurf“), Packungsgrößen        | Ernährungsfachkraft                               |
| Zyklus-Modul, Schon-Modus (Schmerz/Verletzung), Fit im Alter, Erholung/HRV, Herzfrequenz-Zonen              | Sportmedizin, Gynäkologie, Physiotherapie         |

## 3. Technische Schalter vor dem Start

1. `content/einspiel-regeln.json` auf `"nur_fachlich_geprueft": true` stellen (Livegang-Regel: nur fachlich geprüfte
   Ernährungs-Inhalte und Workouts in die Datenbank). Vorher alles aus Abschnitt 2 prüfen, sonst fehlen Inhalte.
2. Wieder sichtbare Kennzeichnung für nicht geprüfte Inhalte erwägen: Die Daten tragen das Merkmal weiter
   (`isPublishedWithoutExpertReview`, `contentReviewMark` in `packages/core`, Redaktionsbereich `/admin` zeigt es).
3. Testphase-Schalter „alles offen“ (Premium-Funktionen kostenlos) beenden, Monatslimits der KI-Funktionen prüfen.
4. Grenzwerte in `packages/core/src/constants.ts` (Kalorien, Ausdauer-Steigerung, Deload, Supplement-Regeln,
   Herzfrequenz, Bergwandern, Rudern, Hyrox) fachlich bestätigen – die Schutzgrenzen selbst bleiben unverändert aktiv.
