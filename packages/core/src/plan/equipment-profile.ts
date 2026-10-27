import type { Exercise } from '../content/schemas';
import type { EquipmentLocation, TrainingLocation } from '../enums';
import {
  BARBELL_DEFAULT_BAR_KG,
  BODYWEIGHT_PROFILE_RULES,
  HYROX_ONLY_EXERCISE_IDS,
} from '../constants';
import {
  BARBELL_ID,
  barbellLoadSteps,
  EQUIPMENT,
  findEquipment,
  GYM_OPTIONAL_EQUIPMENT_IDS,
  isOptionalAid,
  OTHER_EQUIPMENT_ID,
  withImpliedEquipment,
} from '../equipment';
import { isExerciseAllowed, type PlanSafetyRules } from './safety';

/**
 * Geräte-Profil und Übungs-Tausch (docs/PLAN-PHASE-3.md Abschnitt 5.5).
 */
export interface EquipmentProfile {
  /** Ort der Vorlagen-Suche: „beides“ = Studio (Frage 7). */
  readonly location: EquipmentLocation;
  /** Verfügbare Geräte-IDs. Körpergewichtsübungen (ohne Geräte) gehen immer. */
  readonly available: ReadonlySet<string>;
  /** Eigene Gewichtsstufen je Gerät (nur zu Hause bekannt). */
  readonly weights: ReadonlyMap<string, readonly number[]>;
  /**
   * Schlingentrainer zählt als Kraft-Gerät (docs/PLAN-CALISTHENICS-SCHLINGE.md 3): nur wenn die Bibliothek genug
   * nutzbare Schlingentrainer-Übungen hat (suspensionTrainerReady). Fehlt das Feld → wie bisher kein Kraft-Gerät.
   */
  readonly suspensionReady?: boolean;
}

/** Optionen von equipmentProfile. */
export interface EquipmentProfileOptions {
  /** suspensionTrainerReady(Bibliothek) – siehe EquipmentProfile.suspensionReady. */
  readonly suspensionReady?: boolean;
  /**
   * Sportarten Stufe 1 · Restpunkte: „Hyrox-Geräte im Studio“ (GYM_OPTIONAL_EQUIPMENT_IDS) – nur dann gehören Schlitten,
   * Ski-Ergometer, Sandsack und Wall Ball zum Studio. Fehlt → wie bisher ohne diese Geräte.
   */
  readonly gymHyroxEquipment?: boolean;
}

/** Orte, die es nur draußen gibt (nie Teil des Studios). */
const OUTDOOR_ONLY_EQUIPMENT: readonly string[] = ['calisthenics_park'];

/** Ein Gerät zu Hause, wie in den Angaben (barKg nur bei der Langhantel). */
export interface HomeEquipmentForProfile {
  readonly equipmentId: string;
  readonly weightsKg: readonly number[];
  readonly barKg?: number | null;
}

/**
 * Bekannte Gewichtsstufen je Gerät. Langhantel: die eingetragenen Werte sind SCHEIBEN je Paar – die Stufen sind
 * die ladbaren GESAMTgewichte barbellLoadSteps(Stange, Scheiben) (Erweiterungsplan 4.3, B3-Pflichtpunkt), ohne
 * Stangen-Angabe mit BARBELL_DEFAULT_BAR_KG. Ohne eingetragene Scheiben bleibt die Liste leer (unbekannt →
 * snapToAvailableWeight rundet auf 0,5 kg). Kurzhanteln/Kettlebells: je Hantel bzw. Kugel.
 */
export function equipmentWeightSteps(
  homeEquipment: readonly HomeEquipmentForProfile[],
): Map<string, readonly number[]> {
  return new Map(
    homeEquipment.map((item) => {
      const sorted = [...item.weightsKg].sort((a, b) => a - b);
      if (item.equipmentId === BARBELL_ID && sorted.length > 0) {
        return [item.equipmentId, barbellLoadSteps(item.barKg ?? BARBELL_DEFAULT_BAR_KG, sorted)];
      }
      return [item.equipmentId, sorted] as const;
    }),
  );
}

/**
 * Studio = alle Katalog-Geräte außer „Sonstiges“, dem Calisthenics-Park und den Hyrox-Geräten (nur mit
 * `gymHyroxEquipment`, Sportarten Stufe 1 · Restpunkte) (Annahme bis Phase 9b); Zuhause = eigene
 * Heim-Geräte inklusive der mitgebrachten (EQUIPMENT_IMPLIES: Park → Klimmzugstange + Barren);
 * „beides“ = Studio, Gewichtsstufen der Heim-Geräte bleiben bekannt.
 */
export function equipmentProfile(
  trainingLocation: TrainingLocation | EquipmentLocation,
  homeEquipment: readonly HomeEquipmentForProfile[],
  options: EquipmentProfileOptions = {},
): EquipmentProfile {
  const weights = equipmentWeightSteps(homeEquipment);
  const ready = options.suspensionReady === true ? { suspensionReady: true } : {};
  if (trainingLocation === 'home') {
    return {
      location: 'home',
      available: new Set(
        withImpliedEquipment(homeEquipment.map((item) => item.equipmentId)).filter(
          (id) => id !== OTHER_EQUIPMENT_ID,
        ),
      ),
      weights,
      ...ready,
    };
  }
  const hyroxAtGym = options.gymHyroxEquipment === true;
  return {
    location: 'gym',
    available: new Set(
      EQUIPMENT.map((item) => item.id).filter(
        (id) =>
          id !== OTHER_EQUIPMENT_ID &&
          !OUTDOOR_ONLY_EQUIPMENT.includes(id) &&
          (hyroxAtGym || !GYM_OPTIONAL_EQUIPMENT_IDS.includes(id)),
      ),
    ),
    weights,
    ...ready,
  };
}

/**
 * Zählt ein Gerät als KRAFT-Gerät (docs/PLAN-KOERPERGEWICHT.md §5.1, A6/W2)? Ja bei freien Gewichten, Bändern und
 * Maschinen; nein bei Ausdauer-Geräten, Bänken, Klimmzugstange und Dip-Station. Unbekannte IDs zählen vorsichtshalber
 * als Kraft-Gerät.
 */
export function isStrengthEquipment(equipmentId: string): boolean {
  const item = findEquipment(equipmentId);
  if (!item) return true;
  const strength: readonly string[] = BODYWEIGHT_PROFILE_RULES.strengthEquipmentCategories;
  return strength.includes(item.category);
}

/** Schlingentrainer (Geräte-ID). */
export const SUSPENSION_TRAINER_ID = 'suspension_trainer';

/**
 * Kraft-Gerät in DIESEM Profil: isStrengthEquipment, dazu der Schlingentrainer, sobald die Bibliothek genug
 * Schlingentrainer-Übungen hat (`suspensionReady`, docs/PLAN-CALISTHENICS-SCHLINGE.md 3).
 */
export function isStrengthEquipmentIn(
  equipmentId: string,
  profile: Pick<EquipmentProfile, 'suspensionReady'>,
): boolean {
  return (
    isStrengthEquipment(equipmentId) ||
    (equipmentId === SUSPENSION_TRAINER_ID && profile.suspensionReady === true)
  );
}

/**
 * Körpergewicht-Profil (§5.1): Zuhause und KEINE Kraft-Geräte (isStrengthEquipmentIn). Studio („beides“ eingeschlossen) ist nie ein Körpergewicht-Profil.
 */
export function isBodyweightOnly(
  profile: Pick<EquipmentProfile, 'location' | 'available' | 'suspensionReady'>,
): boolean {
  return (
    profile.location === 'home' &&
    ![...profile.available].some((id) => isStrengthEquipmentIn(id, profile))
  );
}

/**
 * „Nur Schlingentrainer“-Profil (docs/PLAN-CALISTHENICS-SCHLINGE.md 3.4): Zuhause, Schlingentrainer bereit und kein
 * anderes Kraft-Gerät. Nur dann kommen die Schlingentrainer-Vorlagen in Frage – wer zusätzlich Kurzhanteln oder Bänder
 * hat, behält die Zuhause-Vorlage und bekommt Schlingentrainer-Übungen über den Tausch (gemischt).
 */
export function isSuspensionOnly(
  profile: Pick<EquipmentProfile, 'location' | 'available' | 'suspensionReady'>,
): boolean {
  return (
    profile.location === 'home' &&
    profile.suspensionReady === true &&
    profile.available.has(SUSPENSION_TRAINER_ID) &&
    ![...profile.available].some(isStrengthEquipment)
  );
}

/** Sind alle nötigen Geräte da? Ersetzbare Hilfsmittel (Matte, Block – OPTIONAL_AID_EQUIPMENT) fehlen nie. */
export function isExerciseFeasible(
  exercise: Pick<Exercise, 'equipment_ids'>,
  profile: Pick<EquipmentProfile, 'available'>,
): boolean {
  return exercise.equipment_ids.every((id) => isOptionalAid(id) || profile.available.has(id));
}

/** Schritt, über den der Ersatz gefunden wurde (1 = Übung selbst). */
export type SubstituteStep = 1 | 2 | 3 | 4 | 5;

export interface Substitute {
  readonly exercise: Exercise;
  readonly step: SubstituteStep;
  /** Grund für den Tausch: fehlendes Gerät (gespeicherter Hinweis-Code) oder Sicherheitsregel (nie gespeichert). */
  readonly reason: 'equipment' | 'safety' | null;
}

export interface SubstituteContext {
  readonly library: ReadonlyMap<string, Exercise>;
  readonly profile: Pick<EquipmentProfile, 'available'>;
  readonly rules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious'>;
  /** IDs, die nicht (noch einmal) eingesetzt werden dürfen – z. B. schon in der Einheit vorhandene Übungen. */
  readonly exclude?: ReadonlySet<string>;
  /**
   * Zusätzliche Sperre (Schmerz-/Verletzungsmodus, docs/PLAN-TRAINING-MODI.md 3): gesperrte Übungen gelten wie
   * nicht erlaubte (Grund `safety`) und kommen nie als Ersatz. Weggelassen → unverändert.
   */
  readonly blocked?: (exercise: Exercise) => boolean;
}

const compareIds = (a: Exercise, b: Exercise) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Schlingentrainer-Übungen der Bibliothek, die `original` als Alternative nennen (Rückwärts-Verknüpfung,
 * docs/PLAN-CALISTHENICS-SCHLINGE.md 3.2) – nur, wenn der Schlingentrainer im Profil ist; sortiert nach der Priorität
 * dieser Verknüpfung, dann ID. Leer ohne Schlingentrainer (bisheriges Verhalten unverändert).
 */
export function suspensionLinksTo(
  original: Pick<Exercise, 'id'>,
  library: ReadonlyMap<string, Exercise>,
  profile: Pick<EquipmentProfile, 'available'> | null,
): Exercise[] {
  if (!profile?.available.has(SUSPENSION_TRAINER_ID)) return [];
  const linked: { exercise: Exercise; priority: number }[] = [];
  for (const candidate of library.values()) {
    if (!candidate.equipment_ids.includes(SUSPENSION_TRAINER_ID)) continue;
    const link = candidate.alternatives.find((alt) => alt.alternative_id === original.id);
    if (link) linked.push({ exercise: candidate, priority: link.priority });
  }
  return linked
    .sort((a, b) => a.priority - b.priority || compareIds(a.exercise, b.exercise))
    .map((item) => item.exercise);
}

function sharesPrimaryMuscle(a: Exercise, b: Exercise): boolean {
  return a.primary_muscles.some((m) => b.primary_muscles.includes(m));
}

/**
 * Sucht für eine Übung einen machbaren und erlaubten Ersatz (Schritte 1–6 aus Abschnitt 5.5):
 * 1. Übung selbst · 2. Alternativen (bei Vorsicht `easier` zuerst) · 3. Alternativen der Alternativen ·
 * 4. gleiches Bewegungsmuster + gemeinsamer Hauptmuskel · 5. gemeinsamer Hauptmuskel · 6. null = entfällt.
 * Jeder Ersatz muss die Sicherheitsregeln bestehen, darf nicht schwerer sein (`difficulty`) und tauscht nie
 * Wiederholungs- gegen Halteübung.
 */
export function findSubstitute(original: Exercise, ctx: SubstituteContext): Substitute | null {
  const feasible = isExerciseFeasible(original, ctx.profile);
  const blocked = ctx.blocked ?? (() => false);
  const allowed = isExerciseAllowed(original, ctx.rules) && !blocked(original);
  if (feasible && allowed) {
    return { exercise: original, step: 1, reason: null };
  }
  const reason = feasible ? 'safety' : 'equipment';
  const isTime = original.load_type === 'time';
  const ok = (candidate: Exercise | undefined): candidate is Exercise =>
    candidate !== undefined &&
    candidate.id !== original.id &&
    !(ctx.exclude?.has(candidate.id) ?? false) &&
    (candidate.load_type === 'time') === isTime &&
    candidate.difficulty <= original.difficulty &&
    isExerciseFeasible(candidate, ctx.profile) &&
    isExerciseAllowed(candidate, ctx.rules) &&
    !blocked(candidate);

  const sortAlternatives = (alternatives: Exercise['alternatives']) =>
    [...alternatives].sort((a, b) => {
      if (ctx.rules.cautious) {
        const ea = a.reason === 'easier' ? 0 : 1;
        const eb = b.reason === 'easier' ? 0 : 1;
        if (ea !== eb) return ea - eb;
      }
      return a.priority - b.priority || (a.alternative_id < b.alternative_id ? -1 : 1);
    });

  // Schritt 2: Alternativen
  const firstLevel = sortAlternatives(original.alternatives);
  for (const alt of firstLevel) {
    const candidate = ctx.library.get(alt.alternative_id);
    if (ok(candidate)) {
      return { exercise: candidate, step: 2, reason };
    }
  }
  // Schritt 2b (docs/PLAN-CALISTHENICS-SCHLINGE.md 3.2): Schlingentrainer-Übungen, die diese Übung als Alternative
  // nennen – nur, wenn der Schlingentrainer am Ort ist. So bekommt, wer ihn hat, z. B. statt Kabelrudern das
  // Schlingentrainer-Rudern, ohne dass freigegebene Übungen geändert werden müssen.
  for (const candidate of suspensionLinksTo(original, ctx.library, ctx.profile)) {
    if (ok(candidate)) {
      return { exercise: candidate, step: 2, reason };
    }
  }
  // Schritt 3: Alternativen der Alternativen (eine Stufe tiefer)
  for (const alt of firstLevel) {
    const parent = ctx.library.get(alt.alternative_id);
    if (!parent) continue;
    for (const second of sortAlternatives(parent.alternatives)) {
      const candidate = ctx.library.get(second.alternative_id);
      if (ok(candidate)) {
        return { exercise: candidate, step: 3, reason };
      }
    }
  }
  // Schritte 4 und 5: Bibliothek
  const rank = (a: Exercise, b: Exercise) =>
    b.difficulty - a.difficulty ||
    Number(b.load_type === original.load_type) - Number(a.load_type === original.load_type) ||
    compareIds(a, b);
  // Sportarten Stufe 1: Hyrox-Übungen nur innerhalb von Hyrox (HYROX_ONLY_EXERCISE_IDS).
  const hyroxOnly = (c: Exercise) =>
    HYROX_ONLY_EXERCISE_IDS.includes(c.id) && !HYROX_ONLY_EXERCISE_IDS.includes(original.id);
  const pool = [...ctx.library.values()]
    .filter(ok)
    .filter((c) => !hyroxOnly(c) && sharesPrimaryMuscle(c, original));
  const samePattern = pool
    .filter((c) => c.movement_pattern === original.movement_pattern)
    .sort(rank);
  if (samePattern[0]) {
    return { exercise: samePattern[0], step: 4, reason };
  }
  // Schritt 5 nie auf eine Beweglichkeitsübung (Dehnung) – sie ersetzt keine Kraftübung (docs/PLAN-TRAINING-MODI.md 5).
  const anyPattern = pool
    .filter((c) => c.movement_pattern !== 'mobility' || original.movement_pattern === 'mobility')
    .sort(rank);
  if (anyPattern[0]) {
    return { exercise: anyPattern[0], step: 5, reason };
  }
  return null;
}

/**
 * Schwerere Variante für die Progression (Körpergewicht/Halteübung, Abschnitt 5.9): Alternative mit Grund
 * `harder`, machbar mit dem Geräte-Profil des Orts und erlaubt nach den AKTUELLEN Sicherheitsregeln (z. B. ab 65 kein
 * Tisch-Rudern, Merkmal `high_skill`); null = keine. Angebunden über progressHintForDisplay() (log/harder-variant.ts).
 * `exclude` (Wächter S2, Etappe T1): Ausschlüsse des Orts und Übungen der Einheit werden übersprungen – es kommt die
 * nächste erlaubte `harder`-Variante oder keine (z. B. ist die schwerere Variante des Ersatzes Y genau die
 * ausgeschlossene Übung A).
 */
export function findHarderVariant(
  exercise: Exercise,
  ctx: SubstituteContext & {
    /** Höchstens so viel schwerer (`difficulty`); weggelassen = beliebig (W8: Einsteiger nur +1). */
    readonly maxDifficultyStep?: number;
  },
): Exercise | null {
  const maxDifficulty = exercise.difficulty + (ctx.maxDifficultyStep ?? Number.POSITIVE_INFINITY);
  const candidates = exercise.alternatives
    .filter((alt) => alt.reason === 'harder')
    .sort((a, b) => a.priority - b.priority)
    .map((alt) => ctx.library.get(alt.alternative_id))
    .filter(
      (c): c is Exercise =>
        c !== undefined &&
        c.id !== exercise.id &&
        !(ctx.exclude?.has(c.id) ?? false) &&
        c.difficulty <= maxDifficulty &&
        isExerciseFeasible(c, ctx.profile) &&
        isExerciseAllowed(c, ctx.rules),
    );
  return candidates[0] ?? null;
}
