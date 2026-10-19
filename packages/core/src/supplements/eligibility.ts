import { SUPPLEMENT_RULES } from '../constants';
import type { GoalType } from '../enums';
import { RATED_SUPPLEMENT_IDS, type RatedSupplementId } from '../supplement-ids';
import { APPROVED_CLAIMS, type ApprovedClaimId } from './claims';
import {
  hasSupplementConsent,
  isMinorForSupplements,
  supplementInputsSchema,
  supplementMonth,
  type SupplementInputs,
} from './inputs';
import type { SupplementNoticeKey } from './notices';

/**
 * Einordnung je Supplement (docs/PLAN-PHASE-6.md 3.2, 3.3, 3.5–3.7). Reine Regeln, keine KI, kein Netzwerk – und
 * OHNE Affiliate-Daten: Das Ergebnis entsteht vollständig, bevor irgendein Shop-Link existiert (Strukturtest).
 *
 * Grundsatz „strengste Regel gewinnt“: Jede Regel liefert einen Kandidaten (Status + Grund), gewählt wird der
 * strengste. Die Regeln prüfen bei JEDEM Aufruf die aktuellen Daten (wie `applyCurrentSafetyRules` im Trainingsplan) –
 * eine neue Schwangerschaft oder ein neues Medikament wirkt sofort.
 */

/** Status eines Supplements, von locker nach streng. */
export const SUPPLEMENT_STATUSES = ['recommended', 'info_only', 'adult_only', 'excluded'] as const;
export type SupplementStatus = (typeof SUPPLEMENT_STATUSES)[number];

/**
 * Koffein ist nie eine Empfehlung, nur eine neutrale Sicherheits-Info (B2.3). `safety_info_adult_only` = „ab 18“ wie bei
 * den anderen (Wächter K2: das Alter soll nicht wie ein Befund klingen).
 */
export const CAFFEINE_STATUSES = [
  'safety_info',
  'safety_info_adult_only',
  'safety_info_excluded',
] as const;
export type CaffeineStatus = (typeof CAFFEINE_STATUSES)[number];

/**
 * Inhalt der Koffein-Info (nur bei `safety_info`), von locker nach streng: persönliche Grenze mit Gewicht, allgemeine
 * Grenzen, nur der BfR-Hinweis für Schwangerschaft und Stillzeit.
 */
export const CAFFEINE_MODES = ['personal', 'general', 'pregnancy'] as const;
export type CaffeineMode = (typeof CAFFEINE_MODES)[number];

/** Evidenz-Stufen (Plan 3.1) – intern; die App zeigt sie ohne Zweck. Koffein hat keine Stufe. */
export const SUPPLEMENT_EVIDENCE: Readonly<Record<RatedSupplementId, 'a' | 'b' | 'c'>> = {
  creatine: 'a',
  protein_powder: 'a',
  vitamin_d: 'b',
  omega3: 'b',
};

/** Kategorien (Plan 3.2, 7.1; `diet_season` statt „Nährstofflücke“, Wächter K11). */
export const SUPPLEMENT_CATEGORIES = {
  creatine: 'sport',
  protein_powder: 'food',
  vitamin_d: 'diet_season',
  omega3: 'diet_season',
  caffeine: 'safety_info',
} as const;

/** Grund-Schlüssel (intern, für Tests und Erklärungen – der Bildschirm nennt nie den medizinischen Grund). */
export const SUPPLEMENT_REASONS = [
  'no_consent_v2',
  'no_health_screening',
  'no_supplement_screening',
  'under_18',
  'pregnancy',
  'breastfeeding',
  'medication',
  'medical_clearance',
  'kidney',
  'heart_rhythm',
  'caffeine_sensitive',
  'goal_not_matching',
  'eats_fish',
  'no_protein_data',
  'no_protein_gap',
  'no_nutrition_targets',
  'info_by_rule',
  'no_weight',
] as const;
export type SupplementReason = (typeof SUPPLEMENT_REASONS)[number];

export interface RatedSupplementResult {
  readonly id: RatedSupplementId;
  readonly status: SupplementStatus;
  /** Gründe des gewählten (strengsten) Status. Leer bei `recommended`. */
  readonly reasons: readonly SupplementReason[];
  readonly notices: readonly SupplementNoticeKey[];
  /** Zugelassene Angaben für die Detailseite (nur `recommended`/`info_only`). */
  readonly claimIds: readonly ApprovedClaimId[];
  /** Proteinpulver: `plant` = nur pflanzliche Variante im Text (vegan oder Milch-Unverträglichkeit). */
  readonly variant: 'plant' | null;
}

export interface CaffeineSafetyInfo {
  readonly id: 'caffeine';
  readonly status: CaffeineStatus;
  /** Nur bei `safety_info`, sonst `null`. */
  readonly mode: CaffeineMode | null;
  readonly reasons: readonly SupplementReason[];
  readonly notices: readonly SupplementNoticeKey[];
}

export interface SupplementRecommendations {
  /** true = Einwilligung v2, Gesundheits-Check und Supplement-Check liegen vor (persönliche Einordnung). */
  readonly personalized: boolean;
  /** In fester Reihenfolge RATED_SUPPLEMENT_IDS. */
  readonly items: readonly RatedSupplementResult[];
  readonly caffeine: CaffeineSafetyInfo;
  /** Hinweise für die ganze Seite (z. B. allgemeiner Arzt-Hinweis bei Herzrhythmus, K5). */
  readonly notices: readonly SupplementNoticeKey[];
}

interface Candidate<S> {
  readonly status: S;
  readonly reason: SupplementReason;
}

/** Rang eines Status (größer = strenger). */
export function supplementStatusRank(status: SupplementStatus): number {
  return SUPPLEMENT_STATUSES.indexOf(status);
}

type CaffeineLevel = CaffeineMode | 'adult_only' | 'excluded';
const CAFFEINE_LEVELS: readonly CaffeineLevel[] = [
  'personal',
  'general',
  'pregnancy',
  'adult_only',
  'excluded',
];

/** Rang der Koffein-Info (größer = strenger): persönlich < allgemein < Schwangerschaft < ab 18 < ärztlich abklären. */
export function caffeineRank(info: Pick<CaffeineSafetyInfo, 'status' | 'mode'>): number {
  const level: CaffeineLevel =
    info.status === 'safety_info_excluded'
      ? 'excluded'
      : info.status === 'safety_info_adult_only'
        ? 'adult_only'
        : (info.mode ?? 'general');
  return CAFFEINE_LEVELS.indexOf(level);
}

function strictest<S>(
  candidates: readonly Candidate<S>[],
  rank: (status: S) => number,
): { status: S; reasons: SupplementReason[] } {
  const top = Math.max(...candidates.map((candidate) => rank(candidate.status)));
  const winners = candidates.filter((candidate) => rank(candidate.status) === top);
  const reasons = [...new Set(winners.map((candidate) => candidate.reason))];
  return { status: winners[0]!.status, reasons };
}

interface Context {
  readonly inputs: SupplementInputs;
  readonly minor: boolean;
  readonly personal: boolean;
  /** Persönliche Basis-Gründe, warum nur Info (Einwilligung/Checks fehlen). */
  readonly missing: readonly SupplementReason[];
  readonly flags: ReadonlySet<SupplementReason>;
}

function buildContext(inputs: SupplementInputs): Context {
  const missing: SupplementReason[] = [];
  if (!hasSupplementConsent(inputs.healthConsentVersion)) missing.push('no_consent_v2');
  if (inputs.healthFlags === null) missing.push('no_health_screening');
  if (inputs.supplementFlags === null) missing.push('no_supplement_screening');
  const personal = missing.length === 0;
  const flags = new Set<SupplementReason>();
  if (personal) {
    const health = new Set(inputs.healthFlags ?? []);
    const supplement = new Set(inputs.supplementFlags ?? []);
    if (health.has('pregnancy')) flags.add('pregnancy');
    if (health.has('medication')) flags.add('medication');
    if (health.has('medical_clearance_recommended')) flags.add('medical_clearance');
    if (supplement.has('breastfeeding')) flags.add('breastfeeding');
    if (supplement.has('kidney')) flags.add('kidney');
    if (supplement.has('heart_rhythm')) flags.add('heart_rhythm');
    if (supplement.has('caffeine_sensitive')) flags.add('caffeine_sensitive');
  }
  return { inputs, minor: isMinorForSupplements(inputs), personal, missing, flags };
}

/**
 * Tabelle 3.3: Wirkung jedes Flags je Supplement. `excluded` = „Nicht für dich – bitte ärztlich abklären“,
 * `info_only` = nur allgemeine Seite. Fehlt ein Flag in der Zeile, ist es für dieses Supplement „erlaubt“.
 */
const FLAG_RULES: Readonly<
  Record<RatedSupplementId, Partial<Record<SupplementReason, SupplementStatus>>>
> = {
  creatine: {
    pregnancy: 'excluded',
    breastfeeding: 'excluded',
    medication: 'excluded',
    medical_clearance: 'excluded',
    kidney: 'excluded',
  },
  protein_powder: {
    pregnancy: 'excluded',
    breastfeeding: 'excluded',
    kidney: 'excluded',
  },
  vitamin_d: {
    pregnancy: 'excluded',
    breastfeeding: 'excluded',
    medication: 'excluded',
    kidney: 'excluded',
    medical_clearance: 'info_only',
    heart_rhythm: 'info_only',
  },
  omega3: {
    pregnancy: 'excluded',
    breastfeeding: 'excluded',
    medication: 'excluded',
    medical_clearance: 'info_only',
    heart_rhythm: 'info_only',
  },
};

/** Unter 18 (Tabelle 3.3): Kreatin „ab 18“, alles andere nur Info. */
const MINOR_STATUS: Readonly<Record<RatedSupplementId, SupplementStatus>> = {
  creatine: 'adult_only',
  protein_powder: 'info_only',
  vitamin_d: 'info_only',
  omega3: 'info_only',
};

function goalFitsCreatine(inputs: SupplementInputs): boolean {
  const goals: readonly GoalType[] = SUPPLEMENT_RULES.creatine.goals;
  const chosen = [inputs.goalType, inputs.secondaryGoalType].filter(
    (goal): goal is GoalType => goal !== null,
  );
  if (chosen.some((goal) => goals.includes(goal))) return true;
  if (chosen.includes('endurance')) {
    return !SUPPLEMENT_RULES.creatine.enduranceGoalNeedsIntervals || inputs.hasIntervalSessions;
  }
  return false;
}

function avoidsFish(inputs: SupplementInputs): boolean {
  return inputs.dietType !== 'omnivore' || inputs.avoidsFish;
}

/** Bedingung für „passt zu dir“ je Supplement (nur, wenn keine Sperre greift). */
function positiveCondition(id: RatedSupplementId, context: Context): Candidate<SupplementStatus> {
  const { inputs } = context;
  switch (id) {
    case 'creatine':
      return goalFitsCreatine(inputs)
        ? { status: 'recommended', reason: 'goal_not_matching' }
        : { status: 'info_only', reason: 'goal_not_matching' };
    case 'protein_powder':
      if (!inputs.hasNutritionTargets)
        return { status: 'info_only', reason: 'no_nutrition_targets' };
      if (inputs.proteinGap === null) return { status: 'info_only', reason: 'no_protein_data' };
      return inputs.proteinGap
        ? { status: 'recommended', reason: 'no_protein_gap' }
        : { status: 'info_only', reason: 'no_protein_gap' };
    case 'vitamin_d':
      // Nie „passt“ – nur Info mit allgemeinem Richtwert (SU-G15, Wächter S5).
      return { status: 'info_only', reason: 'info_by_rule' };
    case 'omega3':
      return avoidsFish(inputs)
        ? { status: 'recommended', reason: 'eats_fish' }
        : { status: 'info_only', reason: 'eats_fish' };
  }
}

const HEART_REASONS: readonly SupplementReason[] = ['medical_clearance', 'heart_rhythm'];

function rateSupplement(id: RatedSupplementId, context: Context): RatedSupplementResult {
  const { inputs } = context;
  const candidates: Candidate<SupplementStatus>[] = [];
  if (context.minor) candidates.push({ status: MINOR_STATUS[id], reason: 'under_18' });
  if (!context.personal) {
    for (const reason of context.missing) candidates.push({ status: 'info_only', reason });
  } else {
    for (const flag of context.flags) {
      const status = FLAG_RULES[id][flag];
      if (status) candidates.push({ status, reason: flag });
    }
    candidates.push(positiveCondition(id, context));
  }
  const chosen = strictest(candidates, supplementStatusRank);
  const status = chosen.status;
  const reasons = status === 'recommended' ? [] : chosen.reasons;

  const notices: SupplementNoticeKey[] = [];
  let claimIds: ApprovedClaimId[] = [];
  let variant: 'plant' | null = null;
  if (status === 'excluded') {
    notices.push('excluded_doctor', 'excluded_reason');
  } else if (status === 'adult_only') {
    notices.push('adult_only');
  } else {
    // Herz-Angabe nur bei persönlicher Einordnung OHNE Herz-Flag (Wächter S6): Ohne Einwilligung/Checks wissen wir
    // nicht, ob ein Herz-Flag vorliegt – dann bleibt die Angabe weg (Wächter SU1, Befund 4).
    const heartFlag =
      !context.personal || HEART_REASONS.some((reason) => context.flags.has(reason));
    claimIds = APPROVED_CLAIMS.filter(
      (claim) => claim.supplementId === id && !(claim.hiddenWithHeartFlags && heartFlag),
    ).map((claim) => claim.id);
    const doping = inputs.experienceLevel === 'competitive' || inputs.hasCompetition;
    switch (id) {
      case 'creatine':
        if (status === 'recommended') notices.push('creatine_every_day');
        notices.push('creatine_water', 'creatine_drink');
        if (doping) notices.push('doping');
        break;
      case 'protein_powder':
        if (status === 'recommended' && (inputs.dietType === 'vegan' || inputs.avoidsDairy)) {
          variant = 'plant';
          notices.push('protein_plant_variant');
        }
        notices.push('protein_counts_as_meal');
        if (doping) notices.push('doping');
        break;
      case 'vitamin_d':
        notices.push('vitamin_d_blood_test');
        if (
          (SUPPLEMENT_RULES.vitaminD.lowSunMonths as readonly number[]).includes(
            supplementMonth(inputs),
          )
        ) {
          notices.push('vitamin_d_low_sun');
        }
        break;
      case 'omega3':
        if (avoidsFish(inputs)) notices.push('omega3_algae');
        break;
    }
  }
  return { id, status, reasons, notices, claimIds, variant };
}

const CAFFEINE_EXCLUDING: readonly SupplementReason[] = [
  'medication',
  'medical_clearance',
  'heart_rhythm',
  'caffeine_sensitive',
];

function rateCaffeine(context: Context): CaffeineSafetyInfo {
  const { inputs } = context;
  const candidates: Candidate<CaffeineLevel>[] = [];
  if (context.minor) candidates.push({ status: 'adult_only', reason: 'under_18' });
  if (!context.personal) {
    for (const reason of context.missing) candidates.push({ status: 'general', reason });
  } else {
    for (const flag of context.flags) {
      if (CAFFEINE_EXCLUDING.includes(flag)) candidates.push({ status: 'excluded', reason: flag });
      if (flag === 'pregnancy' || flag === 'breastfeeding') {
        candidates.push({ status: 'pregnancy', reason: flag });
      }
      if (flag === 'kidney') candidates.push({ status: 'general', reason: flag });
    }
    candidates.push(
      inputs.weightKg === null
        ? { status: 'general', reason: 'no_weight' }
        : { status: 'personal', reason: 'no_weight' },
    );
  }
  const chosen = strictest(candidates, (level) => CAFFEINE_LEVELS.indexOf(level));
  const level = chosen.status;
  const reasons = level === 'personal' ? [] : chosen.reasons;

  const notices: SupplementNoticeKey[] = [];
  let status: CaffeineStatus = 'safety_info';
  let mode: CaffeineMode | null = null;
  switch (level) {
    case 'excluded':
      status = 'safety_info_excluded';
      notices.push('caffeine_excluded');
      break;
    case 'adult_only':
      status = 'safety_info_adult_only';
      notices.push('adult_only');
      // Minderjährig UND schwanger/stillend: der BfR-Hinweis bleibt sichtbar (Wächter SU1, Befund 1).
      if (context.flags.has('pregnancy') || context.flags.has('breastfeeding')) {
        notices.push('caffeine_pregnancy');
      }
      break;
    case 'pregnancy':
      mode = 'pregnancy';
      notices.push('caffeine_pregnancy');
      break;
    case 'general':
    case 'personal': {
      mode = level;
      notices.push(level === 'personal' ? 'caffeine_single_personal' : 'caffeine_single_general');
      notices.push('caffeine_daily');
      const time = inputs.trainingTime;
      if (time === 'evening') notices.push('caffeine_not_evening');
      else if (time === 'afternoon' || time === 'varies' || time === null) {
        notices.push('caffeine_before_cutoff');
      }
      notices.push('caffeine_test_new');
      break;
    }
  }
  return { id: 'caffeine', status, mode, reasons, notices };
}

/**
 * Einordnung aller Supplemente für eine Person. Ohne Einwilligung `health_data` v2, Gesundheits-Check oder
 * Supplement-Check: alles nur Info (Koffein allgemein), Alter gilt trotzdem. Eingaben werden mit Zod geprüft.
 */
export function recommendSupplements(rawInputs: SupplementInputs): SupplementRecommendations {
  const inputs = supplementInputsSchema.parse(rawInputs);
  const context = buildContext(inputs);
  const notices: SupplementNoticeKey[] = [];
  if (context.flags.has('heart_rhythm')) notices.push('medical_check');
  if (context.flags.has('pregnancy') || context.flags.has('breastfeeding')) {
    notices.push('pregnancy_midwife');
  }
  return {
    personalized: context.personal,
    items: RATED_SUPPLEMENT_IDS.map((id) => rateSupplement(id, context)),
    caffeine: rateCaffeine(context),
    notices,
  };
}

/** Ergebnis für ein Supplement (Ausnahme, wenn die ID fehlt – kann bei RATED_SUPPLEMENT_IDS nicht passieren). */
export function supplementResult(
  recommendations: SupplementRecommendations,
  id: RatedSupplementId,
): RatedSupplementResult {
  const item = recommendations.items.find((entry) => entry.id === id);
  if (!item) throw new Error(`Supplement fehlt: ${id}`);
  return item;
}
