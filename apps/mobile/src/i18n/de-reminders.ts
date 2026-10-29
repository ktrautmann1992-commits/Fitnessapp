/**
 * Erinnerungen an Training, Essen und Trinken (docs/PLAN-ERINNERUNGEN.md, Gründer-Wunsch 29.10.2026). Kurz, freundlich,
 * ohne Gesundheitswerte im Benachrichtigungstext (kein Gewicht, keine kcal, kein Zyklus) – nur Uhrzeit, Name der
 * Einheit bzw. Gericht.
 */

/** „18:00“ aus Minuten nach Mitternacht. */
export const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const MEAL_NAMES: Record<string, string> = {
  breakfast: 'Frühstück',
  main: 'Mittagessen',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack_morning: 'Snack am Vormittag',
  snack_afternoon: 'Snack am Nachmittag',
  snack_pre_dinner: 'Snack vor dem Abendessen',
  snack_late: 'Snack am Abend',
  snack_night: 'Snack am späten Abend',
};

export const deReminders = {
  title: 'Erinnerungen an Training, Essen und Trinken',
  intro:
    'Kurze Benachrichtigungen auf diesem Handy – geplant für die nächsten 7 Tage, nie zwischen 22 und 7 Uhr. Ändert sich dein Plan oder verschiebst du eine Einheit, plant Alpha5 neu.',
  web: 'Erinnerungen an Training, Essen und Trinken gibt es nur in der App (Android/iPhone) – im Browser kommen keine Benachrichtigungen.',
  webTest:
    'Testmodus im Browser: Du kannst die Erinnerungen hier ausprobieren und einstellen, Benachrichtigungen kommen aber nur in der App.',
  denied:
    'Benachrichtigungen sind für Alpha5 nicht erlaubt. Erlaube sie in den System-Einstellungen unter „Apps“ → „Alpha5“ → „Benachrichtigungen“.',
  training: {
    label: 'Training',
    hint: 'Erinnert dich vor jeder geplanten Einheit. Ohne Uhrzeit an der Einheit kommt die Erinnerung morgens um 8 Uhr.',
    leadGroup: 'Wie lange vorher?',
    lead: (minutes: number) => (minutes >= 60 ? `${minutes / 60} Std.` : `${minutes} Min.`),
  },
  meals: {
    label: 'Essen',
    hint: 'Erinnert dich an die Mahlzeiten aus deinem Essensplan – vor und nach dem Training passend zur Einheit. Ohne Essensplan an Frühstück, Mittag- und Abendessen.',
    times: 'Deine Essenszeiten',
    breakfast: 'Frühstück',
    lunch: 'Mittagessen',
    dinner: 'Abendessen',
  },
  drink: {
    label: 'Trinken',
    hint: 'Erinnert dich in deinem Zeitfenster regelmäßig an ein Glas Wasser.',
    from: 'Ab',
    to: 'Bis',
    everyGroup: 'Wie oft?',
    every: (minutes: number) =>
      minutes === 60 ? 'Stündlich' : minutes === 90 ? 'Alle 1,5 Std.' : `Alle ${minutes / 60} Std.`,
  },
  earlier: 'Früher',
  later: 'Später',
  earlierA11y: (what: string) => `${what} 30 Minuten früher`,
  laterA11y: (what: string) => `${what} 30 Minuten später`,
  timeValue: (what: string, minutes: number) => `${what}: ${clock(minutes)} Uhr`,
  saveFailed: 'Die Einstellung konnte nicht gespeichert werden. Bitte versuch es noch einmal.',
  /** Texte der Benachrichtigungen. */
  notify: {
    trainingAt: (start: number, approx: boolean) =>
      `${approx ? 'Training ca. um' : 'Training um'} ${clock(start)} Uhr`,
    trainingToday: (count: number) =>
      count === 1 ? 'Heute steht Training an' : `Heute stehen ${count} Einheiten an`,
    mealTitle: (slot: string) =>
      slot.startsWith('snack')
        ? 'Zeit für deinen Snack'
        : `Zeit fürs ${MEAL_NAMES[slot] ?? 'Essen'}`,
    mealPre: (slot: string) => `${MEAL_NAMES[slot] ?? 'Essen'} vor dem Training`,
    mealPost: (slot: string) => `${MEAL_NAMES[slot] ?? 'Essen'} nach dem Training`,
    snackBefore: 'Kleiner Snack vor dem Training',
    snackBeforeBody: (start: number) =>
      `Training um ${clock(start)} Uhr – etwas Leichtes mit Kohlenhydraten.`,
    afterTraining: 'Nach dem Training: Zeit zum Essen',
    afterTrainingBody: 'Eiweiß und Kohlenhydrate helfen bei der Erholung.',
    drink: 'Zeit für ein Glas Wasser',
  },
} as const;
