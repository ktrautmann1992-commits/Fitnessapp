/**
 * Beispiel-Empfehlungen für die CI-Zusammenfassung (docs/PLAN-PHASE-6.md Abschnitt 5, Etappe SU1): Für zehn
 * AUSGEDACHTE Test-Personen zeigt die Tabelle die Einordnung der Supplement-Engine (passt / Info / ab 18 / nicht für
 * dich), Dosis und die Koffein-Sicherheits-Info – so ist SU1 am Handy sichtbar (GitHub-App → Pull Request → Checks →
 * ci → Summary), bevor die App sie zeigt. Feste Daten (nicht „heute“), keine echten Nutzerdaten, keine Shop-Links.
 */
import {
  caffeinePersonalDailyLimitMg,
  caffeinePersonalLimitMg,
  formatSupplementDose,
  RATED_SUPPLEMENT_IDS,
  recommendSupplements,
  renderSupplementNotice,
  type CaffeineSafetyInfo,
  type RatedSupplementResult,
  type SupplementInputs,
  supplementDose,
} from '@fitnessapp/core';

const TODAY = '2026-10-19';

function person(overrides: Partial<SupplementInputs>): SupplementInputs {
  return {
    birthDate: '1996-05-01',
    today: TODAY,
    sex: 'female',
    healthConsentVersion: 2,
    healthFlags: [],
    supplementFlags: [],
    weightKg: 70,
    goalType: 'muscle_gain',
    secondaryGoalType: null,
    experienceLevel: 'advanced',
    hasIntervalSessions: false,
    dietType: 'omnivore',
    avoidsFish: false,
    avoidsDairy: false,
    trainingTime: 'morning',
    proteinGap: null,
    hasNutritionTargets: true,
    hasCompetition: false,
    ...overrides,
  };
}

interface ExamplePerson {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly inputs: SupplementInputs;
}

export const SUPPLEMENT_EXAMPLE_PERSONS: readonly ExamplePerson[] = [
  {
    key: 'anna',
    name: 'Anna',
    description: '30 J., Muskelaufbau, morgens, Mischkost, alle Checks „nein“',
    inputs: person({}),
  },
  {
    key: 'ben',
    name: 'Ben',
    description: '17 J., Muskelaufbau, vegan, Eiweiß-Lücke',
    inputs: person({
      sex: 'male',
      birthDate: '2009-03-01',
      weightKg: 62,
      dietType: 'vegan',
      proteinGap: true,
    }),
  },
  {
    key: 'clara',
    name: 'Clara',
    description: '32 J., schwanger (Gesundheits-Check), vegetarisch',
    inputs: person({
      birthDate: '1994-02-10',
      healthFlags: ['pregnancy', 'conservative_plan'],
      dietType: 'vegetarian',
      hasNutritionTargets: false,
    }),
  },
  {
    key: 'david',
    name: 'David',
    description: '45 J., Medikamente, Fettabbau, Eiweiß-Lücke laut Tagebuch',
    inputs: person({
      sex: 'male',
      birthDate: '1981-07-01',
      weightKg: 95,
      healthFlags: ['medication', 'conservative_plan'],
      goalType: 'fat_loss',
      proteinGap: true,
    }),
  },
  {
    key: 'emma',
    name: 'Emma',
    description: '28 J., vegan, Eiweiß-Lücke, trainiert abends, 40 kg',
    inputs: person({
      birthDate: '1998-01-20',
      weightKg: 40,
      dietType: 'vegan',
      proteinGap: true,
      trainingTime: 'evening',
    }),
  },
  {
    key: 'felix',
    name: 'Felix',
    description: '35 J., Leistungssport Ausdauer mit Intervallen, Wettkampf, nachmittags, 150 kg',
    inputs: person({
      sex: 'male',
      birthDate: '1991-04-04',
      weightKg: 150,
      goalType: 'endurance',
      experienceLevel: 'competitive',
      hasIntervalSessions: true,
      hasCompetition: true,
      trainingTime: 'afternoon',
    }),
  },
  {
    key: 'greta',
    name: 'Greta',
    description: '40 J., Nieren (Supplement-Check), isst keinen Fisch',
    inputs: person({ birthDate: '1986-09-09', supplementFlags: ['kidney'], avoidsFish: true }),
  },
  {
    key: 'hannes',
    name: 'Hannes',
    description: '50 J., Herzrhythmus (Supplement-Check), vegetarisch, Zeit unterschiedlich',
    inputs: person({
      sex: 'male',
      birthDate: '1976-06-06',
      weightKg: 82,
      supplementFlags: ['heart_rhythm'],
      dietType: 'vegetarian',
      trainingTime: 'varies',
    }),
  },
  {
    key: 'ilse',
    name: 'Ilse',
    description: '68 J., Einwilligung nur Fassung 1 (noch nicht erneut zugestimmt)',
    inputs: person({
      birthDate: '1958-03-03',
      healthConsentVersion: 1,
      healthFlags: null,
      supplementFlags: null,
      weightKg: null,
      proteinGap: null,
    }),
  },
  {
    key: 'jonas',
    name: 'Jonas',
    description: '25 J., Koffein-empfindlich, Milch-Unverträglichkeit, Eiweiß-Lücke, ohne Gewicht',
    inputs: person({
      sex: 'male',
      birthDate: '2001-08-08',
      weightKg: null,
      supplementFlags: ['caffeine_sensitive'],
      avoidsDairy: true,
      proteinGap: true,
    }),
  },
];

const STATUS_DE: Readonly<Record<RatedSupplementResult['status'], string>> = {
  recommended: '**passt**',
  info_only: 'Info',
  adult_only: 'ab 18',
  excluded: 'nicht für dich',
};

const NAMES_DE: Readonly<Record<RatedSupplementResult['id'], string>> = {
  creatine: 'Kreatin',
  protein_powder: 'Proteinpulver',
  vitamin_d: 'Vitamin D',
  omega3: 'Omega-3',
};

function itemCell(item: RatedSupplementResult): string {
  const dose = supplementDose(item);
  const parts = [STATUS_DE[item.status]];
  if (dose) parts.push(`${formatSupplementDose(dose)}${dose.general ? ' (Richtwert)' : ''}`);
  if (item.variant === 'plant') parts.push('pflanzlich');
  if (item.notices.includes('doping')) parts.push('Doping-Hinweis');
  return parts.join(', ');
}

function caffeineCell(info: CaffeineSafetyInfo, weightKg: number | null): string {
  if (info.status === 'safety_info_excluded') return 'ärztlich abklären';
  if (info.status === 'safety_info_adult_only') return 'ab 18';
  if (info.mode === 'pregnancy') return 'nur BfR-Hinweis';
  const limit = caffeinePersonalLimitMg(info, weightKg);
  const daily = caffeinePersonalDailyLimitMg(info, weightKg);
  const parts = [
    limit === null || daily === null ? 'allgemein' : `≤ ${limit} mg/Einnahme, ≤ ${daily} mg/Tag`,
  ];
  if (info.notices.includes('caffeine_not_evening')) parts.push('abends nicht');
  if (info.notices.includes('caffeine_before_cutoff')) parts.push('nur vor 16 Uhr');
  return parts.join(', ');
}

/** Markdown-Abschnitt „Beispiel-Empfehlungen (Supplemente)“. */
export function renderSupplementExamples(): string {
  const lines: string[] = [
    '## Beispiel-Empfehlungen (Supplemente, Phase 6 SU1)',
    '',
    'Ausgedachte Test-Personen, Stichtag 19.10.2026. „passt“ mit persönlicher Dosis, „Info“ ohne Dosis (Vitamin D',
    'nur mit allgemeinem Richtwert), „ab 18“ und „nicht für dich“ ohne Dosis. Koffein ist nie eine Empfehlung, nur',
    'eine Sicherheits-Info. Keine Shop-Links (kommen erst mit SU5, getrennt von der Empfehlung).',
    '',
    `| Person | Angaben | ${RATED_SUPPLEMENT_IDS.map((id) => NAMES_DE[id]).join(' | ')} | Koffein-Info |`,
    `| --- | --- | ${RATED_SUPPLEMENT_IDS.map(() => '---').join(' | ')} | --- |`,
  ];
  const sentences: string[] = [];
  for (const example of SUPPLEMENT_EXAMPLE_PERSONS) {
    const result = recommendSupplements(example.inputs);
    const cells = result.items.map(itemCell);
    lines.push(
      `| ${example.name} | ${example.description} | ${cells.join(' | ')} | ${caffeineCell(result.caffeine, example.inputs.weightKg)} |`,
    );
    const pageNotices = result.notices.map((key) => renderSupplementNotice(key));
    if (pageNotices.length > 0) sentences.push(`- **${example.name}:** ${pageNotices.join(' ')}`);
  }
  lines.push('');
  if (sentences.length > 0) {
    lines.push('Hinweise oben auf der Seite:', '', ...sentences, '');
  }
  return `${lines.join('\n')}\n`;
}
