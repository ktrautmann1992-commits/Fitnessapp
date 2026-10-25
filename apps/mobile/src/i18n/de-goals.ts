/**
 * Texte zu Haupt- und Nebenziel und zum konkreten Abnehmziel mit Planbarkeits-Ampel (docs/PLAN-ZIELE.md 2.3, 3.1,
 * 3.4, 4.2, 6; Etappe Z4). Regeln für die Texte (Plan 6 Nr. 6): keine Heilversprechen, keine wertenden Wörter, kein
 * „Du wirst X kg verlieren“, kein „garantiert“, kein „erreichbar“ (Wächter Z4 N1: „planbar“), kein Kalenderdatum zur Dauer (Wächter S20).
 * Immer „wir planen …“ und „etwa“. Prozentwerte nur in der Detail- bzw. Screenreader-Zeile (Wächter K8).
 */

/** Zusätze zum Schritt „Dein Ziel“ (Haupt- und Nebenziel, Plan 4.2 und 6 Nr. 1). */
export const deGoalChoice = {
  primaryLabel: 'Was ist dir am wichtigsten?',
  descriptions: {
    fat_loss: 'Körperfett verringern, mit Kraft- und Ausdauertraining.',
    definition: 'Fett verringern und Muskeln erhalten – mit kleinem Kaloriendefizit.',
    muscle_gain: 'Muskeln und Kraft aufbauen.',
    general_fitness: 'Fitter und gesünder werden, ohne besonderen Schwerpunkt.',
    endurance: 'Ausdauer verbessern – Laufen, Rad, Schwimmen oder Triathlon.',
    // Fit im Alter (docs/PLAN-FIT-IM-ALTER.md 5): Untertitel aus dem Plan, keine Wirkungsaussage zu Stürzen (4.2).
    active_aging: 'Kraft, Gleichgewicht und Beweglichkeit für einen selbstständigen Alltag.',
    // Calisthenics (docs/PLAN-CALISTHENICS-SCHLINGE.md 2): Stufen statt Gewichte, Skills nur mit Voraussetzungen.
    calisthenics:
      'Kraft mit dem eigenen Körper an Stange und Barren – Stufe für Stufe, bis zu Skills wie Handstand oder Muscle-up.',
  },
  secondaryLabel: 'Zweites Ziel (optional)',
  secondaryIntro:
    'Dein Plan folgt deinem Hauptziel. Ein zweites Ziel ergänzt ihn, z. B. mit Ausdauer-Tagen oder mehr Eiweiß.',
  noSecondary: 'Kein zweites Ziel',
  secondaryA11y: (goal: string) => `Zweites Ziel: ${goal}`,
  secondaryBlockedA11y: (goal: string, reason: string) =>
    `Zweites Ziel: ${goal} – nicht wählbar. ${reason}`,
  blockedReasons: {
    same: 'Das ist schon dein Hauptziel.',
    overlap: 'Definition verbindet schon Fettverlust und Muskelerhalt.',
    fitness_secondary: 'Fitness steckt in jedem Plan – als zweites Ziel ändert es nichts.',
    primary_preferred: 'Wähle dieses Ziel lieber als Hauptziel.',
  },
  /** Ein Satz je erlaubtem Paar `${Hauptziel}>${Nebenziel}` (feste Textbausteine, Plan 6 Nr. 1, Wächter K3, Z1 S-3). */
  combinations: {
    'fat_loss>muscle_gain':
      'Abnehmen steht vorn: Kaloriendefizit, viel Eiweiß und Krafttraining, damit Muskeln erhalten bleiben.',
    'fat_loss>endurance': 'Abnehmen steht vorn, dazu planen wir Ausdauer-Tage ein.',
    'definition>endurance':
      'Definition steht vorn: kleines Kaloriendefizit und viel Eiweiß, dazu Ausdauer-Tage.',
    'muscle_gain>fat_loss':
      'Kleines Kaloriendefizit, viel Eiweiß, Krafttraining für Muskelaufbau. Entspricht „Definition“ – zusätzlich kannst du ein Wunschgewicht festlegen.',
    'muscle_gain>endurance':
      'Muskelaufbau steht vorn, dazu planen wir Ausdauer-Tage ein. Plane Ausdauer möglichst nicht direkt vor dem Krafttraining.',
    'general_fitness>fat_loss': 'Fitness steht vorn, dazu planen wir ein Kaloriendefizit ein.',
    // Wächter Z1 S-3: gleichwertig nur bei Energie und Eiweiß, nicht in der Trainingswoche (Hauptziel zuerst).
    'general_fitness>endurance':
      'Bei Energie und Eiweiß wie das Ziel „Ausdauer“. In deiner Woche planen wir zuerst Kraft-Tage, dann Ausdauer.',
    'endurance>fat_loss': 'Ausdauer steht vorn, dazu planen wir ein kleines Kaloriendefizit ein.',
    'endurance>definition':
      'Ausdauer steht vorn, dazu ein kleines Kaloriendefizit und viel Eiweiß für den Muskelerhalt.',
    // Fit im Alter → Abnehmen (FA-G6): fester Satz aus dem Plan (11).
    'active_aging>fat_loss':
      'Fit im Alter steht vorn, dazu ein kleines Kaloriendefizit. Im Alter ist Muskelerhalt wichtiger als die Zahl auf der Waage.',
    'endurance>muscle_gain':
      'Ausdauer steht vorn, dazu Krafttraining für Muskelaufbau – ohne Kaloriendefizit.',
    'calisthenics>fat_loss':
      'Calisthenics steht vorn, dazu ein Kaloriendefizit und viel Eiweiß, damit die Kraft erhalten bleibt.',
  } as Record<string, string>,
  enduranceSecondary: 'Dein zweites Ziel ist Ausdauer – Disziplin und Datum sind optional.',
  /** Ohne Einwilligung Gesundheitsdaten: konkretes Abnehmziel gesperrt (Plan 2.3). */
  weightGoalLockedTitle: 'Wunschgewicht nur mit Einwilligung',
  weightGoalLocked:
    'Ein konkretes Abnehmziel (Wunschgewicht und Zeitraum) braucht dein Gewicht – dafür brauchen wir deine Einwilligung zu Gesundheitsdaten. Ohne sie planen wir in gesundem Tempo, ohne festes Ziel.',
  weightGoalLockedButton: 'Einwilligung erteilen',
  /** Wächter Z3 N3: alter App-Stand hat noch ein zweites Ziel gespeichert, das nicht passt (Fehler 23514). */
  rejected:
    'Dein Ziel konnte nicht gespeichert werden. Bitte lade die App neu (im Browser: Seite neu laden) und wähle dein Ziel unter Einstellungen → Angaben ändern noch einmal.',
} as const;

/** Schritt „Wunschgewicht“ (weight_goal, Plan 2 und 3). */
export const deWeightGoal = {
  title: 'Wie möchtest du abnehmen?',
  modeLabel: 'Wie möchtest du abnehmen?',
  modes: {
    none: {
      label: 'In gesundem Tempo, ohne festes Ziel',
      text: 'Wir planen ein moderates Kaloriendefizit. Du musst nichts festlegen.',
    },
    concrete: {
      label: 'Mit konkretem Ziel',
      text: 'Du legst fest, wie viel du in welchem Zeitraum abnehmen möchtest. Wir zeigen dir, wie gut das planbar ist.',
    },
  },
  /** Gesperrt (Plan 2.3): Grund + ggf. Knopf zur Abhilfe. */
  blockedTitle: 'Ein konkretes Ziel ist gerade nicht möglich',
  blocked: {
    not_fat_loss: 'Ein Wunschgewicht gibt es nur beim Ziel Abnehmen.',
    no_consent: 'Für ein konkretes Ziel brauchen wir dein aktuelles Gewicht.',
    body_data_missing: 'Für ein konkretes Ziel brauchen wir dein aktuelles Gewicht.',
    pregnancy: 'In der Schwangerschaft planen wir kein Abnehmziel.',
    minor: 'Im Wachstum ist eine Diät nicht sinnvoll. Wir planen ausgewogen ohne Kaloriendefizit.',
    weight_outdated: 'Dein Gewicht ist älter als 3 Monate – bitte kurz aktualisieren.',
    underweight: 'Bei deinem aktuellen Gewicht planen wir kein Kaloriendefizit.',
    health_check_missing: 'Mach bitte zuerst den kurzen Gesundheits-Check.',
  },
  remedies: {
    no_consent: 'Einwilligung erteilen',
    body_data_missing: 'Gewicht eintragen',
    weight_outdated: 'Gewicht aktualisieren',
    health_check_missing: 'Gesundheits-Check machen',
  },
  amountLabel: 'Wie viel?',
  amountModes: { kg_to_lose: 'kg abnehmen', target_weight: 'Zielgewicht' },
  kgField: 'kg abnehmen ab heute',
  kgHint: 'In Schritten von 0,5 kg.',
  targetField: 'Zielgewicht in kg',
  currentWeight: (kg: string) => `Dein aktuelles Gewicht: ${kg} kg`,
  timeLabel: 'In welchem Zeitraum?',
  timeModes: { weeks: 'in Wochen', date: 'bis Datum' },
  weeksField: 'Wochen',
  weeksHint: '4 bis 104 Wochen (2 Jahre).',
  weeksMinus: 'Eine Woche weniger',
  weeksPlus: 'Eine Woche mehr',
  dateField: 'Bis zum',
  required: 'Bitte gib eine Menge und einen Zeitraum ein.',
  incompleteDate: 'Bitte das Datum vollständig eingeben (TT.MM.JJJJ).',
  invalidDate: 'Dieses Datum gibt es nicht.',
  /** Fehler je Code (Plan 2.3). */
  issues: {
    not_below_current:
      'Dein Zielgewicht liegt nicht unter deinem aktuellen Gewicht. Wähle „ohne festes Ziel“ oder ein anderes Ziel.',
    below_min_kg: 'Bitte mindestens 1 kg.',
    target_out_of_range: 'Bitte ein Zielgewicht zwischen 30 und 300 kg.',
    target_bmi_too_low:
      'Dieses Zielgewicht liegt unter dem Bereich, den wir planen. Wenn Essen oder Gewicht dich belasten, hol dir Unterstützung.',
    period_out_of_range: 'Bitte einen Zeitraum zwischen 4 Wochen und 2 Jahren.',
    kg_step: 'Bitte in Schritten von 0,5 kg.',
    target_step: 'Bitte das Zielgewicht mit höchstens einer Nachkommastelle.',
    no_deficit: 'Derzeit planen wir für dich kein Kaloriendefizit. Wähle bitte „ohne festes Ziel“.',
    invalid_number: 'Bitte eine Zahl eingeben.',
  },
  breastfeeding:
    'Wenn du stillst, sprich ein Abnehmziel bitte vorher mit deiner Ärztin, deinem Arzt oder deiner Hebamme ab.',
  /** Wächter K6: Kalorienzahlen ausgeblendet → ruhige Rückfrage. */
  hiddenNumbersTitle: 'Wirklich ein festes Ziel?',
  hiddenNumbers:
    'Du hast Kalorienzahlen ausgeblendet. Möchtest du wirklich ein festes Ziel? Ohne festes Ziel planen wir genauso gesund.',
  hiddenNumbersConfirm: 'Ja, festes Ziel',
  loadFailed: 'Deine Angaben konnten nicht gelesen werden. Bitte gehe einen Schritt zurück.',
  noGoal: 'Bitte wähle zuerst dein Ziel.',
  /** Ampel (Plan 3.1, 3.4; F6 vier Farben, Wächter S4). */
  scale: {
    title: 'Wie gut ist das planbar?',
    pending: 'Noch keine Bewertung – gib Menge und Zeitraum ein.',
    pendingInvalid: 'Noch keine Bewertung – bitte prüfe deine Eingaben.',
    /** Beschriftung unter dem Balken, von links (rot) nach rechts (grün). */
    labels: ['zu schnell', 'sehr ehrgeizig', 'ehrgeizig', 'ruhig'],
    zoneWords: {
      red: 'zu schnell',
      orange: 'sehr ehrgeizig',
      yellow: 'ehrgeizig',
      green: 'ruhig',
    },
    levels: {
      green: {
        title: 'Gut planbar',
        text: 'Ein ruhiges Tempo, das sich gut durchhalten lässt.',
      },
      yellow: {
        title: 'Ehrgeizig, aber machbar',
        text: 'Wir planen in deinem Tempo. Ausreichend Eiweiß und Krafttraining helfen, Muskeln zu erhalten.',
      },
      orange_calmer: {
        title: 'Sehr ehrgeizig',
        text: (weeks: string) => `Wir planen in deinem Tempo. Ruhiger wäre etwa ${weeks}.`,
      },
      orange_slower: {
        title: 'Sehr ehrgeizig – wir planen etwas langsamer',
        text: (weeks: string) => `Sicher planbar sind für dich etwa ${weeks}.`,
      },
      red: {
        title: 'So schnell nicht sicher – wir planen langsamer',
        text: (weeks: string) =>
          `Mehr als etwa 1 % deines Körpergewichts pro Woche planen wir nicht. Sicher planbar sind etwa ${weeks}.`,
      },
    },
    overMax: 'Über 2 Jahre – wir empfehlen „ohne festes Ziel“.',
    overMaxRed:
      'Mehr als etwa 1 % deines Körpergewichts pro Woche planen wir nicht. Über 2 Jahre – wir empfehlen „ohne festes Ziel“.',
    weeks: (n: number) => (n === 1 ? '1 Woche' : `${n} Wochen`),
    weeksWithMonths: (n: number, months: number) => `${n} Wochen (etwa ${months} Monate)`,
    detail: (percent: string) => `Benötigt etwa ${percent} % deines Gewichts pro Woche.`,
    apply: (n: number) => `Zeitraum auf ${n} Wochen setzen`,
    a11y: (word: string, detail: string, safe: string | null) =>
      `Planbarkeit: ${word}. ${detail}${safe ? ` ${safe}` : ''}`,
    a11ySafe: (weeks: string) => `Sicher planbar sind etwa ${weeks}.`,
    a11yOverMax: 'Sicher planbar ist es erst in über 2 Jahren.',
    meterLabel: 'Planbarkeit',
    /** Kein Defizit planbar (Wächter S1) bzw. Ziel-BMI zu niedrig: sofort in der Ampel, mit Empfehlung. */
    useNone: 'Ohne festes Ziel planen',
    about: 'Etwa-Werte: Wir rechnen neu, sobald du ein neues Gewicht einträgst.',
  },
} as const;

/**
 * Einstellungen „Dein Abnehm-Ziel“, Karten „erreicht“/„Zeitraum vorbei“ und Hinweise in „Ernährung“ (docs/PLAN-ZIELE.md
 * 6 Nr. 3–4, F10, F13, K10; Etappe Z5). Wunschgewicht und Zeitraum stehen nur unter Einstellungen (F13): Karten und Hinweise
 * nennen nie Zielgewicht, Fortschritt, Restmenge oder ein Datum; kein Konfetti, kein Abzeichen, keine Prognose (F7).
 */
export const deWeightGoalLife = {
  settings: {
    title: 'Dein Abnehm-Ziel',
    entryText:
      'Ohne festes Ziel oder mit Wunschgewicht und Zeitraum. Wunschgewicht und Zeitraum siehst du nur hier; auf „Heute“ erscheint nur eine Karte, wenn dein Ziel erreicht oder der Zeitraum vorbei ist – ohne Zahlen.',
    open: 'Dein Abnehm-Ziel',
    none: 'Ohne festes Ziel – wir planen in gesundem Tempo.',
    noneHint:
      'Mit einem konkreten Ziel legst du Wunschgewicht und Zeitraum fest. Schneller als ohne festes Ziel planen wir nie.',
    set: 'Konkretes Ziel festlegen',
    target: (kg: string) => `Wunschgewicht: ${kg} kg`,
    periodWeeks: (weeks: string, from: string) => `Zeitraum: ${weeks}, gespeichert am ${from}`,
    periodDate: (until: string, from: string) => `Zeitraum: bis ${until}, gespeichert am ${from}`,
    edit: 'Ziel bearbeiten',
    newWeight: 'Neues Gewicht eintragen',
    remove: 'Ziel entfernen',
    removeTitle: 'Ziel entfernen?',
    removeText:
      'Wir planen dann wieder in gesundem Tempo, ohne festes Ziel. Dein Essensplan wird ab heute angepasst.',
    removeConfirm: 'Ziel entfernen',
    removed: 'Dein Ziel ist entfernt. Wir planen in gesundem Tempo, ohne festes Ziel.',
    saved: 'Gespeichert. Wir planen ab heute neu.',
    notFatLoss: 'Ein Wunschgewicht gibt es nur beim Ziel Abnehmen.',
    changeGoal: 'Ziel ändern',
    noConsent:
      'Ein konkretes Abnehmziel braucht dein Gewicht – dafür brauchen wir deine Einwilligung zu Gesundheitsdaten.',
    consentButton: 'Einwilligung erteilen',
    status: {
      active: 'Wir planen dein Ziel in deiner Ernährung ein – nie schneller als ohne festes Ziel.',
      paused:
        'Dein Ziel ruht gerade. Wir planen ohne Kaloriendefizit, bis sich deine Angaben ändern.',
      /** Etappe W1 (Wächter N4): Ruhe nur wegen eines Wettkampfs. */
      pausedCompetition:
        'Dein Ziel ruht wegen deines Wettkampfs und läuft danach von selbst weiter – ohne Aufholen.',
      invalid: 'Dein Zielgewicht passt nicht mehr zu deinen Angaben. Bitte passe es an.',
      no_deficit:
        'Derzeit planen wir für dich kein Kaloriendefizit. Wir empfehlen „ohne festes Ziel“.',
    },
    adjust: 'Ziel anpassen',
    weightOutdated:
      'Dein Gewicht ist älter als 3 Monate. Trag es bitte neu ein, damit wir dein Ziel richtig planen.',
    weightOutdatedButton: 'Gewicht aktualisieren',
    saveFailed: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
  },
  /** Karten auf „Heute“ und unter Einstellungen (F10). */
  cards: {
    reached: {
      title: 'Wunschgewicht erreicht',
      text: 'Du hast dein Wunschgewicht erreicht. Wie geht es weiter? Bis du wählst, planen wir ohne Kaloriendefizit.',
      maintain: 'Gewicht halten',
      maintainHint: 'Ziel „Fitness & Gesundheit“, ohne Kaloriendefizit.',
      muscleGain: 'Muskelaufbau',
      muscleGainHint: 'Ziel „Muskelaufbau“ – Krafttraining und ausreichend Energie.',
      newGoal: 'Neues Wunschgewicht',
      done: 'Dein Ziel ist geändert. Unten kannst du deinen Trainingsplan neu erstellen.',
    },
    datePassed: {
      title: 'Dein Zeitraum ist vorbei',
      text: 'Dein Zeitraum ist vorbei. Wir planen jetzt im gesunden Standard-Tempo. Verlängern oder ohne festes Ziel weitermachen?',
      extend: 'Verlängern',
      none: 'Ohne festes Ziel weitermachen',
      done: 'Wir planen weiter in gesundem Tempo, ohne festes Ziel.',
    },
  },
  /** Formular (Wächter Z4 N10): erreicht/abgelaufen – kein stilles Verlängern, kein Blockieren. */
  form: {
    reached:
      'Du hast dein Wunschgewicht erreicht. Mit „Weiter“ bleibt alles, wie es ist. Für ein neues Ziel gib ein neues Wunschgewicht und einen Zeitraum ein.',
    datePassed:
      'Dein Zeitraum ist vorbei. Mit „Weiter“ bleibt alles, wie es ist (Standard-Tempo). Zum Verlängern wähle einen neuen Zeitraum ab heute.',
    extend: 'Verlängern: Wähle einen neuen Zeitraum ab heute. Wir planen ab heute neu.',
    saveButton: 'Speichern',
  },
  /** Hinweise in der Ernährungs-Übersicht der Woche (einmal je Woche, Wächter K10). */
  nutrition: {
    title: 'Dein Abnehm-Ziel',
    weight_goal_pace_capped:
      'Für dein Wunschziel planen wir etwas langsamer, damit es sicher bleibt.',
    weight_goal_reached:
      'Du hast dein Wunschgewicht erreicht. Wir planen ohne Kaloriendefizit, bis du wählst, wie es weitergeht.',
    weight_goal_date_passed: 'Dein Zeitraum ist vorbei. Wir planen im gesunden Standard-Tempo.',
    weight_goal_invalid: 'Dein Zielgewicht passt nicht mehr zu deinen Angaben. Bitte passe es an.',
    weight_goal_no_deficit:
      'Derzeit planen wir für dich kein Kaloriendefizit. Wir empfehlen „ohne festes Ziel“.',
    open: 'Ziel ansehen',
    adjust: 'Ziel anpassen',
    change: 'Ziel ändern',
  },
} as const;
