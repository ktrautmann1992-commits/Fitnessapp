/**
 * Texte der Ernährung (docs/PLAN-PHASE-5.md 4.9, 6, 7.4, 8, 10; Etappe N4) – feste Bausteine, keine Diagnosen, keine
 * wertenden Wörter über Essen, keine Heil- oder Nährwertversprechen (Health-Claims-Verordnung), keine Gewichts-
 * Prognosen. Wird in `de.ts` unter `nutrition` eingebunden (gleicher Typ `Strings`).
 * Die Engine liefert nur Codes (packages/core/src/nutrition/notices.ts); hier stehen die Texte dazu.
 */
export const deNutrition = {
  title: 'Ernährung',
  disclaimer: 'Alpha5 ersetzt keine ärztliche oder ernährungsfachliche Beratung.',
  estimate: 'Schätzung – ±10 % sind normal.',
  hfiCoeliac:
    'Bei hereditärer Fruktoseintoleranz oder Zöliakie können wir keine Garantie geben – prüfe immer die Zutatenliste der gekauften Produkte.',
  back: 'Zurück',
  toToday: 'Zu heute',
  loading: 'Ernährung wird geladen …',
  loadFailed: 'Die Ernährung konnte nicht geladen werden.',
  computeFailed:
    'Deine Ernährung lässt sich gerade nicht berechnen. Bitte prüfe deine Angaben in den Einstellungen.',
  incomplete:
    'Bitte vervollständige zuerst deine Angaben (Ziel, Trainingserfahrung und Ernährung) in den Einstellungen.',
  unsupported:
    'Die Ernährung kommt bald auch für Konten. Bis dahin kannst du sie im Testmodus ausprobieren.',
  consentBlocked: {
    consent_outdated:
      'Bitte bestätige die neue Fassung der Einwilligung Gesundheitsdaten oder lösche die gespeicherten Unverträglichkeiten – sonst können wir sie nicht berücksichtigen. Bis dahin zeigen wir keinen Essensplan und keine Rezepte.',
    consent_missing:
      'Es sind noch Unverträglichkeiten gespeichert, aber deine Einwilligung Gesundheitsdaten fehlt. Erteile die Einwilligung oder lösche die gespeicherten Unverträglichkeiten. Bis dahin zeigen wir keinen Essensplan und keine Rezepte.',
  },
  consentBlockedButton: {
    consent_outdated: 'Neue Fassung bestätigen',
    consent_missing: 'Einwilligung erteilen',
  },
  deleteIntolerances: 'Gespeicherte Unverträglichkeiten löschen',
  deleteIntolerancesTitle: 'Unverträglichkeiten löschen?',
  deleteIntolerancesText:
    'Deine gespeicherten Unverträglichkeiten werden endgültig gelöscht und beim Essensplan nicht mehr berücksichtigt. Alle Essenspläne und Einkaufslisten mit Gesundheitsbezug werden mit gelöscht (auch eigene Einträge) und neu erstellt – auch die, die nur wegen deiner Körperdaten oder deines Gesundheits-Checks als Gesundheitsdaten gelten. Du kannst Lebensmittel stattdessen unter „mag ich nicht“ ausschließen (Einstellungen → Ernährung ändern).',
  deleteIntolerancesConfirm: 'Löschen',
  deleteIntolerancesDone: 'Gespeicherte Unverträglichkeiten gelöscht.',
  setupNeeded:
    'Richte deine Ernährung kurz ein: Wie aktiv ist dein Alltag und wann trainierst du meistens?',
  setupButton: 'Ernährung einrichten',
  noRecipes: 'Für deine Angaben gibt es noch keine Rezepte.',
  /** Supabase-Modus (N7 Teil 2, G-N7-3): noch keine freigegebenen Rezepte – klarer Leer-Zustand. */
  noRecipesReview:
    'Noch keine Rezepte: Unsere Rezepte werden gerade fachlich geprüft und erscheinen hier, sobald sie freigegeben sind. Dein Tagesziel siehst du schon.',
  noRecipesTestMode:
    'Noch keine Rezepte: Der Lebensmittel-Katalog wird gerade importiert. Zum Ausprobieren kannst du Beispiel-Rezepte mit Testwerten verwenden.',
  demoUse: 'Beispiel-Rezepte mit Testwerten verwenden',
  demoBanner:
    'Beispiel-Rezepte mit TESTWERTEN – keine echten Nährwerte, keine geprüften Allergene. Nur zum Ausprobieren.',
  demoOff: 'Beispiel-Rezepte ausblenden',
  demoSource: 'Nährwerte: Testwerte (keine Quelldaten).',
  /**
   * Namensnennung nach CC BY 4.0 (PLAN-PHASE-5.md 5.1.1 S13, Wächter N6 S2/K3): Quelle mit Version und Herausgeber,
   * Lizenz mit Verweis auf den Lizenztext, Kennzeichnung der Änderungen („umgerechnet und gerundet“).
   */
  source: (attribution: string) => `Nährwerte: ${attribution}; umgerechnet und gerundet.`,
  sourceAttribution: (name: string, version: string, publisher: string, license: string) =>
    `${name} ${version}${publisher ? `, ${publisher}` : ''} (${license})`,
  sourceNames: {
    bls: { name: 'Bundeslebensmittelschlüssel (BLS)', publisher: 'Max Rubner-Institut' },
    ch_naehrwertdatenbank: { name: 'Schweizer Nährwertdatenbank', publisher: 'BLV' },
    usda_fdc: { name: 'USDA FoodData Central', publisher: '' },
  },
  /** Verweis auf den Lizenztext (ohne „https://“ – reiner Text im PDF, kein Link). */
  licenseTexts: { 'CC BY 4.0': 'CC BY 4.0, creativecommons.org/licenses/by/4.0' } as Readonly<
    Record<string, string>
  >,

  // --- Tag ----------------------------------------------------------------------------------------------------
  dayStatus: {
    complete: 'Dein Plan',
    below_floor: 'Unvollständiger Vorschlag',
    no_targets: 'Vorschlag ohne Zahlen',
  },
  previousDay: 'Vorheriger Tag',
  nextDay: 'Nächster Tag',
  today: 'Heute',
  target: (kcal: string) => `Tagesziel: ${kcal} kcal`,
  dayTotal: (kcal: string) => `Geplant: ${kcal} kcal`,
  macros: 'Makros',
  macroLine: (label: string, planned: string, target: string) =>
    `${label}: ${planned} g von ${target} g`,
  macroA11y: (label: string, planned: string, target: string) =>
    `${label}: ${planned} Gramm geplant, Ziel ${target} Gramm`,
  macroNames: { protein: 'Eiweiß', carbs: 'Kohlenhydrate', fat: 'Fett' },
  numbersHidden: 'Kalorienzahlen sind ausgeblendet (Einstellungen).',
  mealsTitle: 'Mahlzeiten',
  noMeals: 'Für diesen Tag gibt es noch keine Mahlzeiten.',
  portion: (factor: string) => `${factor} × Portion`,
  portionKcal: (factor: string, kcal: string) => `${factor} × Portion · ${kcal} kcal`,
  fill: 'Ergänzung, damit du deinen Bedarf erreichst',
  openRecipe: (title: string) => `Rezept öffnen: ${title}`,
  emptySlot: (slot: string, reasons: string) => `${slot}: Gerade passt kein Rezept (${reasons}).`,
  emptySlotNoReason: (slot: string) => `${slot}: Gerade passt kein Rezept.`,
  capsTitle: 'So schützen wir dich',
  notesTitle: 'Hinweise',
  changeSettings: 'Ernährung ändern',
  slots: {
    main: 'Hauptmahlzeit',
    breakfast: 'Frühstück',
    snack_morning: 'Snack vormittags',
    lunch: 'Mittagessen',
    snack_afternoon: 'Snack nachmittags',
    snack_pre_dinner: 'Snack vor dem Abendessen',
    dinner: 'Abendessen',
    snack_late: 'Spät-Snack',
    snack_night: 'Snack am späten Abend',
    extra_1: 'Ergänzung',
    extra_2: 'Ergänzung',
  },
  roles: {
    pre: 'vor dem Training',
    post: 'nach dem Training',
    pre_snack: 'kleiner Snack vor dem Training',
  },
  prep: {
    cook: 'Kochtag: für mehrere Tage vorkochen',
    leftover: 'vorgekocht',
  },
  storage: {
    fridge: 'aus dem Kühlschrank',
    freeze: 'eingefroren – am Vortag im Kühlschrank auftauen',
  },
  substitution: (food: string) => `mit ${food}`,
  omitted: (food: string) => `ohne ${food}`,
  emptyReasons: {
    status: 'nicht freigegeben',
    red_issue: 'Prüfung offen',
    food_unavailable: 'Zutaten fehlen im Katalog',
    nutrients_incomplete: 'Nährwerte unvollständig',
    alcohol: 'Alkohol',
    diet: 'Ernährungsform',
    pork: 'ohne Schwein',
    intolerance: 'Unverträglichkeiten',
    dislike: '„Mag ich nicht“',
    pregnancy_caution: 'Schwangerschaft',
    meal_type: 'keine passende Mahlzeit',
    meal_prep_unsuitable: 'nicht für Meal-Prep geeignet',
    prep_time: 'Zubereitungszeit',
    competition: 'Wettkampf-Rezept',
    not_no_cook: 'nur ohne Kochen',
    above_ceiling: 'Tag sonst über deinem Bedarf',
    rated_down: 'passende Rezepte hast du abgelehnt (Daumen runter)',
  },

  // --- Hinweis-Codes der Engine (4.4–4.9) ----------------------------------------------------------------------
  notices: {
    no_health_data_consent: 'Mit Größe und Gewicht passen wir die Portionen an dich an.',
    body_data_missing: 'Mit Größe und Gewicht passen wir die Portionen an dich an.',
    health_check_missing:
      'Mach bitte den kurzen Gesundheits-Check – dann können wir deinen Plan genauer an dich anpassen.',
    weight_outdated: 'Dein Gewicht ist älter als 3 Monate – kurz aktualisieren?',
    pregnancy_no_targets:
      'In Schwangerschaft und Stillzeit ändert sich dein Bedarf laufend. Wir zeigen dir deshalb keine Kalorienzahl. Bitte stimme deine Ernährung mit deiner Ärztin, deinem Arzt oder deiner Hebamme ab.',
    pregnancy_check_update:
      'Hat sich etwas geändert (z. B. Schwangerschaft, Stillzeit vorbei)? Gesundheits-Check aktualisieren.',
    pregnancy_caffeine:
      'In Schwangerschaft und Stillzeit empfiehlt das BfR höchstens 200 mg Koffein am Tag (etwa 2 Tassen Kaffee). Auch Matcha, Mate, Cola und Energydrinks enthalten Koffein.',
    minor_no_deficit:
      'Im Wachstum ist eine Diät nicht sinnvoll. Wir planen ausgewogen ohne Kaloriendefizit.',
    underweight:
      'Dein BMI liegt unter 18,5. Wir planen ohne Defizit. Lass das bitte ärztlich abklären.',
    severe_underweight:
      'Dein BMI liegt deutlich unter 18,5. Wir planen ohne Defizit. Bitte lass das bald ärztlich abklären – unten findest du Stellen, die dich unterstützen.',
    medical_consult:
      'Nimmst du Medikamente (z. B. bei Diabetes), sprich Änderungen deiner Ernährung bitte vorher ärztlich ab.',
    bmr_estimate_age: 'Für dein Alter ist die Formel eine grobe Schätzung.',
    activity_level_default:
      'Ohne Angabe schätzen wir deinen Alltag als überwiegend sitzend. Bei aktivem Alltag liegt dein Bedarf höher.',
    training_energy_capped: 'An Tagen mit sehr viel Training planen wir ohne Defizit.',
    energy_availability_cap:
      'An Tagen mit viel Training planen wir ein kleineres Defizit, damit dein Körper genug Energie hat.',
    protein_kidney_notice: 'Bei einer Nierenerkrankung stimme die Eiweißmenge bitte ärztlich ab.',
    carbs_below_reference: 'Die Kohlenhydrate liegen an diesem Tag unter dem Richtwert von 130 g.',
    endurance_carbs_below_target:
      'Für deine Trainingsmenge wären mehr Kohlenhydrate sinnvoll – mehr passt an diesem Tag nicht in dein Tagesziel.',
    long_session_fueling:
      'Bei langen Einheiten etwa 30–60 g Kohlenhydrate pro Stunde, z. B. Banane, und regelmäßig trinken.',
    early_training:
      'Kleiner, leicht verdaulicher Snack oder locker ohne Frühstück – das Frühstück danach ist deine Mahlzeit nach dem Training.',
  },
  /**
   * Fassungen ohne Zahlen bei „Kalorienzahlen anzeigen“ = aus (Wächter N4 S3/K9): keine kcal, keine Gramm, kein BMI-Wert.
   * Die Sicherheitsaussage bleibt.
   */
  noticesWithoutNumbers: {
    long_session_fueling:
      'Bei langen Einheiten unterwegs etwas Kohlenhydrate essen, z. B. eine Banane, und regelmäßig trinken.',
    underweight:
      'Wir planen ohne Defizit, weil dein Gewicht niedrig ist. Lass das bitte ärztlich abklären.',
    severe_underweight:
      'Wir planen ohne Defizit, weil dein Gewicht sehr niedrig ist. Bitte lass das bald ärztlich abklären – unten findest du Stellen, die dich unterstützen.',
  },
  /** Greifende Grenzen in einfachen Worten (4.6, „Reihenfolge“). */
  caps: {
    bmr_floor: 'Wir planen nicht unter deinem Grundumsatz.',
    deficit_cap: 'Wir planen höchstens 25 % unter deinem Bedarf.',
    weekly_loss_cap:
      'Wir planen nur ein langsames Abnehmen (höchstens etwa 1 % Körpergewicht pro Woche).',
    energy_availability_cap:
      'An Tagen mit viel Training planen wir ein kleineres Defizit, damit dein Körper genug Energie hat.',
    gain_cap: 'Wir planen nur einen kleinen Überschuss.',
    special_case_cap: 'Wegen deiner Angaben planen wir vorsichtig.',
    training_energy_capped: 'An Tagen mit sehr viel Training planen wir ohne Defizit.',
  },
  /** Hinweis-Codes des Essensplans (6.2–6.4). */
  planNotices: {
    day_below_floor:
      'Dieser Tag erreicht deinen Mindestbedarf nicht – ergänze z. B. eine Portion Obst, Nüsse oder Joghurt.',
    no_targets_portions:
      'Die Portionen sind nicht an deinen Bedarf angepasst – iss dich satt und ergänze bei Hunger.',
    no_candidates_for_slot: 'Für eine Mahlzeit gibt es gerade kein passendes Rezept.',
    meal_removed_ceiling:
      'Eine Mahlzeit ist weggefallen, damit der Tag nicht über deinem Bedarf liegt.',
    optional_omitted_ceiling: 'Optionale Zutaten lassen wir an diesem Tag weg.',
    protein_below_target: 'Eiweiß liegt an diesem Tag etwas unter deinem Ziel.',
    fill_snacks_added: 'Wir haben Ergänzungen eingeplant, damit du deinen Bedarf erreichst.',
    recipe_repeated: 'Ein Rezept kommt öfter vor, weil gerade wenige Rezepte passen.',
    meal_prep_freeze:
      'Einige vorgekochte Portionen bitte einfrieren und am Vortag im Kühlschrank auftauen.',
    meal_prep_fresh_days: 'An einigen Tagen kochst du frisch.',
    drafts_used: 'Die Rezepte sind Entwürfe und noch nicht fachlich geprüft.',
    drafts_allergens_unreviewed:
      'Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden.',
  },
  // --- Gespeicherter Plan, Woche, Tauschen (6.3 Nr. 7, 6.6, 8.2 Nr. 2–3, Etappe N5) ---------------------------
  plan: {
    autoAdjusted: 'Dein Plan wurde an deine neuen Angaben angepasst.',
    autoAdjustedPast: 'Vergangene Tage bleiben unverändert.',
    autoAdjustedOk: 'Verstanden',
    updateSuggested:
      'Dein Bedarf hat sich geändert. Mit „Plan aktualisieren“ passen wir die Portionen und Rezepte ab heute an.',
    ratedDownSuggested:
      'In diesem Plan steht ein Rezept, das du mit Daumen runter bewertet hast. Mit „Plan aktualisieren“ planen wir die Woche ohne dieses Rezept neu.',
    update: 'Plan aktualisieren',
    updated: 'Dein Plan ist ab heute aktualisiert.',
    other: 'Andere Vorschläge',
    otherTitle: 'Andere Vorschläge?',
    otherText:
      'Wir schlagen dir ab heute andere Rezepte vor. Getauschte Rezepte ab heute werden dabei ersetzt; vergangene Tage bleiben unverändert.',
    otherConfirm: 'Andere Vorschläge',
    otherDone: 'Hier sind andere Vorschläge ab heute.',
    swap: 'Rezept tauschen',
    swapA11y: (slot: string, title: string) => `Rezept tauschen: ${slot}, ${title}`,
    swapped: (title: string) => `Getauscht – neu: ${title}.`,
    swapFailed: {
      no_alternative:
        'Für diese Mahlzeit gibt es gerade kein anderes passendes Rezept, das in deinen Tag passt.',
      past_day: 'Vergangene Tage bleiben unverändert.',
      not_found: 'Diese Mahlzeit gibt es nicht mehr. Bitte lade die Ansicht neu.',
      replan_needed:
        'Dein Plan muss zuerst an deine Angaben angepasst werden. Bitte öffne die Ernährung erneut.',
    },
    saveFailed:
      'Dein Essensplan konnte gerade nicht gespeichert werden. Angezeigt wird trotzdem der Plan nach deinen aktuellen Angaben.',
    /** Wächter N7 H3: Speichern scheitert an der Einwilligung (neue Fassung bzw. fehlt) – klarer Weg statt Wiederholen. */
    saveConsentMissing:
      'Dein Essensplan kann gerade nicht gespeichert werden: Er beruht auf Gesundheitsdaten (z. B. Unverträglichkeiten), und deine Einwilligung Gesundheitsdaten fehlt oder hat eine neue Fassung. Bestätige die Einwilligung oder lösche die gespeicherten Unverträglichkeiten.',
    saveConsentButton: 'Einwilligung prüfen',
    /** Wächter N7 H9: Rezept eines vergangenen Tages ist zurückgezogen (archiviert) und nicht mehr lesbar. */
    unavailable: (title: string) => `${title} – Rezept nicht mehr verfügbar`,
    unavailableHint:
      'Dieses Rezept wurde überarbeitet oder zurückgezogen. Vergangene Tage bleiben, wie sie waren.',
    actionFailed: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
    readOnlyWeek: 'Diese Woche liegt zurück und lässt sich nicht mehr ändern.',
    weekView: 'Wochenansicht',
  },
  week: {
    title: 'Essensplan der Woche',
    range: (from: string, to: string) => `${from} bis ${to}`,
    thisWeek: 'Diese Woche',
    nextWeek: 'Nächste Woche',
    dayTotal: (kcal: string) => `Tagessumme: ${kcal} kcal`,
    openDay: (day: string) => `${day} öffnen`,
    noMeals: 'Keine Mahlzeiten geplant.',
    past: 'vergangen',
  },
  actions: {
    grantConsent: 'Einwilligung erteilen',
    healthCheck: 'Gesundheits-Check machen',
    healthCheckUpdate: 'Gesundheits-Check aktualisieren',
    updateWeight: 'Gewicht aktualisieren',
  },

  // --- Hilfe bei Essstörungen (4.9, Gründer-Entscheidung 3) ------------------------------------------------------
  // VOR VERÖFFENTLICHUNG PRÜFEN: Namen und Erreichbarkeit der Stellen (bewusst ohne Telefonnummern, bis geprüft).
  help: {
    title: 'Wenn Essen oder Gewicht dich belasten',
    text: 'Wenn Essen oder Gewicht dich stark belasten, hol dir Unterstützung. Du kannst die Kalorienzahlen jederzeit ausblenden.',
    contacts: [
      'Deutschland: Beratung zu Essstörungen des Bundesinstituts für Öffentliche Gesundheit (BIÖG, früher BZgA)',
      'Österreich: Hotline für Essstörungen (Wiener Programm für Frauengesundheit)',
      'Schweiz: Arbeitsgemeinschaft Ess-Störungen (AES)',
      'Im Notfall: 112',
    ],
  },

  // --- Onboarding-Schritt nutrition_setup (8.1) -----------------------------------------------------------------
  setup: {
    title: 'Alltag und Training',
    intro:
      'Damit wir deinen Bedarf gut schätzen und die Mahlzeiten passend zum Training legen können.',
    activity: 'Wie aktiv ist dein Alltag – ohne Sport?',
    activityRequired: 'Bitte wähle, wie aktiv dein Alltag ist – davon hängt dein Bedarf ab.',
    activities: {
      sedentary: {
        label: 'Überwiegend sitzend',
        text: 'z. B. Büro oder Studium, wenig Wege',
      },
      light: {
        label: 'Sitzend mit Bewegung',
        text: 'z. B. Büro mit regelmäßigem Gehen oder Stehen',
      },
      active: {
        label: 'Überwiegend stehend oder gehend',
        text: 'z. B. Verkauf, Pflege, Handwerk',
      },
      very_active: {
        label: 'Körperlich schwere Arbeit',
        text: 'z. B. Bau, Landwirtschaft, Lager',
      },
    },
    trainingTime: 'Wann trainierst du meistens?',
    trainingTimeRequired: 'Bitte wähle, wann du meistens trainierst – „unterschiedlich“ geht auch.',
    trainingTimes: {
      early: 'Früh (vor 8 Uhr)',
      morning: 'Vormittags',
      midday: 'Mittags',
      afternoon: 'Nachmittags',
      evening: 'Abends',
      varies: 'Unterschiedlich',
    },
    mealprepSlots: 'Was kochst du vor?',
    mealprepOptions: { lunch: 'Mittagessen', lunch_dinner: 'Mittag- und Abendessen' },
    showNumbers: 'Kalorienzahlen anzeigen',
    showNumbersHint:
      'Ist das aus, siehst du nur die Mahlzeiten – ohne kcal und Makros. Du kannst das jederzeit in den Einstellungen ändern.',
  },

  // --- „Heute“ (8.2 Nr. 1) ---------------------------------------------------------------------------------------
  todayCard: {
    title: 'Essen heute',
    next: (slot: string, title: string) => `Als Nächstes: ${slot} – ${title}`,
    allDone: 'Alle Mahlzeiten für heute liegen hinter dir.',
    cookDay: (titles: string) => `Heute ist Kochtag: ${titles}`,
    belowFloor:
      'Heute ist ein unvollständiger Vorschlag – ergänze z. B. eine Portion Obst, Nüsse oder Joghurt.',
    open: 'Ernährung',
    openA11y: 'Ernährung öffnen',
    demo: 'Beispiel-Rezepte mit Testwerten – keine echten Nährwerte.',
  },

  // --- „Fertig“ (8.1) ------------------------------------------------------------------------------------------
  done: {
    title: 'Ernährung',
    trainingDay: (kcal: string) => `Trainingstag ca. ${kcal} kcal`,
    restDay: (kcal: string) => `Ruhetag ca. ${kcal} kcal`,
    withoutNumbers: 'Dein Essensplan zeigt die Mahlzeiten ohne Kalorienzahlen.',
    noTargets: 'Ohne Zahlen: Wir planen Standardportionen.',
  },

  // --- Rezept (8.2 Nr. 4) ----------------------------------------------------------------------------------------
  recipe: {
    title: 'Rezept',
    notFound: 'Dieses Rezept gibt es nicht (mehr).',
    notForYou: 'Dieses Rezept passt nicht zu deinen Angaben.',
    aiDraft: 'KI-Entwurf – fachlich prüfen',
    draft: 'Entwurf – fachlich noch nicht geprüft',
    /** Freigegeben, aber (noch) ohne Fachprüfung – nur in der Testphase (Gründer-Entscheidung 19.10.2026). */
    testphase: 'Testphase – noch nicht fachlich geprüft',
    allergenWarning: 'Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden.',
    times: (prep: number, cook: number) =>
      cook > 0
        ? `Vorbereitung ${prep} Min. · Kochen ${cook} Min.`
        : `Zubereitung ${prep} Min. · ohne Kochen`,
    yourPortion: (factor: string) => `Deine Portion: ${factor} × Grundrezept`,
    servings: 'Portionen',
    servingsValue: (n: number) => (n === 1 ? '1 Portion' : `${n} Portionen`),
    fewer: 'Eine Portion weniger',
    more: 'Eine Portion mehr',
    ingredients: 'Zutaten',
    optional: '(optional)',
    instead: (original: string, substitute: string) => `${substitute} statt ${original}`,
    swappedInstead: (original: string, substitute: string) =>
      `${substitute} statt ${original} (ausgetauscht)`,
    swapButton: 'Austauschen',
    swapA11y: (food: string) => `${food} austauschen`,
    omittedLine: (food: string) => `ohne ${food}`,
    toTaste: 'nach Geschmack',
    steps: 'Zubereitung',
    nutrients: 'Nährwerte je Portion',
    nutrientLine: (kcal: string, protein: string, carbs: string, fat: string) =>
      `${kcal} kcal · Eiweiß ${protein} g · Kohlenhydrate ${carbs} g · Fett ${fat} g`,
    contains: (list: string) => `Enthält: ${list}`,
    containsNothing: 'Enthält keine der erfassten Allergen-Gruppen.',
    coconut: 'Kokos',
    traces: 'Prüfe die Zutatenliste der gekauften Produkte (Spuren).',
    mealPrepFridge: (days: number) =>
      days === 1
        ? 'Hält gekocht 1 Tag im Kühlschrank.'
        : `Hält gekocht ${days} Tage im Kühlschrank.`,
    mealPrepFreezable: 'Lässt sich einfrieren.',
    equipment: (list: string) => `Du brauchst: ${list}`,
    /** Kopf-Chips (Design-Feinschliff 21.10.2026). */
    kcalChip: (kcal: string) => `${kcal} kcal je Portion`,
    kcalUnit: 'kcal',
    gramsValue: (grams: string) => `${grams} g`,
    macroA11y: (label: string, grams: string) => `${label}: ${grams} Gramm je Portion`,
    kcalA11y: (kcal: string) => `${kcal} Kilokalorien je Portion`,
    notes: 'Hinweise',
  },

  // --- Zutaten-Austausch (KONZEPT 6.9, Etappe N9) ------------------------------------------------------------------
  ingredientSwap: {
    title: 'Zutat austauschen',
    intro:
      'Du siehst nur Alternativen, die zu deinen Angaben und zu deinem Tag passen. Mengen, Nährwerte und Einkaufsliste passen wir automatisch an.',
    current: (amount: string, food: string) => `In deinem Rezept: ${amount} ${food}`,
    role: (label: string) => `Rolle im Rezept: ${label}`,
    amount: (amount: string) => `Menge in deiner Portion: ${amount}`,
    mealKcal: (kcal: string) => `Mahlzeit danach: ${kcal} kcal`,
    note: (text: string) => `Hinweis: ${text}`,
    original: 'Original aus dem Rezept',
    choose: 'Nehmen',
    chooseA11y: (food: string) => `${food} nehmen`,
    belowFloor: (days: string) =>
      `Danach erreichen diese Tage dein Ziel nicht ganz: ${days}. Das steht dann auch im Plan.`,
    batch: (days: string) =>
      `Nur vor dem Kochen tauschen: Gilt für alle Portionen dieses Kochtags (${days}). Was danach nicht mehr so lange hält, wird eingefroren oder frisch gekocht.`,
    empty:
      'Für diese Zutat gibt es gerade keine Alternative, die zu deinen Angaben und zu deinem Tag passt.',
    saveFailed:
      'Der Austausch konnte gerade nicht gespeichert werden. Bitte versuche es noch einmal.',
    done: 'Ausgetauscht. Mengen, Nährwerte und Einkaufsliste sind angepasst.',
    failed: {
      past_day: 'Vergangene Tage bleiben unverändert.',
      not_found: 'Diese Zutat gibt es in deinem Plan nicht (mehr). Bitte lade die Ansicht neu.',
      already_cooked:
        'Dieses Gericht ist schon vorgekocht oder der Kochtag läuft – für diese Portionen gibt es keinen Austausch.',
      no_role: 'Für diese Zutat gibt es keinen Austausch.',
      not_offered: 'Diese Alternative gibt es nicht (mehr). Bitte lade die Ansicht neu.',
      excluded: 'Diese Alternative passt nicht zu deinen Angaben.',
      amounts: 'Mit dieser Alternative passen die Mengen im Rezept nicht mehr.',
      above_ceiling: 'Mit dieser Alternative würde dein Tag zu viel Energie enthalten.',
      prep_time:
        'Mit dieser Alternative müsste an einem Werktag frisch gekocht werden – länger, als du werktags Zeit hast.',
      consent_required:
        'Zum Austauschen brauchst du die Einwilligung zu Gesundheitsangaben: Ein Plan mit getauschten Zutaten kann auf Unverträglichkeiten oder Abneigungen schließen lassen.',
      replan_needed:
        'Dein Plan muss zuerst an deine Angaben angepasst werden. Bitte öffne die Ernährung erneut.',
      not_editable: 'Diese Woche liegt zurück und lässt sich nicht mehr ändern.',
    },
  },

  // --- Bewertung nach dem Essen (KONZEPT 6.10, Etappe N10) ------------------------------------------------------------
  rating: {
    heading: 'Wie war’s?',
    intro: 'Deine Bewertung bleibt privat und ändert nur, welche Rezepte wir dir vorschlagen.',
    up: 'Daumen hoch',
    down: 'Daumen runter',
    upA11y: (title: string) => `${title}: Daumen hoch`,
    downA11y: (title: string) => `${title}: Daumen runter`,
    current: {
      up: 'Deine Bewertung: Daumen hoch – wir schlagen dir das Rezept etwas häufiger vor.',
      down: (until: string) =>
        `Deine Bewertung: Daumen runter – bei neuen Planungen schlagen wir dir das Rezept bis einschließlich ${until} nicht vor.`,
    },
    undo: 'Bewertung zurücknehmen',
    undone: 'Bewertung zurückgenommen.',
    savedUp: 'Danke! Wir schlagen dir das Rezept etwas häufiger vor.',
    saveFailed:
      'Die Bewertung konnte gerade nicht gespeichert werden. Bitte versuche es noch einmal.',
    limit:
      'Du hast schon sehr viele Rezepte bewertet. Lösche zuerst Bewertungen unter Einstellungen → Ernährung → „Abgelehnte Lebensmittel und Bewertungen“.',
    notYet: 'Bewerten kannst du eine Mahlzeit, sobald ihr Tag da ist.',
    title: 'Daumen runter',
    reasonHeading: 'Warum? (freiwillig)',
    reasons: {
      taste: 'Schmeckt mir nicht',
      effort: 'Zu aufwendig',
      cost: 'Zu teuer',
      satiety: 'Macht nicht satt',
      intolerant: 'Unverträglich',
    },
    reasonEffects: {
      taste: 'Wir schlagen dir das Rezept 8 Wochen lang nicht mehr vor.',
      effort: 'Außerdem schlagen wir dir öfter Rezepte vor, die in 15 Minuten fertig sind.',
      cost: 'Außerdem kommen günstigere Rezepte weiter nach vorn (nur mit geprüfter Kostenschätzung).',
      satiety: 'Außerdem kommen Rezepte mit mehr Ballaststoffen und Volumen weiter nach vorn.',
      intolerant:
        'Dieser Grund wird nicht gespeichert. Gleich kannst du einzelne Zutaten als „mag ich nicht“ ausschließen.',
    },
    noReason: 'Kein Grund',
    effect: (until: string) =>
      `Bei neuen Planungen schlagen wir dir das Rezept bis einschließlich ${until} nicht mehr vor. An Energie, Portionen und Grenzen ändert eine Bewertung nichts.`,
    planStays:
      'Schon gespeicherte Pläne bleiben so: In der laufenden Woche planst du die Tage ab heute mit „Andere Vorschläge“ neu; steht das Rezept in einem Plan für eine kommende Woche, bieten wir dort „Plan aktualisieren“ an.',
    save: 'Speichern',
    saved: 'Gespeichert. Danke für deine Bewertung.',
    back: 'Zurück',
    toPlan: 'Zum Essensplan',
    dislikes: {
      title: 'Zutaten als „mag ich nicht“ übernehmen?',
      intro:
        'Wähle die Zutaten aus, die du nicht mehr in Rezepten haben möchtest. Nichts ist vorausgewählt – Rezepte mit diesen Zutaten schlagen wir dir dann nicht mehr vor.',
      healthHint:
        '„Mag ich nicht“ schließt nur genau diese Lebensmittel aus – keine verwandten Produkte (z. B. Joghurt oder Käse bei Milch) und keine Spuren. Bei einer Allergie oder Unverträglichkeit trage sie bitte im Profil unter „Ernährung ändern“ ein (mit Einwilligung zu Gesundheitsangaben) – dann schließen wir die ganze Gruppe aus.',
      profileButton: 'Allergien und Unverträglichkeiten im Profil eintragen',
      apply: 'Übernehmen',
      skip: 'Nichts übernehmen',
      none: 'Alle Zutaten dieses Rezepts stehen schon unter „mag ich nicht“.',
      applied: (n: number) =>
        n === 1
          ? '1 Zutat steht jetzt unter „mag ich nicht“.'
          : `${n} Zutaten stehen jetzt unter „mag ich nicht“.`,
      skipped: 'Es wurde nichts übernommen.',
      failed: 'Die Auswahl konnte gerade nicht gespeichert werden. Bitte versuche es noch einmal.',
      limit:
        'Du hast schon sehr viele Lebensmittel ausgeschlossen. Entferne zuerst einige in den Einstellungen.',
    },
  },

  // --- „Mag ich nicht“ je Lebensmittel (Etappe N10) -------------------------------------------------------------------
  foodDislikes: {
    title: 'Lebensmittel, die du nicht magst',
    intro:
      'Rezepte mit diesen Lebensmitteln schlagen wir dir nicht vor. Diese Angaben sind privat und kein Gesundheitsdatum.',
    open: 'Abgelehnte Lebensmittel und Bewertungen',
    settingsText:
      'Lebensmittel, die du nach einer Bewertung ausgeschlossen hast, und deine Bewertungen.',
    empty: 'Du hast noch keine einzelnen Lebensmittel ausgeschlossen.',
    allow: 'Wieder zulassen',
    allowA11y: (food: string) => `${food} wieder zulassen`,
    allowed: (food: string) => `${food} ist wieder erlaubt.`,
    unknownFood: 'Lebensmittel nicht mehr im Katalog',
    loadingName: '…',
    ratingsHeading: 'Deine Bewertungen',
    ratingsText:
      'Bewertungen sind privat und werden nur für deine Vorschläge verwendet. Du kannst sie hier alle löschen.',
    ratingsNone: 'Du hast noch keine Rezepte bewertet.',
    deleteRatings: 'Alle Bewertungen löschen',
    deleteRatingsConfirm:
      'Alle Bewertungen löschen? Abgelehnte Rezepte können danach wieder vorgeschlagen werden. Deine ausgeschlossenen Lebensmittel bleiben.',
    ratingsDeleted: 'Alle Bewertungen sind gelöscht.',
    failed: 'Das hat gerade nicht geklappt. Bitte versuche es noch einmal.',
    back: 'Zurück',
  },

  // --- Einstellungen (8.2 Nr. 7) ---------------------------------------------------------------------------------
  settings: {
    title: 'Ernährung',
    text: 'Ernährungsform, Vorlieben, Unverträglichkeiten, Mahlzeiten und Kochmodus.',
    edit: 'Ernährung ändern',
    setup: 'Alltag und Trainingszeit',
    showNumbers: 'Kalorienzahlen anzeigen',
    showNumbersSaved: 'Gespeichert.',
    open: 'Zur Ernährung',
    demoTitle: 'Beispiel-Rezepte (Testmodus)',
    demoText:
      'Solange der Lebensmittel-Katalog fehlt, kannst du Beispiel-Rezepte mit Testwerten verwenden. Sie sind keine echten Nährwerte.',
  },

  // --- Widerruf (7.4) -----------------------------------------------------------------------------------------
  revoke: {
    intolerances:
      'Deine Unverträglichkeiten werden gelöscht und beim Essensplan nicht mehr berücksichtigt. Essenspläne und Einkaufslisten mit Gesundheitsbezug werden gelöscht – auch deine eigenen Einträge darin. Eigene Einträge in Einkaufslisten ohne Gesundheitsbezug bleiben erhalten; lösche sie dort selbst, wenn sie etwas über deine Gesundheit verraten.',
    convert: 'Diese Lebensmittel stattdessen unter „mag ich nicht“ ausschließen?',
    convertHint: '„Mag ich nicht“ wirkt im Essensplan genauso – es ist kein Gesundheitsdatum.',
    converted: 'Deine bisherigen Unverträglichkeiten stehen jetzt unter „mag ich nicht“.',
  },
  shopping: {
    title: 'Einkaufsliste',
    open: 'Einkaufsliste',
    range: (from: string, to: string) => `Einkauf für ${from} bis ${to}`,
    rangeTitle: 'Zeitraum',
    rangeFrom: 'Von',
    rangeTo: 'Bis',
    rangeApply: 'Zeitraum übernehmen',
    rangeInvalid: 'Der Zeitraum endet vor seinem Beginn.',
    rangeHint: 'Meal-Prep wird zum Kochtag gekauft; der Sonntag vor der Woche zählt zum Montag.',
    hideChecked: 'Erledigte ausblenden',
    /** Zeitraum-Wahl (docs/PLAN-EINKAUFEN-AUSDAUER.md 3, Gründer-Entscheidung 23.10.2026). */
    rangeModeLabel: 'Einkaufen für',
    rangeDays: '3 Tage',
    rangeWeek: 'Ganze Woche',
    rangeDaysA11y: '3 Tage: heute und die nächsten 2 Tage',
    rangeWeekA11y: 'Ganze Woche: ab heute bis Sonntag',
    rangeCustom: 'Eigener Zeitraum',
    rangeCustomActive: 'Eigener Zeitraum (gewählt)',
    departmentOpen: (count: number) => `${count} offen`,
    departmentDone: '✓ erledigt',
    departmentA11y: (name: string, status: string) => `${name}, ${status}`,
    departmentA11yDone: 'alles erledigt',
    doneShow: (count: number) => `${count} erledigt – anzeigen`,
    doneHide: 'Erledigte ausblenden',
    pantry: 'Hast du wahrscheinlich da',
    pantryShow: (count: number) => `Vorrat anzeigen (${count})`,
    pantryHide: 'Vorrat einklappen',
    empty: 'Für diesen Zeitraum musst du nichts einkaufen.',
    allChecked: 'Alles erledigt.',
    toTaste: 'nach Geschmack',
    amountChanged: 'Menge geändert',
    notInPlan: 'nicht mehr im Plan',
    outsideDiet: 'passt nicht zu deiner Ernährungsform',
    manual: 'eigener Eintrag',
    checkA11y: (label: string) => `Abhaken: ${label}`,
    /** Zweite Zeile eines Eintrags: wofür gebraucht (höchstens 2 Rezepte, Rest als „+n“, 24.10.2026). */
    forRecipes: (titles: readonly string[], more: number) =>
      `für ${titles.join(', ')}${more > 0 ? ` +${more}` : ''}`,
    removeManual: (label: string) => `Eintrag löschen: ${label}`,
    addTitle: 'Eigener Eintrag',
    addLabel: 'Was brauchst du noch?',
    addHint: 'Höchstens 80 Zeichen, z. B. „Kaffee“ oder „Spülmittel“.',
    addCategory: 'Abteilung',
    add: 'Hinzufügen',
    addEmpty: 'Bitte einen Eintrag eingeben.',
    recipesTitle: 'Aus Rezepten hinzugefügt',
    recipeLine: (title: string, servings: number) =>
      `${title} – ${servings} ${servings === 1 ? 'Portion' : 'Portionen'}`,
    removeRecipe: (title: string) => `Entfernen: ${title}`,
    offline:
      'Abhaken geht auch ohne Netz – deine Häkchen bleiben gespeichert, auch nach dem Neuladen.',
    adjusted:
      'Deine Einkaufsliste wurde an deinen geänderten Plan angepasst. Häkchen und eigene Einträge bleiben; was nicht mehr gebraucht wird und schon abgehakt war, steht als „nicht mehr im Plan“ da.',
    noPlan: 'Für diese Woche gibt es noch keinen Essensplan – deshalb auch keine Einkaufsliste.',
    planless:
      'Für diese Woche gibt es keinen Essensplan. Du kannst trotzdem eigene Artikel eintragen, abhaken und im Laden scannen.',
    readOnly: 'Diese Woche lässt sich nicht mehr ändern.',
    saveFailed: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
    healthNote:
      'Ersatzprodukte stehen hier ohne Grund. Zutaten aus deinem Plan kommen immer aus dem aktuellen Plan.',
    failed: {
      not_found: 'Dieses Rezept gibt es nicht mehr.',
      not_for_you: 'Dieses Rezept passt nicht zu deinen Angaben.',
      too_many: 'Es stehen schon 20 Rezepte auf der Liste. Entferne zuerst eines.',
      save_failed: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
    },
    /** Reiter „Einkaufen“ (Gründer-Entscheidung 20.10.2026). */
    tabTitle: 'Einkaufen',
    quantityLabel: 'Menge (optional)',
    quantityHint: 'Zum Beispiel 500 g, 1 l oder 3 Stück.',
    quantityInvalid:
      'Diese Menge verstehen wir nicht. Schreib sie z. B. als 500 g, 1,5 kg, 1 l oder 3 Stück.',
    uncheckAll: 'Alle Haken zurücksetzen',
    uncheckAllTitle: 'Alle Haken zurücksetzen?',
    uncheckAllText:
      'Alle Einträge sind danach wieder offen. Was nur noch abgehakt da stand („nicht mehr im Plan“), fällt weg. Deine eigenen Einträge bleiben.',
    uncheckAllConfirm: 'Zurücksetzen',
    uncheckAllDone: 'Alle Haken sind zurückgesetzt.',
    scan: {
      title: 'Im Laden scannen',
      intro:
        'Scann den Strichcode eines Produkts: Steht es auf deiner Liste, haken wir es ab. Die Kamerabilder bleiben auf deinem Gerät.',
      camera: 'Strichcode scannen',
      typeCode: 'Nummer eintippen',
      codeLabel: 'Nummer unter dem Strichcode',
      codeHint: 'Die 8 oder 13 Ziffern unter dem Strichcode.',
      search: 'Abgleichen',
      cancel: 'Abbrechen',
      searching: 'Suche Produkt …',
      checked: (label: string) => `✓ ${label} abgehakt`,
      undo: 'Rückgängig',
      undoA11y: (label: string) => `Rückgängig: ${label} wieder offen`,
      undone: (label: string) => `${label} ist wieder offen.`,
      notRecognizedTitle: 'Produkt nicht erkannt',
      pickFromList: 'Tipp an, was du gekauft hast:',
      ownItem: 'Als eigenen Artikel hinzufügen',
      noOpenItems: 'Auf deiner Liste ist gerade nichts mehr offen.',
      addCategory: 'Abteilung',
      learnHint:
        'Beim nächsten Scan dieses Produkts erkennen wir den Eintrag (nur auf deinem Konto).',
      alreadyChecked: (label: string) => `${label} ist schon abgehakt.`,
      chooseTitle: 'Welcher Eintrag ist es?',
      chooseText: (name: string) => `„${name}“ passt zu mehreren Einträgen. Tipp den richtigen an.`,
      chooseNone: 'Keiner davon',
      chooseA11y: (label: string) => `Abhaken: ${label}`,
      notOnListTitle: 'Nicht auf deiner Liste',
      notOnListText: (name: string) =>
        `„${name}“ steht nicht auf deiner Liste – zusätzlich hinzufügen?`,
      notOnListYes: 'Ja, hinzufügen',
      notOnListNo: 'Nein',
      added: (label: string) => `✓ ${label} hinzugefügt und abgehakt`,
      nameLabel: 'Name auf deiner Liste',
      nameEmpty: 'Bitte einen Namen eingeben.',
      notFound: 'Dieses Produkt kennen wir noch nicht.',
      offline: 'Ohne Internet können wir das Produkt nicht nachsehen.',
      noConsent:
        'Die Produktabfrage gibt es nur mit deiner Einwilligung in Gesundheitsdaten (wie beim Eintragen).',
      unavailable: 'Die Produktabfrage klappt gerade nicht.',
      rateLimited:
        'Du hast gerade sehr viele Produkte abgefragt. Bitte versuch es später noch einmal.',
      invalidCode: 'Die Nummer stimmt nicht – bitte noch einmal scannen oder abtippen.',
      notFoodCode:
        'Dieser Code gilt nur im Laden (z. B. Frischetheke) oder ist kein Lebensmittel – hak den Eintrag direkt ab.',
      denied: 'Ohne Kamera-Erlaubnis kannst du die Nummer eintippen.',
      cameraProblem: 'Die Kamera ließ sich nicht nutzen – tipp die Nummer ein.',
      testCodes: 'Testmodus: Testnummern (statt einer echten Packung)',
      testCodeA11y: (label: string) => `Testnummer scannen: ${label}`,
      /** Nährwerte zum gescannten Produkt (Wunsch vom 22.10.2026) – nur Anzeige, nichts wird gespeichert. */
      nutritionTitle: (unit: 'g' | 'ml') => `Nährwerte je 100 ${unit}`,
      nutritionOwn: 'Deine Angaben – nur für dich sichtbar.',
      nutritionReview:
        'Bitte prüfen: Die Angaben wirken nicht ganz stimmig – vergleich sie mit der Packung.',
    },
    fromRecipe: {
      add: (servings: number) =>
        `Zur Einkaufsliste (${servings} ${servings === 1 ? 'Portion' : 'Portionen'})`,
      added: (servings: number) =>
        `Steht auf deiner Einkaufsliste (${servings} ${servings === 1 ? 'Portion' : 'Portionen'}).`,
      inPlan: 'Dieses Rezept steht über deinen Essensplan schon auf der Einkaufsliste.',
      open: 'Einkaufsliste öffnen',
      notEditable: 'Die Einkaufsliste gibt es für diese und nächste Woche.',
    },
  },
  /** Etappe N12 – Einkaufsliste weitergeben (KONZEPT 6.13, privat durch dich selbst, kein öffentliches Teilen). */
  share: {
    open: 'Weitergeben',
    openHint: 'Einkaufsliste als Text an WhatsApp, Notizen oder Erinnerungen schicken',
    title: 'Einkaufsliste weitergeben',
    intro:
      'Schick deine Einkaufsliste als Text an wen oder wohin du möchtest – z. B. per WhatsApp, in deine Notizen oder Erinnerungen. Alpha5 schickt nichts selbst und speichert nicht, wohin du sie gibst.',
    contentNote:
      'Im Text stehen nur Produkte und Mengen nach Abteilung – keine Kalorien, keine Gründe, kein Gewicht, keine Ziele. Eigene Einträge stehen so drin, wie du sie geschrieben hast.',
    optionsTitle: 'Was soll mit?',
    includeChecked: 'Erledigte Einträge mitnehmen (mit „erledigt“)',
    includePantry: 'Vorrat mitnehmen (hast du wahrscheinlich da)',
    includeManual: 'Eigene Einträge mitnehmen',
    previewTitle: 'So sieht der Text aus',
    previewA11y: 'Text der Einkaufsliste',
    shareButton: 'Weitergeben',
    shareHint: 'Öffnet den Teilen-Dialog deines Geräts',
    copyButton: 'Text kopieren',
    pdfButton: 'Stattdessen als PDF speichern',
    empty: 'Deine Einkaufsliste ist leer – es gibt nichts weiterzugeben.',
    nothingSelected:
      'Mit dieser Auswahl bleibt nichts übrig. Nimm z. B. die erledigten Einträge oder den Vorrat mit.',
    truncated: (count: number) =>
      `Die Liste ist sehr lang: ${count} ${count === 1 ? 'Eintrag passt' : 'Einträge passen'} nicht mehr in den Text. Am Ende steht ein Hinweis darauf – für die ganze Liste nutze das PDF.`,
    shared: 'Weitergegeben.',
    opened: 'Teilen-Dialog geöffnet.',
    invalid: 'Die Liste ließ sich nicht als Text aufbereiten. Bitte öffne die Einkaufsliste neu.',
    copied: 'Text kopiert – füge ihn z. B. in WhatsApp oder deine Notizen ein.',
    cancelled: 'Abgebrochen – es wurde nichts weitergegeben.',
    manual:
      'Teilen und Kopieren gehen in diesem Browser nicht. Markiere den Text oben und kopiere ihn selbst.',
    failed: 'Das hat leider nicht geklappt. Bitte versuche es noch einmal.',
    noticeTitle: 'Bevor du weitergibst',
    noticeHealth:
      'Diese Liste stammt aus einem Plan, der deine Gesundheitsangaben berücksichtigt. Gründe, Gewicht und Unverträglichkeiten stehen nicht im Text – Ersatzprodukte und fehlende Zutaten können aber darauf schließen lassen. Gib die Liste nur an Menschen oder Apps weiter, denen du das anvertrauen möchtest.',
    noticeSubstitutes:
      'Die Liste enthält Ersatzprodukte bzw. ausgetauschte Zutaten. Sie stehen ohne Grund im Text, können aber auf deine Angaben schließen lassen.',
    noticeItems: (labels: string) => `Betrifft: ${labels}.`,
    noticeConfirm: 'Weiter',
    retailButton: 'Bei einem Händler bestellen (Anzeige)',
  },
  mealPrep: {
    title: 'Meal-Prep-Wochenpläne',
    open: 'Meal-Prep-Pläne',
    intro:
      'Ein Kochtag, Montag bis Freitag vorgekocht: Frühstück, Mittag und Snack. Das Abendessen bleibt frei für ein frisches Rezept.',
    weekFor: (from: string, to: string) => `Für die Woche ${from} bis ${to}`,
    notOffered: 'Passt nicht zu deinen Angaben',
    chosen: 'Für diese Woche gewählt',
    none: 'Es gibt noch keine Meal-Prep-Wochenpläne.',
    noneFits: 'Für deine Angaben gibt es noch keinen passenden Wochenplan.',
    planA11y: (title: string) => `Plan ansehen: ${title}`,
    recipes: 'Rezepte',
    storageTitle: 'Aufbewahrung',
    cookDay: (day: string) => `Kochtag: ${day}`,
    fridgeDays: (days: string) => `Kühlschrank: ${days}`,
    freezeDays: (days: string) => `Einfrieren, am Vorabend auftauen: ${days}`,
    freshDays: (days: string) => `Frisch kochen: ${days}`,
    safetyNote:
      'Wir halten die Haltbarkeit je Lebensmittel ein (z. B. gekochter Reis, Fisch, Hackfleisch, Geflügel höchstens 1 Tag im Kühlschrank) – auch wenn ein Text etwas anderes sagt.',
    choose: 'Plan für diese Woche wählen',
    chooseTitle: 'Plan wählen?',
    chooseText:
      'Ab dem Kochtag belegen wir Frühstück, Mittag und Snack von Montag bis Freitag mit diesem Plan. Andere Mahlzeiten planen wir passend dazu. Vergangene Tage bleiben unverändert. „Andere Vorschläge“ ersetzt den Plan später ab heute wieder.',
    chooseConfirm: 'Plan wählen',
    chooseDone: 'Der Plan steht jetzt in deiner Woche.',
    chooseFailed: 'Der Plan passt gerade nicht zu deinen Angaben.',
    toShopping: 'Zur Einkaufsliste',
    startCookDay: 'Zum Kochtag',
    notFound: 'Diesen Plan gibt es nicht.',
    notEditable: 'Meal-Prep-Pläne lassen sich für diese und nächste Woche wählen.',
  },
  cookDay: {
    title: 'Kochtag',
    notChosen: 'Für diese Woche ist kein Meal-Prep-Plan gewählt.',
    choosePlan: 'Plan wählen',
    start: 'Kochtag starten',
    restart: 'Neu starten',
    stop: 'Kochtag beenden',
    running:
      'Der Kochtag läuft – die Zeit läuft weiter, auch wenn du die App schließt oder offline bist. Erinnerungen an die Schritte kommen nur, solange die App bzw. Seite geöffnet ist.',
    notStarted:
      'Starte den Kochtag, sobald du loslegst. Die Schritte kommen nach ihren Startminuten.',
    stepAt: (minute: number) => (minute === 0 ? 'Sofort' : `Nach ${minute} Min.`),
    current: 'Jetzt',
    done: 'erledigt',
    upcoming: 'kommt',
    next: (time: string) => `Nächster Schritt in ${time}`,
    allStarted: 'Alle Schritte haben begonnen. Fertig? Dann beende den Kochtag.',
    waitingFirst: (time: string) => `Erster Schritt in ${time}`,
    notifyTitle: 'Kochtag',
    notifyOn: 'Erinnerungen an die nächsten Schritte sind eingeschaltet.',
    notifyOff: 'Wir erinnern dich an die nächsten Schritte, solange die App geöffnet ist.',
    notifyWeb:
      'Im Browser erinnern wir dich mit einer Mitteilung, solange die Seite geöffnet ist. In der App vibriert sie bei jedem neuen Schritt, solange sie geöffnet ist.',
    freezeTitle: 'Einfrieren',
    freezeLine: (title: string, days: string) => `${title}: Portionen für ${days} einfrieren`,
    fridgeLine: (title: string, days: string) =>
      `${title}: Portionen für ${days} in den Kühlschrank`,
    freshLine: (title: string, days: string) => `${title}: am ${days} frisch kochen`,
    storageTitle: 'Nach dem Kochen',
    startFailed: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
  },
  thaw: {
    title: 'Heute Abend auftauen',
    line: (title: string, day: string) =>
      `${title} für ${day} aus dem Gefrierfach in den Kühlschrank legen.`,
  },
  // --- Resteplanung (19.7 N14): nur „Nutzt deinen Rest“, ohne Mengen und ohne Packungszahlen -------------------------
  leftovers: {
    /** z. B. „Nutzt deinen Rest: Champignons (seit Mo), Hähnchenbrust (seit Di)“ */
    line: (list: string) => `Nutzt deinen Rest: ${list}`,
    item: (food: string, weekday: string) => `${food} (seit ${weekday})`,
    weekShort: 'nutzt einen Rest',
    unreviewed: 'Packungsgröße noch nicht geprüft (Testwert)',
    shortLived:
      'Angebrochen nur kurz haltbar: Die App plant diesen Rest nur bis zum Folgetag ein. Gut gekühlt lagern und die Angaben auf der Packung beachten.',
    explain:
      'Die Hinweise gehen von üblichen Packungsgrößen aus und planen Reste nur kurz ein. Wie viele Packungen du kaufst, zeigt die Einkaufsliste noch nicht.',
  },
  rebuilt: {
    text: 'Einige Rezepte wurden überarbeitet. Deshalb haben wir deinen Plan dieser Woche neu erstellt – auch die vergangenen Tage.',
    ok: 'Verstanden',
  },
  retrySave: 'Erneut versuchen',

  // --- Rezeptsuche (19.6, Etappe N5c) ------------------------------------------------------------------------------
  dietNames: { vegan: 'vegan', vegetarian: 'vegetarisch', omnivore: 'mit Fleisch' },
  search: {
    title: 'Rezepte suchen',
    open: 'Rezepte suchen',
    intro:
      'Rezepte, die zu deinen Angaben passen. Unverträglichkeiten, „mag ich nicht“, Schweinefleisch und Hinweise für die Schwangerschaft gelten auch hier und lassen sich nicht abschalten.',
    textLabel: 'Im Titel suchen',
    textHint: 'z. B. „Curry“ oder „Oats“',
    dietTitle: 'Ernährungsform',
    dietOwn: (diet: string) => `Deine Ernährungsform: ${diet}`,
    dietAlso: (diet: string) => `Auch ${diet}`,
    dietHint:
      'Deine Ernährungsform ist vorbelegt. Du kannst die Suche erweitern – solche Rezepte sind gekennzeichnet und kommen nie automatisch in deinen Essensplan.',
    categoryTitle: 'Kategorie',
    sectionTitle: 'Mahlzeit',
    quick: 'Unter 10 Minuten',
    costTitle: 'Höchstens je Portion',
    costStep: (eur: number) => `bis ${eur} €`,
    costHint: 'Nur Rezepte mit geprüfter Kostenschätzung.',
    results: (n: number) => (n === 1 ? '1 Rezept gefunden' : `${n} Rezepte gefunden`),
    empty: 'Keine passenden Rezepte gefunden. Probiere es mit weniger Filtern.',
    emptyLibrary: 'Es gibt noch keine Rezepte.',
    reset: 'Filter zurücksetzen',
    outsideDiet: (diet: string) => `Passt nicht zu deiner Ernährungsform: ${diet}`,
    minutes: (n: number) => `${n} Min.`,
    kcal: (kcal: string) => `${kcal} kcal je Portion`,
    draft: 'Entwurf',
    testphase: 'Testphase – nicht fachlich geprüft',
    cardA11y: (title: string) => `Rezept öffnen: ${title}`,
    outsideDietRecipe:
      'Du hast dieses Rezept über die erweiterte Suche gefunden. Es kommt nie automatisch in deinen Essensplan.',
  },

  // --- Kühlschrank-Suche „Was habe ich da?“ (19.7 N11, KONZEPT 6.11) ------------------------------------------------
  fridge: {
    title: 'Was habe ich da?',
    open: 'Was habe ich da?',
    intro:
      'Wähle aus, was du im Kühlschrank oder Vorrat hast. Wir zeigen Rezepte, die möglichst viel davon verwenden. Unverträglichkeiten, „mag ich nicht“, Schweinefleisch, deine Ernährungsform und Hinweise für die Schwangerschaft gelten auch hier.',
    privacy: 'Deine Auswahl wird nicht gespeichert – sie ist weg, sobald du die Seite verlässt.',
    filterLabel: 'Zutat suchen',
    filterHint: 'z. B. „Paprika“ oder „Reis“',
    chooseTitle: 'Was hast du da?',
    minorHint: 'Vorrat und Gewürze zählen weniger als frische Zutaten.',
    noOptionMatch: 'Keine Zutat mit diesem Namen.',
    selected: (n: number) =>
      n === 0
        ? 'Noch nichts ausgewählt'
        : n === 1
          ? '1 Zutat ausgewählt'
          : `${n} Zutaten ausgewählt`,
    limit: (n: number) => `Du kannst höchstens ${n} Zutaten auswählen.`,
    clear: 'Auswahl leeren',
    resultsTitle: 'Passende Rezepte',
    results: (n: number) => (n === 1 ? '1 Rezept gefunden' : `${n} Rezepte gefunden`),
    emptySelection: 'Wähle oben mindestens eine Zutat aus, dann zeigen wir passende Rezepte.',
    onlySeasoning:
      'Gewürze und Backzutaten allein reichen nicht – wähle mindestens eine weitere Zutat.',
    empty:
      'Kein Rezept passt zu deiner Auswahl. Wähle weitere Zutaten oder schau in die Rezeptsuche.',
    emptyLibrary: 'Es gibt noch keine Rezepte.',
    noOptions: 'Für deine Angaben gibt es noch keine Rezepte.',
    match: (percent: number) => `${percent} % passt`,
    matchA11y: (percent: number) => `Übereinstimmung ${percent} Prozent`,
    have: (list: string) => `Hast du: ${list}`,
    missing: (list: string, more: number) =>
      `Fehlt noch: ${list}${more > 0 ? ` und ${more} weitere` : ''}`,
    missingNone: 'Alle Hauptzutaten hast du da.',
    missingMinor: (list: string) => `Aus dem Vorrat: ${list}`,
    minutes: (n: number) => `${n} Min.`,
    kcal: (kcal: string) => `${kcal} kcal je Portion`,
    draft: 'Entwurf',
    testphase: 'Testphase – nicht fachlich geprüft',
    allergenWarning:
      'Entwürfe: Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden.',
    /** Testphase (freigegeben ohne Fachprüfung, Wächter M2). */
    testphaseAllergenWarning:
      'Testphase: Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden.',
    cardA11y: (title: string) => `Rezept öffnen: ${title}`,
    toSearch: 'Zur Rezeptsuche',
    more: (n: number) => `Mehr anzeigen (noch ${n})`,
  },

  // --- PDF P5: Essensplan und Einkaufsliste (11, Etappe N6) ---------------------------------------------------------
  /** Texte im Druck-Dokument – keine Gründe, kein Gewicht, keine Unverträglichkeiten (11, K4). */
  print: {
    docTitle: { nutrition_plan: 'Essensplan', shopping_list: 'Einkaufsliste' },
    coverHeading: { nutrition_plan: 'Dein Essensplan', shopping_list: 'Deine Einkaufsliste' },
    footer: 'Alpha5 ersetzt keine ärztliche oder ernährungsfachliche Beratung.',
    footerTestValues: 'Nährwerte: Testwerte (keine Quelldaten).',
    labelWeek: 'Woche',
    labelRange: 'Zeitraum',
    howToPlan:
      'So nutzt du den Plan: Die Wochenübersicht zeigt je Tag deine Mahlzeiten mit der Menge („× 1,5“ = 1,5-fache Menge des Grundrezepts). Danach findest du jedes Rezept mit den Zutaten für deine Mengen und den Schritten.',
    howToNumbers: 'Tagessummen in kcal sind Schätzungen – ±10 % sind normal.',
    howToList:
      'Nach Abteilungen sortiert – zum Abhaken im Laden. Mengen sind auf übliche Kaufmengen aufgerundet. Was du wahrscheinlich schon da hast, steht am Ende unter „Hast du wahrscheinlich da“.',
    noticeTitle: 'Wichtig',
    testValues:
      'Beispiel-Rezepte mit TESTWERTEN – keine echten Nährwerte, keine geprüften Allergene. Nur zum Ausprobieren.',
    draftAllergens:
      'Entwürfe: Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden.',
    testphaseAllergens:
      'Testphase: Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden.',
    weekHeading: 'Wochenübersicht',
    weekHeadingContinued: 'Wochenübersicht (Fortsetzung)',
    colSlot: 'Mahlzeit',
    extraRow: 'Ergänzung',
    portion: (factor: string) => `× ${factor}`,
    marks: { fill: 'Ergänzung', leftover: 'vorgekocht', cook: 'Kochtag' },
    none: '–',
    noRecipe: 'kein passendes Rezept',
    rowTotal: 'Tagessumme',
    rowNote: 'Hinweis',
    belowFloor: 'unvollständig',
    kcal: (kcal: string) => `${kcal} kcal`,
    legendPortion: '× 1,5 = 1,5-fache Menge des Grundrezepts.',
    legendFill: 'Ergänzung: kleiner Zusatz, damit du deinen Bedarf erreichst.',
    legendCook: 'Kochtag: an diesem Tag für mehrere Tage vorkochen.',
    legendLeftover: 'vorgekocht: vom Kochtag, nur aufwärmen.',
    legendBelowFloor:
      'unvollständig: Dieser Tag erreicht deinen Mindestbedarf nicht – ergänze z. B. eine Portion Obst, Nüsse oder Joghurt.',
    legendNoRecipe: 'kein passendes Rezept: Für diesen Platz gibt es gerade kein Rezept.',
    legendNumbers: 'Tagessummen sind Schätzungen – ±10 % sind normal.',
    recipeContinued: (title: string) => `${title} (Fortsetzung)`,
    labelInPlan: 'In deinem Plan',
    use: (weekday: string, slot: string) => `${weekday} (${slot})`,
    labelTime: 'Zeit',
    colIngredient: 'Zutat',
    colPortion: (factor: string, days: string) => `× ${factor} (${days})`,
    omitted: (list: string) => `Ohne: ${list} (optionale Zutaten weggelassen)`,
    checked: 'erledigt',
    addedRecipes: (list: string) => `Auch auf der Liste – Zutaten für: ${list}.`,
  },
  printView: {
    button: 'Als PDF speichern',
    planHint: 'Öffnet die Druckansicht deines Essensplans.',
    listHint: 'Öffnet die Druckansicht deiner Einkaufsliste.',
    titlePlan: 'Essensplan als PDF',
    titleList: 'Einkaufsliste als PDF',
    introPlan:
      'Dein Essensplan der Woche auf A4 – mit Wochenübersicht und Rezepten. Die Datei entsteht nur auf deinem Gerät.',
    introList:
      'Deine Einkaufsliste auf A4 mit Kästchen zum Abhaken. Die Datei entsteht nur auf deinem Gerät.',
    healthText:
      'Dieser Plan berücksichtigt deine Gesundheitsangaben. Gründe, Gewicht und Unverträglichkeiten stehen nicht im PDF – Ersatzprodukte und weggelassene Zutaten (z. B. „Laktosefreie Milch statt Vollmilch“) lassen aber darauf schließen. Speichere oder drucke die Datei nur bewusst.',
    healthTextList:
      'Diese Liste stammt aus einem Plan, der deine Gesundheitsangaben berücksichtigt. Gründe, Gewicht und Unverträglichkeiten stehen nicht im PDF – Ersatzprodukte (z. B. „Laktosefreie Milch“) und fehlende Zutaten lassen aber darauf schließen. Speichere oder drucke die Datei nur bewusst.',
    numbersOff: 'Kalorienzahlen sind ausgeblendet – das PDF enthält keine kcal.',
    numbersOn: 'Das PDF enthält nur Tagessummen in kcal, keine Nährwerte je Rezept.',
    back: 'Zurück',
    noPlan: 'Für diese Woche gibt es noch keinen Essensplan – deshalb gibt es nichts zu drucken.',
    noMeals: 'In deinem Essensplan gibt es gerade keine Mahlzeiten zum Drucken.',
    recipeMissing:
      'Die Rezepte deines Plans konnten gerade nicht geladen werden. Öffne den Essensplan einmal neu und versuche es noch einmal.',
    previewPlan: 'Vorschau deines Essensplans',
    previewList: 'Vorschau deiner Einkaufsliste',
  },

  // --- Ratgeber (6.8, Etappe N5c) ----------------------------------------------------------------------------------
  guides: {
    title: 'Ratgeber',
    open: 'Ratgeber',
    intro:
      'Zum Nachlesen – die Ratgeber sind in der App gespeichert und funktionieren auch ohne Netz.',
    none: 'Es gibt noch keine Ratgeber.',
    notFound: 'Diesen Ratgeber gibt es nicht (mehr).',
    draft: 'Entwurf – fachlich noch nicht geprüft',
    testphase: 'Testphase – noch nicht fachlich geprüft',
    openA11y: (title: string) => `Ratgeber öffnen: ${title}`,
    hiddenNumbers: 'Zahlenangaben zu Kalorien und Nährstoff-Mengen sind hier ausgeblendet.',
    hiddenInSection: (n: number) =>
      n === 1
        ? 'Ein Absatz mit Zahlen ist ausgeblendet.'
        : `${n} Absätze mit Zahlen sind ausgeblendet.`,
    places: 'Unterwegs',
    good: 'Gute Wahl',
    lessOften: 'Eher selten',
    tip: (text: string) => `Tipp: ${text}`,
    disclaimer:
      'Allgemeine Informationen, keine persönliche Beratung. Bei Vorerkrankungen, in der Schwangerschaft oder bei Medikamenten sprich mit deiner Ärztin oder deinem Arzt.',
  },
} as const;
