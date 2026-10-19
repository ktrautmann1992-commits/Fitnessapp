import { SUPPLEMENT_RULES } from '../constants';
import type { RatedSupplementId } from '../supplement-ids';

/**
 * Zugelassene gesundheitsbezogene Angaben (docs/PLAN-PHASE-6.md 3.8 Nr. 1, Wächter B2.1). Wirkaussagen gibt es NUR aus
 * dieser Liste, WÖRTLICH, mit Bedingung und Pflichthinweis `requiredInfoDe`, der immer direkt unter der Angabe steht.
 * Rechtsrahmen: VO (EG) 1924/2006 (inkl. Art. 10 Abs. 2) und VO (EU) 432/2012 in der konsolidierten Fassung bzw. laut
 * EU-Register. Wortlaute und Pflichthinweise VOR LIVEGANG gegen das EU-Register prüfen (Rechtsprüfung, Plan 18 Nr. 2).
 *
 * Koffein hat KEINE zugelassene Angabe (Plan 3.5, B2.3). Die Angabe zu Kohlenhydrat-Elektrolyt-Lösungen ist gestrichen
 * (B2.2). Kandidaten, deren Wortlaut noch nicht geprüft ist, stehen in `CANDIDATE_CLAIMS` und werden NIE angezeigt.
 */

export type ClaimDoseUnit = 'g' | 'mg' | 'ug';

export interface ApprovedClaim {
  readonly id: string;
  readonly supplementId: RatedSupplementId;
  /** Wortlaut der Angabe (deutsche Fassung). */
  readonly textDe: string;
  /**
   * Pflichthinweis, immer direkt unter der Angabe. `{dose}` füllt der Core mit der Mindestmenge der Bedingung.
   * Wo das Register keinen eigenen Pflichthinweis nennt (oder er noch nicht geprüft ist), steht der allgemeine Satz
   * zur abwechslungsreichen Ernährung (Art. 10 Abs. 2 lit. a VO 1924/2006).
   */
  readonly requiredInfoDe: string;
  /** true = Wortlaut des Pflichthinweises stammt aus dem Register-Eintrag; false = allgemeiner Satz, Register prüfen. */
  readonly requiredInfoFromRegister: boolean;
  /** Bedingung: Mindestmenge je Tag, die die Engine für die Angabe ansetzt (Prüfung gegen SUPPLEMENT_RULES im Test). */
  readonly minDaily: { readonly amount: number; readonly unit: ClaimDoseUnit } | null;
  /** Nie zeigen bei Herz-Flags (`medical_clearance_recommended`, `heart_rhythm`), Wächter S6. */
  readonly hiddenWithHeartFlags: boolean;
  /** Nur für Erwachsene (Text der Bedingung). */
  readonly adultsOnly: boolean;
}

const GENERAL_REQUIRED_INFO_DE =
  'Wichtig sind eine abwechslungsreiche und ausgewogene Ernährung und eine gesunde Lebensweise.';

export const APPROVED_CLAIMS = [
  {
    id: 'creatine_performance',
    supplementId: 'creatine',
    textDe:
      'Kreatin erhöht die körperliche Leistung bei Schnellkrafttraining im Rahmen kurzzeitiger intensiver körperlicher Betätigung.',
    requiredInfoDe:
      'Die positive Wirkung stellt sich bei einer täglichen Aufnahme von {dose} Kreatin ein. Gilt für Erwachsene, die intensive körperliche Betätigung ausüben.',
    requiredInfoFromRegister: true,
    minDaily: { amount: 3, unit: 'g' },
    hiddenWithHeartFlags: false,
    adultsOnly: true,
  },
  {
    id: 'protein_muscle_mass',
    supplementId: 'protein_powder',
    textDe: 'Protein trägt zu einer Zunahme an Muskelmasse bei.',
    requiredInfoDe: GENERAL_REQUIRED_INFO_DE,
    requiredInfoFromRegister: false,
    minDaily: null,
    hiddenWithHeartFlags: false,
    adultsOnly: false,
  },
  {
    id: 'vitamin_d_bones',
    supplementId: 'vitamin_d',
    textDe: 'Vitamin D trägt zur Erhaltung normaler Knochen bei.',
    requiredInfoDe: GENERAL_REQUIRED_INFO_DE,
    requiredInfoFromRegister: false,
    minDaily: {
      amount: SUPPLEMENT_RULES.vitaminD.nrvUg * SUPPLEMENT_RULES.vitaminD.claimMinNrvShare,
      unit: 'ug',
    },
    hiddenWithHeartFlags: false,
    adultsOnly: false,
  },
  {
    id: 'vitamin_d_muscle',
    supplementId: 'vitamin_d',
    textDe: 'Vitamin D trägt zur Erhaltung einer normalen Muskelfunktion bei.',
    requiredInfoDe: GENERAL_REQUIRED_INFO_DE,
    requiredInfoFromRegister: false,
    minDaily: {
      amount: SUPPLEMENT_RULES.vitaminD.nrvUg * SUPPLEMENT_RULES.vitaminD.claimMinNrvShare,
      unit: 'ug',
    },
    hiddenWithHeartFlags: false,
    adultsOnly: false,
  },
  {
    id: 'epa_dha_heart',
    supplementId: 'omega3',
    textDe: 'EPA und DHA tragen zu einer normalen Herzfunktion bei.',
    requiredInfoDe:
      'Die positive Wirkung stellt sich bei einer täglichen Aufnahme von {dose} EPA und DHA ein.',
    requiredInfoFromRegister: true,
    minDaily: { amount: 250, unit: 'mg' },
    hiddenWithHeartFlags: true,
    adultsOnly: false,
  },
] as const satisfies readonly ApprovedClaim[];

export type ApprovedClaimId = (typeof APPROVED_CLAIMS)[number]['id'];

/**
 * Kandidaten (nicht angezeigt): Kreatin ab 55 aus VO (EU) 2017/672 (Krafttraining, Erwachsene ab 55, 3 g/Tag) –
 * erst nach Prüfung des Wortlauts im EU-Register (Wächter K1, SU-G18). Bis dahin ohne Text.
 */
export const CANDIDATE_CLAIMS = [
  {
    id: 'creatine_strength_55plus',
    supplementId: 'creatine',
    fromAge: 55,
    minDaily: { amount: 3, unit: 'g' },
    status: 'pending_register_check',
  },
] as const;

/** Angabe nach ID (Ausnahme bei unbekannter ID). */
export function approvedClaim(id: ApprovedClaimId): ApprovedClaim {
  const claim = APPROVED_CLAIMS.find((entry) => entry.id === id);
  if (!claim) {
    throw new Error(`Unbekannte Angabe: ${id}`);
  }
  return claim;
}

/** Formatiert eine Mindestmenge für den Pflichthinweis, z. B. „3 g“, „250 mg“, „0,75 µg“. */
export function formatClaimDose(minDaily: { amount: number; unit: ClaimDoseUnit }): string {
  const unit = minDaily.unit === 'ug' ? 'µg' : minDaily.unit;
  const value = String(Math.round(minDaily.amount * 100) / 100).replace('.', ',');
  return `${value} ${unit}`;
}

/** Angabe und Pflichthinweis IMMER zusammen (die App-Komponente `ClaimBlock` rendert genau dieses Paar). */
export interface ClaimBlockText {
  readonly id: ApprovedClaimId;
  readonly claimDe: string;
  readonly requiredInfoDe: string;
}

export function claimBlockText(id: ApprovedClaimId): ClaimBlockText {
  const claim = approvedClaim(id);
  const requiredInfoDe = claim.requiredInfoDe.replace(
    '{dose}',
    claim.minDaily ? formatClaimDose(claim.minDaily) : '',
  );
  if (requiredInfoDe.trim().length === 0 || requiredInfoDe.includes('{')) {
    throw new Error(`Angabe ${id} ohne Pflichthinweis.`);
  }
  return { id, claimDe: claim.textDe, requiredInfoDe };
}
