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
      'Bitte bestätige die neue Fassung der Einwilligung Gesundheitsdaten – sonst können wir deine Unverträglichkeiten nicht berücksichtigen. Bis dahin zeigen wir keinen Essensplan und keine Rezepte.',
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
    'Deine gespeicherten Unverträglichkeiten werden endgültig gelöscht und beim Essensplan nicht mehr berücksichtigt. Du kannst Lebensmittel stattdessen unter „mag ich nicht“ ausschließen (Einstellungen → Ernährung ändern).',
  deleteIntolerancesConfirm: 'Löschen',
  deleteIntolerancesDone: 'Gespeicherte Unverträglichkeiten gelöscht.',
  setupNeeded:
    'Richte deine Ernährung kurz ein: Wie aktiv ist dein Alltag und wann trainierst du meistens?',
  setupButton: 'Ernährung einrichten',
  noRecipes: 'Für deine Angaben gibt es noch keine Rezepte.',
  noRecipesTestMode:
    'Noch keine Rezepte: Der Lebensmittel-Katalog wird gerade importiert. Zum Ausprobieren kannst du Beispiel-Rezepte mit Testwerten verwenden.',
  demoUse: 'Beispiel-Rezepte mit Testwerten verwenden',
  demoBanner:
    'Beispiel-Rezepte mit TESTWERTEN – keine echten Nährwerte, keine geprüften Allergene. Nur zum Ausprobieren.',
  demoOff: 'Beispiel-Rezepte ausblenden',
  demoSource: 'Nährwerte: Testwerte (keine Quelldaten).',
  source: (db: string, version: string, license: string) =>
    `Nährwerte: ${db} ${version} (${license}).`,
  sourceNames: {
    bls: 'Bundeslebensmittelschlüssel (BLS), Max Rubner-Institut',
    ch_naehrwertdatenbank: 'Schweizer Nährwertdatenbank (BLV)',
    usda_fdc: 'USDA FoodData Central',
  },

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
      'Deine Unverträglichkeiten werden gelöscht und beim Essensplan nicht mehr berücksichtigt. Essenspläne und Einkaufslisten mit Gesundheitsbezug werden gelöscht – auch deine eigenen Einträge in der Einkaufsliste.',
    convert: 'Diese Lebensmittel stattdessen unter „mag ich nicht“ ausschließen?',
    convertHint: '„Mag ich nicht“ wirkt im Essensplan genauso – es ist kein Gesundheitsdatum.',
    converted: 'Deine bisherigen Unverträglichkeiten stehen jetzt unter „mag ich nicht“.',
  },
} as const;
