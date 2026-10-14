import { FEATURE_FLAGS } from '../constants';
import {
  roundShoppingAmount,
  type ShoppingList,
  type ShoppingUnit,
} from '../nutrition/shopping-list';
import { sanitizeShareLabel, shareAmountText } from '../nutrition/shopping-list-share';

/**
 * Händler-Modul – NUR die Schnittstelle (docs/PLAN-PHASE-5.md 19.7 N12, K5; KONZEPT 6.13 „Später –
 * Händler-Anbindung“). Es gibt **keinen Händler**, **keinen Netzwerkaufruf** und das Feature-Flag
 * `retail_integration` ist aus (`FEATURE_FLAGS` in constants.ts). Die App zeigt deshalb keinen Knopf.
 *
 * Vorbereitet ist nur, was beim Einschalten gelten MUSS:
 * - Datenminimierung: an einen Händler gehen ausschließlich Produktarten und Mengen (`retailOrderLines`) – keine
 *   Ersatz-Hinweise, keine Lebensmittel-IDs, keine eigenen Einträge (Freitext), keine Plan- oder Profildaten.
 * - Jeder Anbieter ist eine offizielle Schnittstelle oder ein Partnerprogramm (keine inoffiziellen Schnittstellen)
 *   und wird als „Anzeige“ gekennzeichnet. Affiliate beeinflusst nie, WAS auf der Liste steht – die Zeilen entstehen
 *   vor und unabhängig vom Anbieter.
 * - Sichtbar nur, wenn Flag an, mindestens ein Anbieter, und die eigene Einwilligung der Person für die Übermittlung
 *   vorliegt (`retailIntegrationAvailable`).
 */

/** Bedingungen aus K5, die VOR dem Einschalten des Flags erfüllt und dokumentiert sein müssen. */
export const RETAIL_INTEGRATION_CONDITIONS = [
  /** Eigene, getrennte Einwilligung der Person für die Übermittlung an den Händler (mit Version). */
  'transfer_consent',
  /** Datenschutz-Folgenabschätzung (DSFA) ergänzt. */
  'dpia_updated',
  /** Nur Produktarten und Mengen (`retailOrderLines`), keine Ersatz-Hinweise, keine Plan-/Profildaten. */
  'data_minimization',
  /** Offizielle Schnittstelle bzw. Partner-/Affiliate-Programm des Händlers. */
  'official_interface',
  /** Kennzeichnung „Anzeige“ an jedem Händler-Knopf/-Link. */
  'ad_label',
] as const;

export type RetailIntegrationCondition = (typeof RETAIL_INTEGRATION_CONDITIONS)[number];

/** Eine Zeile für den Händler: nur Produktart und Menge. */
export interface RetailOrderLine {
  readonly product: string;
  readonly amount: number | null;
  readonly unit: ShoppingUnit | null;
  /** Menge als Text („500 g“), null = ohne Menge. */
  readonly amountText: string | null;
}

/** Übergabe an den Händler – ohne Netzwerkaufruf im Core (eine spätere Etappe öffnet höchstens einen Link). */
export interface RetailHandoff {
  readonly kind: 'open_url';
  readonly url: string;
  /** Immer gekennzeichnet (KONZEPT 6.13, CLAUDE.md „Affiliate & Werbung“). */
  readonly adLabelDe: 'Anzeige';
}

export interface RetailProvider {
  readonly id: string;
  readonly nameDe: string;
  /** Nur offiziell – inoffizielle Schnittstellen sind ausgeschlossen (KONZEPT 6.13). */
  readonly access: 'official_api' | 'partner_program';
  readonly adLabelDe: 'Anzeige';
  handoff(lines: readonly RetailOrderLine[]): RetailHandoff;
}

/** Angebundene Händler: KEINE (Plan 19.7 N12 „ohne Händler“). */
export const RETAIL_PROVIDERS: readonly RetailProvider[] = [];

/**
 * Datenminimierung für eine spätere Übermittlung (K5): nur offene Plan-Einträge (nicht abgehakt, nicht „nicht mehr
 * im Plan“, kein Vorrat, keine eigenen Freitext-Einträge) mit Produktart und Menge – sonst nichts.
 *
 * Sichere Voreinstellung (Wächter N12 H8, Gründer-Entscheidung G7 offen): Der Name eines Ersatzprodukts bzw. einer
 * ausgetauschten Zutat IST selbst der Rückschluss auf eine Unverträglichkeit (Art. 9 DSGVO). Deshalb werden
 * Ersatz-Einträge nie übermittelt, und eine Liste aus einem Plan mit Gesundheitsbezug (`usesHealthData`) ergibt gar
 * keine Zeilen – bis die Gründer G7 entschieden haben.
 */
export function retailOrderLines(
  list: Pick<ShoppingList, 'items' | 'usesHealthData'>,
): RetailOrderLine[] {
  if (list.usesHealthData) return [];
  const lines: RetailOrderLine[] = [];
  for (const item of list.items) {
    if (item.isManual || item.isPantry || item.checked || item.notInPlan) continue;
    if (item.substituteFor.length > 0) continue;
    const product = sanitizeShareLabel(item.labelDe);
    if (product.length === 0) continue;
    const amountText = shareAmountText(item.amount, item.unit);
    const valid = amountText !== null && item.amount !== null && item.unit !== null;
    lines.push({
      product,
      amount: valid ? roundShoppingAmount(item.amount as number, item.unit as ShoppingUnit) : null,
      unit: valid ? item.unit : null,
      amountText,
    });
  }
  return lines;
}

/**
 * Die K5-Bedingungen als ausdrückliche Eingaben (Wächter N12 H8) – keine davon hat einen Standardwert, damit eine
 * spätere Etappe jede bewusst belegen muss.
 */
export interface RetailIntegrationGate {
  readonly flags?: Readonly<{ retail_integration: boolean }>;
  readonly providers?: readonly RetailProvider[];
  /**
   * Eigene, getrennte Einwilligung der Person für die Übermittlung (mit Version; ob ausdrücklich nach Art. 9 Abs. 2
   * lit. a DSGVO, entscheiden die Gründer – G7). Gibt es noch nicht → immer false.
   */
  readonly transferConsent: boolean;
  /** DSFA um die Händler-Übermittlung ergänzt und freigegeben. */
  readonly dpiaUpdated: boolean;
  /** Offizielle Schnittstelle bzw. Partnerprogramm des Händlers vertraglich geklärt. */
  readonly officialInterface: boolean;
}

/** Ob die App überhaupt einen Händler-Knopf zeigen darf. Flag aus = kein Knopf (19.7 N12 DoD). */
export function retailIntegrationAvailable(gate: RetailIntegrationGate): boolean {
  const flags = gate.flags ?? FEATURE_FLAGS;
  const providers = gate.providers ?? RETAIL_PROVIDERS;
  return (
    flags.retail_integration &&
    gate.transferConsent &&
    gate.dpiaUpdated &&
    gate.officialInterface &&
    providers.length > 0 &&
    providers.every((p) => p.adLabelDe === 'Anzeige')
  );
}
