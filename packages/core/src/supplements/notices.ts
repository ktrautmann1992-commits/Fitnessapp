import { CAFFEINE_LIMITS, SUPPLEMENT_RULES } from '../constants';

/**
 * Feste Hinweise des Supplement-Moduls (docs/PLAN-PHASE-6.md 3.3, 3.5, 3.6, 3.7, 3.8). Die Engine liefert nur
 * Schlüssel; die Texte stehen hier mit Platzhaltern (`{dose}`, `{daily}` …), die `renderSupplementNotice` aus
 * `constants.ts` füllt – so laufen Text und Regel nie auseinander (Plan 3.8 Nr. 3: keine Zahlen im Freitext).
 * Alle Texte gehen durch `checkSupplementText` (Test). Gründe einer Sperre werden nie genannt (kein „wegen deiner
 * Nieren“), nur „deine Angaben im Gesundheits-Check“ (Plan 3.3).
 */

export const SUPPLEMENT_NOTICE_KEYS = [
  // Sperren und Alter (3.3)
  'excluded_doctor',
  'excluded_reason',
  'adult_only',
  'medical_check',
  'pregnancy_midwife',
  // Doping (3.6)
  'doping',
  // Kreatin (3.5)
  'creatine_water',
  'creatine_drink',
  'creatine_every_day',
  // Proteinpulver (3.7)
  'protein_counts_as_meal',
  'protein_plant_variant',
  // Vitamin D (3.5, SU-G15)
  'vitamin_d_blood_test',
  'vitamin_d_low_sun',
  // Omega-3 (3.2)
  'omega3_algae',
  // Koffein – neutrale Sicherheits-Info (3.5, B2.3)
  'caffeine_single_personal',
  'caffeine_single_general',
  'caffeine_daily',
  'caffeine_not_evening',
  'caffeine_before_cutoff',
  'caffeine_test_new',
  'caffeine_pregnancy',
  'caffeine_excluded',
] as const;
export type SupplementNoticeKey = (typeof SUPPLEMENT_NOTICE_KEYS)[number];

/** Platzhalter, die der Core füllt. Andere Platzhalter in Texten sind ein Fehler (Test, später SK5 für Inhalte). */
export const SUPPLEMENT_PLACEHOLDERS = [
  'dose',
  'daily',
  'cup',
  'cups',
  'gain',
  'time',
  'age',
] as const;
export type SupplementPlaceholder = (typeof SUPPLEMENT_PLACEHOLDERS)[number];

export const SUPPLEMENT_NOTICE_TEXTS_DE: Readonly<Record<SupplementNoticeKey, string>> = {
  excluded_doctor: 'Bei deinen Angaben empfehlen wir das nicht ohne ärztliche Rücksprache.',
  excluded_reason: 'Grund sind deine Angaben im Gesundheits-Check.',
  adult_only: 'Diese Ergänzung ist erst ab {age} Jahren gedacht.',
  medical_check: 'Bitte vor dem Start ärztlich abklären.',
  pregnancy_midwife:
    'In Schwangerschaft und Stillzeit entscheidet deine Ärztin, dein Arzt oder deine Hebamme, welche Ergänzungen du brauchst.',
  doping:
    'Nahrungsergänzungen können verunreinigt sein. Wenn du an Wettkämpfen mit Dopingkontrollen teilnimmst: Nutze nur Produkte, die auf Dopingsubstanzen geprüft sind (z. B. in der Kölner Liste), und informiere dich bei der NADA. Geprüft wird je Charge – ein Restrisiko bleibt.',
  creatine_water:
    'Dein Gewicht kann in den ersten Wochen um {gain} steigen. Das ist meist eingelagertes Wasser, kein Fett.',
  creatine_drink: 'Trinke wie gewohnt.',
  creatine_every_day: 'Nimm es jeden Tag, auch an Ruhetagen. Die Uhrzeit ist egal.',
  protein_counts_as_meal:
    'Ein Shake zählt wie eine Mahlzeit. Trag ihn ein, dann stimmt deine Übersicht.',
  protein_plant_variant:
    'Für dich passt eine pflanzliche Variante, zum Beispiel aus Erbse oder Reis.',
  vitamin_d_blood_test: 'Lass deine Blutwerte ärztlich prüfen.',
  vitamin_d_low_sun:
    'Von Oktober bis März reicht die Sonne bei uns oft nicht, damit dein Körper selbst genug Vitamin D bildet.',
  omega3_algae: 'Ohne Fisch gibt es EPA und DHA zum Beispiel aus Algenöl.',
  caffeine_single_personal: 'Höchstens {dose} Koffein auf einmal.',
  caffeine_single_general: 'Höchstens {cups} Tassen Kaffee auf einmal.',
  caffeine_daily:
    'Insgesamt höchstens {daily} am Tag – Kaffee, Tee, Cola und Energydrinks zählen mit. Eine Tasse Filterkaffee hat etwa {cup}.',
  caffeine_not_evening: 'Du trainierst abends: Nimm vor dem Training kein Koffein.',
  caffeine_before_cutoff: 'Koffein nur, wenn deine Einheit vor {time} liegt.',
  caffeine_test_new: 'Probiere nichts Neues an einem wichtigen Tag.',
  caffeine_pregnancy: 'In Schwangerschaft und Stillzeit höchstens {daily} Koffein am Tag.',
  caffeine_excluded: 'Bei deinen Angaben: Koffein vorher ärztlich abklären.',
};

/**
 * Pflichtsätze auf jeder Detailseite (Plan 3.8 Nr. 4, Art. 10 Abs. 2 VO (EG) 1924/2006 – juristisch prüfen, ob das
 * genügt). Feste App-Texte, nicht im Inhalt. Eigener Prüfweg: „gesunde Lebensweise“ ist der vorgeschriebene Wortlaut.
 */
export const SUPPLEMENT_MANDATORY_SENTENCES_DE = [
  'Nahrungsergänzungsmittel sind kein Ersatz für eine abwechslungsreiche, ausgewogene Ernährung und eine gesunde Lebensweise.',
  'Bei Vorerkrankungen, Medikamenten, in Schwangerschaft und Stillzeit vorher ärztlich abklären.',
] as const;

/** Zahl deutsch formatiert (Komma, ohne unnötige Nachkommastellen). */
export function formatGermanNumber(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

/** Uhrzeit aus Minuten nach Mitternacht, z. B. 960 → „16 Uhr“, 990 → „16:30 Uhr“. */
export function formatClockTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} Uhr` : `${hours}:${String(rest).padStart(2, '0')} Uhr`;
}

/** Feste Werte für die Platzhalter (außer `{dose}`, das je Person gerechnet wird). */
export function defaultPlaceholderValues(): Readonly<
  Record<Exclude<SupplementPlaceholder, 'dose'>, string>
> {
  const gain = SUPPLEMENT_RULES.creatine.weightGainKg;
  const cups = CAFFEINE_LIMITS.generalCups;
  return {
    gain: `${formatGermanNumber(gain.min)}–${formatGermanNumber(gain.max)} kg`,
    cups: `${formatGermanNumber(cups.min)}–${formatGermanNumber(cups.max)}`,
    daily: `${formatGermanNumber(CAFFEINE_LIMITS.dailyMaxMg)} mg`,
    cup: `${formatGermanNumber(CAFFEINE_LIMITS.cupFilterCoffeeMg)} mg`,
    time: formatClockTime(CAFFEINE_LIMITS.latestTrainingStartMinutes),
    age: formatGermanNumber(SUPPLEMENT_RULES.adultFromAge),
  };
}

/** Füllt die Platzhalter eines Textes; ein fehlender Wert ist ein Programmierfehler (Ausnahme). */
export function fillSupplementPlaceholders(
  template: string,
  values: Partial<Record<SupplementPlaceholder, string>>,
): string {
  return template.replace(/\{([a-z_]+)\}/g, (_match, name: string) => {
    const value = (values as Record<string, string | undefined>)[name];
    if (value === undefined) {
      throw new Error(`Platzhalter {${name}} ohne Wert.`);
    }
    return value;
  });
}

/**
 * Text eines Hinweises mit gefüllten Platzhaltern. `{dose}` kommt aus `values` (z. B. die persönliche Koffein-Grenze
 * aus `caffeineSingleLimit`), alle anderen aus `constants.ts`. `caffeine_pregnancy` nutzt als `{daily}` immer die
 * BfR-Grenze für Schwangerschaft und Stillzeit. Bei `caffeine_daily` ersetzt `values.daily` (persönliche Tagesgrenze
 * aus `caffeinePersonalDailyLimitMg`) die allgemeinen 400 mg – nur, wenn sie niedriger ist.
 */
export function renderSupplementNotice(
  key: SupplementNoticeKey,
  values: { readonly dose?: string; readonly dailyMg?: number } = {},
): string {
  const defaults = defaultPlaceholderValues();
  const daily =
    key === 'caffeine_pregnancy'
      ? `${formatGermanNumber(CAFFEINE_LIMITS.pregnancyDailyMaxMg)} mg`
      : values.dailyMg !== undefined && values.dailyMg < CAFFEINE_LIMITS.dailyMaxMg
        ? `${formatGermanNumber(values.dailyMg)} mg`
        : defaults.daily;
  return fillSupplementPlaceholders(SUPPLEMENT_NOTICE_TEXTS_DE[key], {
    ...defaults,
    daily,
    ...(values.dose === undefined ? {} : { dose: values.dose }),
  });
}
