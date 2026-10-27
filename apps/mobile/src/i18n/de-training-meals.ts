import type {
  TimelineEntryKind,
  TimelineMealStatus,
  TimelineReason,
  TrainingTimingNoticeCode,
} from '@fitnessapp/core';

/**
 * Texte „Essen rund ums Training“ (Nährstoff-Timing 2, docs/PLAN-NAEHRSTOFF-TIMING.md Abschnitt 7): Zeitleiste mit
 * echten Gerichten, Begründung („Warum?“), Uhrzeit an der Einheit, Anpassung nach dem Verschieben samt „Rückgängig“,
 * Erinnerung (Standard aus). Feste Bausteine, keine KI, keine Heilversprechen (nichts „verbessert die Leistung“), keine
 * Marken. Gramm nur mit „Kalorienzahlen anzeigen“ – die App blendet sie sonst aus. Eingebunden in `de.ts` unter
 * `trainingMeals`.
 */

const KIND_TITLE: Record<TimelineEntryKind, string> = {
  pre_meal: 'Mahlzeit vor dem Training',
  pre_snack: 'Snack vorher (optional)',
  session: 'Training',
  post_meal: 'Mahlzeit nach dem Training',
};

const REASON: Record<TimelineReason, string> = {
  pre_meal:
    '2–4 Stunden vorher: kohlenhydratreich und eher wenig Fett und Ballaststoffe – so ist das Essen bis zum Training gut verdaut.',
  pre_snack:
    '30–60 Minuten vorher: wenn du Hunger hast, ein kleiner Snack mit Kohlenhydraten und wenig Fett, z. B. eine Banane.',
  early_snack:
    'Frühes Training: ein kleiner Snack vorher oder Frühstück direkt danach – beides ist in Ordnung.',
  session_short: 'Bei dieser Dauer brauchst du unterwegs nichts zu essen – trink nach Durst.',
  session_long:
    'Ab 90 Minuten: unterwegs etwas Kohlenhydrate und regelmäßig trinken. Probiere neue Snacks zuerst im Training aus.',
  post_meal:
    'Bis 2 Stunden danach: eine Mahlzeit mit Eiweiß und Kohlenhydraten – gedacht für die Erholung nach dem Training.',
  post_refuel:
    'Heute trainierst du zweimal: nach der ersten Einheit lieber gut auffüllen – vor allem mit Kohlenhydraten.',
  post_endurance: 'Nach längerer Ausdauer: etwas mehr Kohlenhydrate auf dem Teller, dazu Eiweiß.',
};

const STATUS: Record<Exclude<TimelineMealStatus, 'fits'>, string> = {
  protein_low: 'Etwas weniger Eiweiß als ideal.',
  carbs_low: 'Etwas weniger Kohlenhydrate als ideal.',
  heavy_before: 'Eher schwer vor dem Training – wenn möglich etwas früher essen.',
};

export const deTrainingMeals = {
  title: 'Essen rund ums Training',
  titleA11y: 'Zeitplan: Essen rund ums Training',
  approxNote: 'Uhrzeiten ca. – stell die Uhrzeit deiner Einheit im Reiter Training ein.',
  kindTitle: (kind: TimelineEntryKind) => KIND_TITLE[kind],
  reason: (reason: TimelineReason) => REASON[reason],
  whyLabel: 'Warum?',
  whyA11y: (title: string) => `Warum? ${title}`,
  // Leer = passt (kein Befund).
  status: (status: TimelineMealStatus): string => (status === 'fits' ? '' : STATUS[status]),
  clock: (time: string, approx: boolean) => (approx ? `ca. ${time}` : time),
  range: (from: string, to: string) => `${from}–${to}`,
  until: (time: string) => `bis ${time}`,
  portion: (factorText: string, single: boolean) =>
    single ? `${factorText} Portion` : `${factorText} Portionen`,
  mealLine: (title: string, portion: string) => `${title}, ${portion}`,
  noMeal: 'Keine Mahlzeit eingeplant.',
  snackLine: (title: string) => `Zum Beispiel: ${title}`,
  sideLine: (title: string) => `+ ${title} dazu`,
  extraA11y: (title: string) => `Vorschlag: ${title}`,
  values: (carbsG: number, proteinG: number) => `ca. ${carbsG} g KH · ${proteinG} g Eiweiß`,
  sessionKind: { strength: 'Kraft', endurance: 'Ausdauer' } as const,
  sessionLine: (kind: string, minutes: number) => `${kind}, ${minutes} min`,
  fuelingGrams: (min: number, max: number) =>
    min > 0
      ? `Unterwegs: etwa ${min}–${max} g Kohlenhydrate pro Stunde.`
      : `Unterwegs: bis ${max} g Kohlenhydrate pro Stunde.`,
  fuelingGeneral: 'Unterwegs: Kohlenhydrate in kleinen Mengen, z. B. eine Banane.',
  fuelingDrink: (min: number, max: number) =>
    `Trinken: Richtwert ${min}–${max} ml pro Stunde nach Durst – bei Hitze mehr und an Salz denken.`,
  fuelingTest: 'Mehr als 60 g pro Stunde nur, wenn du es im Training schon ausprobiert hast.',
  addToShopping: 'Auf die Einkaufsliste',
  addToShoppingA11y: (title: string) => `${title} auf die Einkaufsliste`,
  addedToShopping: (title: string) => `${title} steht auf der Einkaufsliste.`,
  addFailed: 'Das hat nicht geklappt. Bitte versuch es noch einmal.',
  // Hinweis-Zeile: höchstens ein Timing-Hinweis je Tag.
  notice: (
    code: TrainingTimingNoticeCode,
    meal: string | null,
    extra: string | null,
    showNumbers: boolean,
  ): string => {
    const add = extra !== null ? ` – z. B. ${extra} dazu` : '';
    switch (code) {
      case 'timing_protein_low_post':
        return `Nach dem Training: ${meal ?? 'die Mahlzeit'} hat etwas wenig Eiweiß${add}.`;
      case 'timing_heavy_before':
        return `Vor dem Training: ${meal ?? 'die Mahlzeit'} ist eher schwer – wenn möglich etwas früher essen.`;
      case 'timing_carbs_low':
        return `${meal ?? 'Die Mahlzeit'} hat rund ums Training eher wenig Kohlenhydrate${add}.`;
      case 'timing_meal_protein_low':
        return showNumbers
          ? `${meal ?? 'Eine Mahlzeit'} ist eiweißarm${add}.`
          : `${meal ?? 'Eine Mahlzeit'} hat wenig Eiweiß${add}.`;
      case 'timing_early_training':
        return 'Frühes Training: ein kleiner Snack vorher oder Frühstück direkt danach.';
      case 'timing_long_session':
        return 'Lange Einheit heute: unterwegs etwas Kohlenhydrate und regelmäßig trinken.';
    }
  },
  // Uhrzeit an der Einheit (Reiter Training)
  time: {
    label: 'Uhrzeit',
    value: (time: string, approx: boolean) => (approx ? `ca. ${time} (Standard)` : time),
    a11y: (time: string, approx: boolean) =>
      approx
        ? `Uhrzeit: ungefähr ${time}, Standard aus deiner Trainingszeit. Ändern`
        : `Uhrzeit: ${time}. Ändern`,
    title: 'Wann trainierst du?',
    hint: 'Die Mahlzeiten rund ums Training richten sich nach dieser Uhrzeit.',
    minusHour: '− 1 Std.',
    minusQuarter: '− 15 Min.',
    plusQuarter: '+ 15 Min.',
    plusHour: '+ 1 Std.',
    stepA11y: (label: string) => `Uhrzeit ${label}`,
    save: 'Uhrzeit speichern',
    remove: 'Eigene Uhrzeit entfernen',
    cancel: 'Abbrechen',
    saved: (time: string) => `Uhrzeit ${time} gespeichert. Die Mahlzeiten passen sich an.`,
    removed: 'Eigene Uhrzeit entfernt – es gilt wieder deine Trainingszeit.',
    failed: 'Die Uhrzeit ließ sich nicht speichern. Bitte versuch es noch einmal.',
  },
  // Nach dem Verschieben
  adjusted: {
    text: 'Mahlzeiten an dein Training angepasst.',
    changes: (count: number) =>
      count === 1 ? '1 Gericht getauscht' : `${count} Gerichte getauscht`,
    change: (from: string, to: string) => `${from} → ${to}`,
    onlyPortions: 'Portionen an den neuen Tag angepasst.',
    shopping: 'Einkaufsliste angepasst.',
    shoppingDetail: (added: number, removed: number, changed: number) =>
      [
        added > 0 ? `${added} neu` : null,
        removed > 0 ? `${removed} nicht mehr nötig` : null,
        changed > 0 ? `${changed} andere Menge` : null,
      ]
        .filter((x): x is string => x !== null)
        .join(' · '),
    checkedKept: 'Abgehaktes bleibt abgehakt.',
    undo: 'Rückgängig',
    undoA11y: 'Anpassung der Mahlzeiten rückgängig machen',
    undone: 'Rückgängig gemacht – deine bisherigen Gerichte sind wieder eingeplant.',
    undoFailed: 'Rückgängig ging nicht. Du kannst die Gerichte einzeln tauschen.',
    dismiss: 'Verstanden',
    suggestion: (role: 'pre' | 'post' | 'pre_snack' | null, better: string) =>
      role === 'post'
        ? `Für nach dem Training wäre ${better} besser – tauschen?`
        : `Für vor dem Training wäre ${better} besser – tauschen?`,
    suggestionSwap: 'Tauschen',
    suggestionSwapA11y: (better: string) => `Gegen ${better} tauschen`,
    suggestionDone: (title: string) => `Getauscht: ${title}.`,
    suggestionFailed: 'Tauschen ging nicht.',
  },
  // Erinnerung (lokal, Standard aus – Entscheidung 8)
  reminder: {
    label: 'Erinnerung vor dem Training',
    hint: 'Eine Stunde vor dem Snack-Fenster – nur auf diesem Gerät.',
    on: 'Erinnerung ist an.',
    unsupported: 'Erinnerungen gibt es nur in der App auf dem Handy.',
    denied: 'Benachrichtigungen sind in den Einstellungen deines Handys ausgeschaltet.',
    notificationTitle: 'In 1 Stunde: Snack vor dem Training',
  },
  loading: 'Zeitplan wird geladen …',
  error: 'Der Zeitplan ließ sich nicht berechnen.',
};
