import { ageInYears } from '../age';
import {
  AGE_PLAN_RULES,
  CONSERVATIVE_PLAN_RULES,
  ENDURANCE_EFFORT,
  PREGNANCY_EXCLUDED_CAUTION_TAGS,
  TEMPLATE_DOSAGE_LIMITS,
} from '../constants';
import { CAUTION_TAGS, type CautionTag, type ExperienceLevel } from '../enums';
import { type HealthFlag, requiresMedicalNotice } from '../health-screening';

/**
 * Sicherheitsregeln eines Plans (docs/PLAN-PHASE-3.md Abschnitt 5.4). Es gilt immer die STRENGSTE Regel.
 * Das Ergebnis ist JSON-serialisierbar, damit die App die wirksamen Regeln im Zwischenspeicher ablegen kann.
 */
export interface PlanSafetyRules {
  /** Höchstes RPE-Ziel (nie unter TEMPLATE_DOSAGE_LIMITS.rpe.min). */
  readonly rpeMax: number;
  /** Übungen mit diesen Merkmalen sind ausgeschlossen (sortiert wie CAUTION_TAGS). */
  readonly excludedCautionTags: readonly CautionTag[];
  /** Nur Einsteiger-Vorlagen (vorsichtiger Plan oder Einsteiger). */
  readonly beginnerTemplatesOnly: boolean;
  /** Vorsichtiger Plan (Flag oder kein Gesundheits-Check): beim Tausch leichtere Alternativen bevorzugen. */
  readonly cautious: boolean;
  /** Ein Gesundheits-Check geht in die Regeln ein (auch ohne Flag) → Plan gilt als Gesundheitsdatum. */
  readonly usesHealthData: boolean;
  /** Arzt-Hinweis vor jeder Einheit (jedes Gesundheits-Flag). */
  readonly medicalNotice: boolean;
  /** Hinweis „nicht für die Schwangerschaft entwickelt“ – nur zur Anzeige, wird nie gespeichert. */
  readonly pregnancyNotice: boolean;
  /** Kein Gesundheits-Check vorhanden – nur zur Anzeige. */
  readonly noHealthCheck: boolean;
  /** Höchste Anstrengung (0–10) einer Ausdauer-Einheit (Erweiterungsplan 5.6). */
  readonly enduranceEffortMax: number;
  /** Ausdauer nur als zügiges Gehen / Ergometer / lockeres Schwimmen (Flag, ab 65, Schwangerschaft). */
  readonly enduranceWalkOnly: boolean;
  /** Startgruppe für Umfang und Deckel der Ausdauer (ENDURANCE_START_RULES). */
  readonly enduranceStartGroup: EnduranceStartGroup;
}

/** Startgruppe Ausdauer: vorsichtig (Flag, ohne Check, Schwangerschaft, unter 18, ab 65) oder Level. */
export type EnduranceStartGroup = 'cautious' | ExperienceLevel;

/** Reihenfolge von streng nach locker (kleinerer Startumfang = strenger). */
const START_GROUP_ORDER: readonly EnduranceStartGroup[] = [
  'cautious',
  'beginner',
  'advanced',
  'competitive',
];

/** Ist `next` eine strengere Startgruppe als `previous`? */
export function isStricterGroup(next: EnduranceStartGroup, previous: EnduranceStartGroup): boolean {
  return START_GROUP_ORDER.indexOf(next) < START_GROUP_ORDER.indexOf(previous);
}

export interface SafetyInputs {
  readonly experienceLevel: ExperienceLevel;
  readonly birthDate: string;
  /** null = kein Gesundheits-Check vorhanden. */
  readonly healthScreening: { readonly flags: readonly HealthFlag[] } | null;
}

function sortTags(tags: Iterable<CautionTag>): CautionTag[] {
  const set = new Set(tags);
  return CAUTION_TAGS.filter((tag) => set.has(tag));
}

/** Wirksame Sicherheitsregeln zum Stichtag `onDate` (Alter wird zu diesem Datum berechnet). */
export function planSafetyRules(inputs: SafetyInputs, onDate: string): PlanSafetyRules {
  const flags = inputs.healthScreening?.flags ?? [];
  const noHealthCheck = inputs.healthScreening === null;
  const flagged = requiresMedicalNotice(flags);
  const cautious = noHealthCheck || flagged;
  const age = ageInYears(inputs.birthDate, onDate);

  let rpeMax: number = TEMPLATE_DOSAGE_LIMITS.rpe.max;
  const excluded = new Set<CautionTag>();
  if (inputs.experienceLevel === 'beginner') {
    rpeMax = Math.min(rpeMax, TEMPLATE_DOSAGE_LIMITS.beginnerRpeMax);
  }
  if (cautious) {
    rpeMax = Math.min(rpeMax, CONSERVATIVE_PLAN_RULES.rpeMax);
    CONSERVATIVE_PLAN_RULES.excludedCautionTags.forEach((tag) => excluded.add(tag));
    const overheadFlags: readonly string[] = CONSERVATIVE_PLAN_RULES.overheadFlags;
    if (noHealthCheck || flags.some((flag) => overheadFlags.includes(flag))) {
      excluded.add('overhead');
    }
  }
  if (flags.includes('pregnancy')) {
    PREGNANCY_EXCLUDED_CAUTION_TAGS.forEach((tag) => excluded.add(tag));
  }
  if (age < AGE_PLAN_RULES.minor.belowAge) {
    rpeMax = Math.min(rpeMax, AGE_PLAN_RULES.minor.rpeMax);
    AGE_PLAN_RULES.minor.excludedCautionTags.forEach((tag) => excluded.add(tag));
  }
  if (age >= AGE_PLAN_RULES.senior.fromAge) {
    rpeMax = Math.min(rpeMax, AGE_PLAN_RULES.senior.rpeMax);
    AGE_PLAN_RULES.senior.excludedCautionTags.forEach((tag) => excluded.add(tag));
  }
  const senior = age >= AGE_PLAN_RULES.senior.fromAge;
  const minor = age < AGE_PLAN_RULES.minor.belowAge;
  const pregnancy = flags.includes('pregnancy');
  let enduranceEffortMax: number = ENDURANCE_EFFORT.easyMax;
  if (minor) enduranceEffortMax = Math.min(enduranceEffortMax, ENDURANCE_EFFORT.minorMax);
  if (cautious || senior || pregnancy) {
    enduranceEffortMax = Math.min(enduranceEffortMax, ENDURANCE_EFFORT.cautiousMax);
  }
  return {
    rpeMax: Math.max(rpeMax, TEMPLATE_DOSAGE_LIMITS.rpe.min),
    excludedCautionTags: sortTags(excluded),
    beginnerTemplatesOnly:
      inputs.experienceLevel === 'beginner' ||
      (cautious && CONSERVATIVE_PLAN_RULES.beginnerTemplatesOnly),
    cautious,
    usesHealthData: !noHealthCheck,
    medicalNotice: !noHealthCheck && flagged,
    pregnancyNotice: pregnancy,
    noHealthCheck,
    enduranceEffortMax,
    enduranceWalkOnly: flagged || senior || pregnancy,
    enduranceStartGroup:
      cautious || senior || minor || pregnancy ? 'cautious' : inputs.experienceLevel,
  };
}

/** Ist die Übung nach diesen Regeln erlaubt (kein ausgeschlossenes Merkmal)? */
export function isExerciseAllowed(
  exercise: { readonly caution_tags: readonly CautionTag[] },
  rules: Pick<PlanSafetyRules, 'excludedCautionTags'>,
): boolean {
  return !exercise.caution_tags.some((tag) => rules.excludedCautionTags.includes(tag));
}

/**
 * true, wenn `next` in mindestens einem Punkt strenger ist als `previous` (niedrigerer RPE-Deckel, zusätzliches
 * ausgeschlossenes Merkmal, nur noch Einsteiger-Vorlagen, neuer Arzt-Hinweis). Strengere Regeln wirken sofort;
 * Lockerungen nur nach Bestätigung (Abschnitt 5.4).
 */
export function isStricter(next: PlanSafetyRules, previous: PlanSafetyRules): boolean {
  return (
    next.rpeMax < previous.rpeMax ||
    next.excludedCautionTags.some((tag) => !previous.excludedCautionTags.includes(tag)) ||
    (next.beginnerTemplatesOnly && !previous.beginnerTemplatesOnly) ||
    (next.medicalNotice && !previous.medicalNotice) ||
    next.enduranceEffortMax < previous.enduranceEffortMax ||
    (next.enduranceWalkOnly && !previous.enduranceWalkOnly) ||
    START_GROUP_ORDER.indexOf(next.enduranceStartGroup) <
      START_GROUP_ORDER.indexOf(previous.enduranceStartGroup)
  );
}

/**
 * Strengste Kombination zweier Regelsätze – für Anzeige und Folgeblock: strengere aktuelle Regeln wirken sofort,
 * gelockerte aktuelle Regeln ändern den laufenden Plan nicht.
 */
export function strictestRules(a: PlanSafetyRules, b: PlanSafetyRules): PlanSafetyRules {
  return {
    rpeMax: Math.min(a.rpeMax, b.rpeMax),
    excludedCautionTags: sortTags([...a.excludedCautionTags, ...b.excludedCautionTags]),
    beginnerTemplatesOnly: a.beginnerTemplatesOnly || b.beginnerTemplatesOnly,
    cautious: a.cautious || b.cautious,
    usesHealthData: a.usesHealthData || b.usesHealthData,
    medicalNotice: a.medicalNotice || b.medicalNotice,
    pregnancyNotice: a.pregnancyNotice || b.pregnancyNotice,
    noHealthCheck: a.noHealthCheck || b.noHealthCheck,
    enduranceEffortMax: Math.min(a.enduranceEffortMax, b.enduranceEffortMax),
    enduranceWalkOnly: a.enduranceWalkOnly || b.enduranceWalkOnly,
    enduranceStartGroup:
      START_GROUP_ORDER[
        Math.min(
          START_GROUP_ORDER.indexOf(a.enduranceStartGroup),
          START_GROUP_ORDER.indexOf(b.enduranceStartGroup),
        )
      ] ?? 'cautious',
  };
}
