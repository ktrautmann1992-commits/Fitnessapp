import type { SupplementContent } from '../content/supplement-schema';
import { RATED_SUPPLEMENT_IDS, type RatedSupplementId } from '../supplement-ids';
import { claimBlockText, type ClaimBlockText } from './claims';
import {
  caffeinePersonalDailyLimitMg,
  caffeinePersonalLimitMg,
  formatSupplementDose,
  supplementDose,
} from './dosage';
import type {
  CaffeineMode,
  CaffeineStatus,
  RatedSupplementResult,
  SupplementRecommendations,
  SupplementStatus,
} from './eligibility';
import {
  defaultPlaceholderValues,
  fillSupplementPlaceholders,
  renderSupplementNotice,
  SUPPLEMENT_MANDATORY_SENTENCES_DE,
  type SupplementNoticeKey,
} from './notices';
import { type SupplementTiming, supplementTiming } from './schedule';
import {
  activeSupplementChoices,
  canChooseSupplement,
  outdatedSupplementChoices,
  type SupplementUserData,
  userSupplementStatus,
  type UserSupplementStatus,
} from './user-data';

/**
 * Anzeige des Supplement-Bereichs (docs/PLAN-PHASE-6.md 8.1): verbindet die Einordnung (`recommendSupplements`) mit
 * den freigegebenen Texten (`content/supplements`). Reine Funktionen – die App zeigt nur an, was hier entsteht.
 *
 * - Gruppen in fester Reihenfolge: „Passt zu dir“, „Zur Info“, „Ab 18 Jahren“, „Nicht für dich – bitte ärztlich
 *   abklären“, dann Koffein (Sicherheits-Info, nie „passt“) und „Nicht empfohlen“ (Stufe C).
 * - Menge und Zeitpunkt nur, wo der Core eine Menge liefert (`supplementDose`: „passt“ bzw. Vitamin D als Richtwert).
 *   Ohne Menge entfällt auch die Anwendung aus dem Inhalt (sie enthält `{dose}`).
 * - Zugelassene Angaben nur zusammen mit dem Pflichthinweis (`claimBlockText`), nur wenn Inhalt UND Einordnung sie
 *   nennen (z. B. keine Herz-Angabe bei Herz-Flags).
 * - Gründe einer Sperre werden nie genannt (feste Sätze aus `notices.ts`).
 * - Kein Feld für Shops, Links oder Provisionen (Affiliate kommt getrennt mit SU5).
 */

export const SUPPLEMENT_GROUPS = ['recommended', 'info', 'adult_only', 'excluded'] as const;
export type SupplementGroup = (typeof SUPPLEMENT_GROUPS)[number];

const GROUP_OF_STATUS: Readonly<Record<SupplementStatus, SupplementGroup>> = {
  recommended: 'recommended',
  info_only: 'info',
  adult_only: 'adult_only',
  excluded: 'excluded',
};

export interface SupplementCard {
  readonly id: RatedSupplementId;
  readonly nameDe: string;
  readonly summaryDe: string;
  readonly evidence: 'a' | 'b' | 'c' | null;
  readonly status: SupplementStatus;
  /** Menge als Text („3 g“, „20 µg (800 IE)“), `null` = keine Menge. */
  readonly doseText: string | null;
  /** true = allgemeiner Richtwert (Vitamin D), keine persönliche Dosis. */
  readonly doseGeneral: boolean;
  readonly timing: SupplementTiming | null;
  /** false = Inhalt noch nicht fachlich geprüft (Testphase-Kennzeichen). */
  readonly expertReviewed: boolean;
  readonly choice: UserSupplementStatus | null;
}

export interface CaffeineCard {
  readonly nameDe: string;
  readonly summaryDe: string;
  readonly status: CaffeineStatus;
  readonly mode: CaffeineMode | null;
  readonly expertReviewed: boolean;
}

export interface NotRecommendedCard {
  readonly id: string;
  readonly nameDe: string;
  readonly summaryDe: string;
  readonly reasonDe: string;
  readonly expertReviewed: boolean;
}

export interface SupplementOverview {
  /** Einwilligung Fassung 2, Gesundheits-Check und Supplement-Check liegen vor. */
  readonly personalized: boolean;
  readonly groups: Readonly<Record<SupplementGroup, readonly SupplementCard[]>>;
  readonly caffeine: CaffeineCard | null;
  /** Liste „Nicht empfohlen“ (Stufe C), alphabetisch. */
  readonly notRecommended: readonly NotRecommendedCard[];
  /** Hinweise für die ganze Seite (z. B. „Bitte vor dem Start ärztlich abklären.“). */
  readonly pageNotices: readonly string[];
  /** „Nehme ich“, das noch passt bzw. nicht mehr passt (Reihenfolge RATED_SUPPLEMENT_IDS). */
  readonly taking: readonly RatedSupplementId[];
  readonly takingOutdated: readonly RatedSupplementId[];
  /** Es gibt keinen einzigen anzeigbaren Inhalt („Kommt bald“). */
  readonly empty: boolean;
}

/** Inhalte nach ID; bei doppelter ID gilt der erste (die Prüfregeln verhindern Doppelungen). */
function contentById(contents: readonly SupplementContent[]): Map<string, SupplementContent> {
  const map = new Map<string, SupplementContent>();
  for (const entry of contents) {
    if (!map.has(entry.id)) map.set(entry.id, entry);
  }
  return map;
}

function doseOf(item: RatedSupplementResult): { text: string; general: boolean } | null {
  const dose = supplementDose(item);
  return dose === null ? null : { text: formatSupplementDose(dose), general: dose.general };
}

export function supplementOverview(
  recommendations: SupplementRecommendations,
  contents: readonly SupplementContent[],
  userData: SupplementUserData = { screening: null, choices: [] },
): SupplementOverview {
  const byId = contentById(contents);
  const groups: Record<SupplementGroup, SupplementCard[]> = {
    recommended: [],
    info: [],
    adult_only: [],
    excluded: [],
  };
  for (const item of recommendations.items) {
    const entry = byId.get(item.id);
    if (!entry) continue;
    const dose = doseOf(item);
    groups[GROUP_OF_STATUS[item.status]].push({
      id: item.id,
      nameDe: entry.name_de,
      summaryDe: entry.summary_de,
      evidence: entry.evidence_level,
      status: item.status,
      doseText: dose?.text ?? null,
      doseGeneral: dose?.general ?? false,
      timing: dose === null ? null : supplementTiming(item.id),
      expertReviewed: entry.meta.expert_reviewed,
      choice: recommendations.personalized ? userSupplementStatus(userData.choices, item.id) : null,
    });
  }
  const caffeineEntry = byId.get('caffeine');
  const caffeine: CaffeineCard | null = caffeineEntry
    ? {
        nameDe: caffeineEntry.name_de,
        summaryDe: caffeineEntry.summary_de,
        status: recommendations.caffeine.status,
        mode: recommendations.caffeine.mode,
        expertReviewed: caffeineEntry.meta.expert_reviewed,
      }
    : null;
  const notRecommended = contents
    .filter(
      (entry) =>
        entry.evidence_level === 'c' &&
        entry.not_recommended_reason_de !== null &&
        byId.get(entry.id) === entry,
    )
    .map((entry) => ({
      id: entry.id,
      nameDe: entry.name_de,
      summaryDe: entry.summary_de,
      reasonDe: entry.not_recommended_reason_de ?? '',
      expertReviewed: entry.meta.expert_reviewed,
    }))
    .sort((a, b) => a.nameDe.localeCompare(b.nameDe, 'de'));
  const choices = recommendations.personalized ? userData.choices : [];
  const shown = SUPPLEMENT_GROUPS.reduce((sum, group) => sum + groups[group].length, 0);
  return {
    personalized: recommendations.personalized,
    groups,
    caffeine,
    notRecommended,
    pageNotices: recommendations.notices.map((key) => renderSupplementNotice(key)),
    taking: activeSupplementChoices(recommendations, choices),
    takingOutdated: outdatedSupplementChoices(recommendations, choices),
    empty: shown === 0 && caffeine === null && notRecommended.length === 0,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Detailseite
// ---------------------------------------------------------------------------------------------------------

export type SupplementDetailKind = 'rated' | 'caffeine' | 'not_recommended';

export interface SupplementDetail {
  readonly id: string;
  readonly kind: SupplementDetailKind;
  readonly nameDe: string;
  readonly summaryDe: string;
  readonly evidence: 'a' | 'b' | 'c' | null;
  /** Einordnung (nur `rated`). */
  readonly status: SupplementStatus | null;
  /** Koffein-Status (nur `caffeine`). */
  readonly caffeineStatus: CaffeineStatus | null;
  readonly doseText: string | null;
  readonly doseGeneral: boolean;
  readonly timing: SupplementTiming | null;
  /** Anwendung mit gefüllten Platzhaltern; `null` = keine (ohne Menge, Stufe C, Sperre). */
  readonly howToDe: string | null;
  /** Zugelassene Angabe IMMER mit Pflichthinweis. */
  readonly claims: readonly ClaimBlockText[];
  readonly notices: readonly string[];
  /** Pflichtsätze (Plan 3.8 Nr. 4) – auf jeder Detailseite. */
  readonly mandatory: readonly string[];
  /** Nur Stufe C. */
  readonly reasonDe: string | null;
  readonly sources: SupplementContent['sources'];
  readonly expertReviewed: boolean;
  /** „Nehme ich“ möglich (nur persönliche Einordnung und „passt“ bzw. Vitamin D als Info). */
  readonly canChoose: boolean;
  /** „Nicht für mich“ möglich (persönliche Einordnung, eingeordnetes Supplement). */
  readonly canDecline: boolean;
  readonly choice: UserSupplementStatus | null;
  /** „Nehme ich“ gespeichert, passt aber laut den aktuellen Angaben nicht mehr. */
  readonly choiceOutdated: boolean;
}

function fillHowTo(template: string | null, dose: string | null): string | null {
  if (template === null) return null;
  if (template.includes('{dose}') && dose === null) return null;
  try {
    return fillSupplementPlaceholders(template, {
      ...defaultPlaceholderValues(),
      ...(dose === null ? {} : { dose }),
    });
  } catch {
    return null;
  }
}

function isRatedId(id: string): id is RatedSupplementId {
  return (RATED_SUPPLEMENT_IDS as readonly string[]).includes(id);
}

/**
 * Detailseite zu einem Supplement; `null` = kein Inhalt zu dieser ID. `weightKg` nur mit Einwilligung (die Engine hat
 * die Koffein-Info ohne Gewicht schon auf „allgemein“ gesetzt; ohne persönlichen Modus wird das Gewicht nie genutzt).
 */
export function supplementDetail(
  id: string,
  recommendations: SupplementRecommendations,
  contents: readonly SupplementContent[],
  userData: SupplementUserData,
  weightKg: number | null,
): SupplementDetail | null {
  const entry = contentById(contents).get(id);
  if (!entry) return null;
  const base = {
    id,
    nameDe: entry.name_de,
    summaryDe: entry.summary_de,
    evidence: entry.evidence_level,
    sources: entry.sources,
    expertReviewed: entry.meta.expert_reviewed,
    mandatory: SUPPLEMENT_MANDATORY_SENTENCES_DE,
  };
  if (id === 'caffeine') {
    const info = recommendations.caffeine;
    const limit = caffeinePersonalLimitMg(info, weightKg);
    const daily = caffeinePersonalDailyLimitMg(info, weightKg);
    const render = (key: SupplementNoticeKey) =>
      renderSupplementNotice(key, {
        ...(limit === null ? {} : { dose: `${limit} mg` }),
        ...(daily === null ? {} : { dailyMg: daily }),
      });
    return {
      ...base,
      kind: 'caffeine',
      evidence: null,
      status: null,
      caffeineStatus: info.status,
      doseText: null,
      doseGeneral: false,
      timing: null,
      howToDe: info.status === 'safety_info' ? fillHowTo(entry.how_to_de, null) : null,
      claims: [],
      notices: info.notices.map(render),
      reasonDe: null,
      canChoose: false,
      canDecline: false,
      choice: null,
      choiceOutdated: false,
    };
  }
  if (!isRatedId(id)) {
    return {
      ...base,
      kind: 'not_recommended',
      status: null,
      caffeineStatus: null,
      doseText: null,
      doseGeneral: false,
      timing: null,
      howToDe: null,
      claims: [],
      notices: [],
      reasonDe: entry.not_recommended_reason_de,
      canChoose: false,
      canDecline: false,
      choice: null,
      choiceOutdated: false,
    };
  }
  const item = recommendations.items.find((candidate) => candidate.id === id);
  if (!item) return null;
  const dose = doseOf(item);
  const allowedClaims = new Set<string>(item.claimIds);
  const claims = entry.claim_ids
    .filter((claimId) => allowedClaims.has(claimId))
    .map((claimId) => claimBlockText(claimId as (typeof item.claimIds)[number]));
  const choice = recommendations.personalized ? userSupplementStatus(userData.choices, id) : null;
  const canChoose = canChooseSupplement(recommendations, item);
  return {
    ...base,
    kind: 'rated',
    status: item.status,
    caffeineStatus: null,
    doseText: dose?.text ?? null,
    doseGeneral: dose?.general ?? false,
    timing: dose === null ? null : supplementTiming(id),
    howToDe: fillHowTo(entry.how_to_de, dose?.text ?? null),
    claims,
    notices: item.notices.map((key) => renderSupplementNotice(key)),
    reasonDe: null,
    canChoose,
    canDecline: recommendations.personalized,
    choice,
    choiceOutdated: choice === 'taking' && !canChoose,
  };
}
