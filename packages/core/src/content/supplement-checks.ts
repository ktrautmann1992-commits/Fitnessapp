import { SUPPLEMENT_CONTENT_LIMITS, SUPPLEMENT_RULES } from '../constants';
import type { SupplementId } from '../supplement-ids';
import {
  APPROVED_CLAIMS,
  type ApprovedClaim,
  CANDIDATE_CLAIMS,
  type ClaimDoseUnit,
  formatClaimDose,
} from '../supplements/claims';
import { SUPPLEMENT_CATEGORIES, SUPPLEMENT_EVIDENCE } from '../supplements/eligibility';
import type { SupplementPlaceholder } from '../supplements/notices';
import { checkSupplementText, type SupplementTextHit } from '../supplements/text-rules';
import { type ContentIssue, makeIssue } from './rules';
import {
  isNotRecommendedSupplementId,
  isSupplementId,
  NOT_RECOMMENDED_SUPPLEMENTS,
  type SupplementContent,
} from './supplement-schema';

/**
 * Prüfregeln SK2–SK7 für Supplement-Inhalte (docs/PLAN-PHASE-6.md Abschnitt 6 und 3.8). SK1 ist das Schema
 * (`supplement-schema.ts`), Doppelungen meldet `validateContent` (SK2). Rot blockiert wie üblich nur bei freigegebenen
 * Inhalten (SK1 immer); SK7H ist gelb.
 *
 * - SK2: ID bekannt (`SUPPLEMENT_IDS` oder `NOT_RECOMMENDED_SUPPLEMENTS`), Kategorie wie im Core.
 * - SK3: Textregeln 3.8 Nr. 2 (bestehende Listen + `SUPPLEMENT_FORBIDDEN_TERMS`) in Name, Beschreibung, Anwendung, Grund.
 * - SK4: `claim_ids` aus `APPROVED_CLAIMS`, zum Supplement passend, Bedingung durch die Core-Dosis erfüllt, Pflichthinweis
 *   vorhanden; Kandidaten (`CANDIDATE_CLAIMS`) sind nie erlaubt.
 * - SK5: keine Ziffern, Einheiten oder Zahlwörter im Freitext (Dosis nur über Platzhalter, 3.8 Nr. 3); nur Platzhalter,
 *   die der Core für dieses Supplement füllt (`SUPPLEMENT_CONTENT_PLACEHOLDERS`). Im Namen sind Ziffern erlaubt
 *   (z. B. „Omega-3“), Platzhalter nicht.
 * - SK6: Stufe A/B mit mindestens einer Quelle; jede Quelle mit DOI oder PMID (K10); keine doppelte Quelle.
 * - SK7: Stufe wie im Core (Koffein ohne Stufe, Liste „Nicht empfohlen“ = C); Stufe C und Koffein ohne `claim_ids`;
 *   Koffein-Texte ohne Zweck und ohne Stufe (B2.3); `how_to_de` nur ohne Stufe C, `not_recommended_reason_de` nur bei C.
 * - SK7H (gelb): Text länger als `SUPPLEMENT_CONTENT_LIMITS.textWarnChars` (600) Zeichen.
 */

/**
 * Platzhalter, die der Core je Supplement füllt (SK5). Stufe C hat keine Dosis und damit keine Platzhalter.
 * `{dose}` = persönliche bzw. allgemeine Menge aus `supplementDose`/`caffeineSingleLimit`, `{gain}` = Wasser-Zunahme bei
 * Kreatin, `{daily}`/`{cup}`/`{cups}`/`{time}` = Koffein-Grenzen (`defaultPlaceholderValues`).
 */
export const SUPPLEMENT_CONTENT_PLACEHOLDERS: Readonly<
  Record<SupplementId, readonly SupplementPlaceholder[]>
> = {
  creatine: ['dose', 'gain'],
  protein_powder: ['dose'],
  vitamin_d: ['dose'],
  omega3: ['dose'],
  caffeine: ['dose', 'daily', 'cup', 'cups', 'time'],
};

/**
 * Zweck- und Stufen-Wörter, die Koffein-Texte nie enthalten (Plan 3.5, 3.8 Nr. 5, B2.3) – gleiche Liste wie der
 * SU1-Test der Koffein-Hinweise.
 */
export const CAFFEINE_PURPOSE_PATTERN =
  /leistung|studienlage|stufe|passt zu dir|ausdauer|kraft|\benergie\b|fokus|wirk|fett|abnehm/iu;

/** Nur die Dosis-Werte, die SK4 für die Bedingungen der Angaben braucht (Tests geben eigene Werte vor). */
export interface SupplementClaimDoseRules {
  readonly creatine: { readonly dailyG: number };
  readonly omega3: { readonly epaDhaMgPerDay: { readonly min: number } };
  readonly vitaminD: { readonly generalUg: number };
}

export interface SupplementCheckOptions {
  /** Liste der zugelassenen Angaben (Standard `APPROVED_CLAIMS`). */
  readonly claims?: readonly ApprovedClaim[];
  /** Dosis-Regeln (Standard `SUPPLEMENT_RULES`). */
  readonly rules?: SupplementClaimDoseRules;
}

/** Tägliche Menge, die der Core für ein Supplement ansetzt (null = keine feste Tagesmenge, z. B. Proteinpulver). */
export function coreDailyAmount(
  supplementId: string,
  rules: SupplementClaimDoseRules = SUPPLEMENT_RULES,
): { amount: number; unit: ClaimDoseUnit } | null {
  switch (supplementId) {
    case 'creatine':
      return { amount: rules.creatine.dailyG, unit: 'g' };
    case 'omega3':
      return { amount: rules.omega3.epaDhaMgPerDay.min, unit: 'mg' };
    case 'vitamin_d':
      return { amount: rules.vitaminD.generalUg, unit: 'ug' };
    default:
      return null;
  }
}

/** true = die Core-Dosis erfüllt die Mindestmenge der Angabe (Plan 3.8 Nr. 5, z. B. Kreatin ≥ 3 g/Tag). */
export function claimConditionMet(
  claim: ApprovedClaim,
  rules: SupplementClaimDoseRules = SUPPLEMENT_RULES,
): boolean {
  if (claim.minDaily === null) {
    return true;
  }
  const daily = coreDailyAmount(claim.supplementId, rules);
  return (
    daily !== null && daily.unit === claim.minDaily.unit && daily.amount >= claim.minDaily.amount
  );
}

/** Pflichthinweis mit gefüllter Menge; null = fehlt oder unvollständig (Plan 3.8 Nr. 5: „Angabe ohne Pflichthinweis → rot“). */
export function claimRequiredInfo(claim: ApprovedClaim): string | null {
  const dose = claim.minDaily ? formatClaimDose(claim.minDaily) : '';
  const text = claim.requiredInfoDe.replace('{dose}', dose).trim();
  return text.length === 0 || text.includes('{') ? null : text;
}

/** Texte eines Eintrags mit Pfad (ohne Quellen – das sind Zitate, keine eigenen Aussagen). */
function textFields(entry: SupplementContent): [string, string][] {
  const fields: [string, string | null][] = [
    ['name_de', entry.name_de],
    ['summary_de', entry.summary_de],
    ['how_to_de', entry.how_to_de],
    ['not_recommended_reason_de', entry.not_recommended_reason_de],
  ];
  return fields.filter((field): field is [string, string] => field[1] !== null);
}

function describeWordHit(hit: SupplementTextHit): string {
  switch (hit.kind) {
    case 'brand':
      return `Markenname „${hit.match}“ – nur Produktarten, keine Marken`;
    case 'health_claim':
      return `„${hit.match}“ (${hit.label}) – keine Gesundheits- oder Nährwertversprechen`;
    case 'supplement':
      return `„${hit.match}“ (${hit.label}) – keine Wirk- oder Leistungsversprechen, Angaben nur aus APPROVED_CLAIMS`;
    default:
      return `„${hit.match}“ (${hit.label}) – keine Heilversprechen oder medizinischen Aussagen`;
  }
}

const WORD_HIT_KINDS: ReadonlySet<SupplementTextHit['kind']> = new Set([
  'medical',
  'brand',
  'health_claim',
  'supplement',
]);

const PLACEHOLDER_RE = /\{([^{}]*)\}/g;

/** Erwartete Stufe laut Core: Koffein null, eingeordnete wie `SUPPLEMENT_EVIDENCE`, „Nicht empfohlen“ C. */
export function expectedEvidenceLevel(id: string): 'a' | 'b' | 'c' | null | undefined {
  if (id === 'caffeine') return null;
  if (isSupplementId(id)) return SUPPLEMENT_EVIDENCE[id as Exclude<SupplementId, 'caffeine'>];
  if (isNotRecommendedSupplementId(id)) return 'c';
  return undefined;
}

/** Erwartete Kategorie laut Core (undefined = ID unbekannt). */
export function expectedSupplementCategory(id: string): string | undefined {
  if (isSupplementId(id)) return SUPPLEMENT_CATEGORIES[id];
  if (isNotRecommendedSupplementId(id)) return NOT_RECOMMENDED_SUPPLEMENTS[id];
  return undefined;
}

/** Prüft einen Supplement-Inhalt (SK2–SK7, SK7H). */
export function checkSupplementContent(
  entry: SupplementContent,
  options: SupplementCheckOptions = {},
): ContentIssue[] {
  const claims = options.claims ?? APPROVED_CLAIMS;
  const rules = options.rules ?? SUPPLEMENT_RULES;
  const target = { kind: 'supplement' as const, id: entry.id, status: entry.status };
  const issues: ContentIssue[] = [];
  const add = (rule: Parameters<typeof makeIssue>[0], message: string, path?: string) =>
    issues.push(makeIssue(rule, target, message, path));

  // SK2 – ID bekannt, Kategorie wie im Core.
  const known = isSupplementId(entry.id) || isNotRecommendedSupplementId(entry.id);
  if (!known) {
    add(
      'SK2',
      `Unbekannte ID „${entry.id}“ – erlaubt sind SUPPLEMENT_IDS und die Liste „Nicht empfohlen“ (NOT_RECOMMENDED_SUPPLEMENTS).`,
      'id',
    );
  } else {
    const category = expectedSupplementCategory(entry.id);
    if (category !== entry.category) {
      add('SK2', `Kategorie „${entry.category}“ passt nicht zum Core („${category}“).`, 'category');
    }
  }

  const isCaffeine = entry.id === 'caffeine';
  const isLevelC = entry.evidence_level === 'c' || isNotRecommendedSupplementId(entry.id);
  const allowedPlaceholders: ReadonlySet<string> = new Set(
    isSupplementId(entry.id) ? SUPPLEMENT_CONTENT_PLACEHOLDERS[entry.id] : [],
  );

  // SK3 / SK5 / SK7H – Texte.
  for (const [path, value] of textFields(entry)) {
    const hits = checkSupplementText(value);
    for (const hit of hits.filter((h) => WORD_HIT_KINDS.has(h.kind))) {
      add('SK3', `Text enthält ${describeWordHit(hit)}.`, path);
    }
    if (path === 'name_de') {
      if (value.includes('{') || value.includes('}')) {
        add(
          'SK5',
          'Der Name enthält Platzhalter – Platzhalter nur in Beschreibung und Anwendung.',
          path,
        );
      }
    } else {
      for (const hit of hits.filter(
        (h) => h.kind === 'number' || h.kind === 'unknown_placeholder',
      )) {
        add(
          'SK5',
          hit.kind === 'unknown_placeholder'
            ? `Unbekannter Platzhalter „${hit.match}“.`
            : `${hit.label} „${hit.match}“ im Freitext – Mengen nur über Platzhalter (z. B. {dose}), die der Core füllt.`,
          path,
        );
      }
      for (const [, name] of value.matchAll(PLACEHOLDER_RE)) {
        const placeholder = name ?? '';
        if (hits.some((h) => h.kind === 'unknown_placeholder' && h.match === `{${placeholder}}`)) {
          continue;
        }
        if (!allowedPlaceholders.has(placeholder)) {
          add(
            'SK5',
            `Platzhalter „{${placeholder}}“ füllt der Core für „${entry.id}“ nicht${
              allowedPlaceholders.size === 0
                ? ' (hier sind keine Platzhalter erlaubt)'
                : ` (erlaubt: ${[...allowedPlaceholders].map((p) => `{${p}}`).join(', ')})`
            }.`,
            path,
          );
        }
      }
    }
    if (isCaffeine) {
      const purpose = CAFFEINE_PURPOSE_PATTERN.exec(value);
      if (purpose) {
        add(
          'SK7',
          `Koffein-Text nennt einen Zweck oder eine Stufe („${purpose[0]}“) – nur neutrale Sicherheits-Info.`,
          path,
        );
      }
    }
    if (value.length > SUPPLEMENT_CONTENT_LIMITS.textWarnChars) {
      add(
        'SK7H',
        `Text hat ${value.length} Zeichen (empfohlen höchstens ${SUPPLEMENT_CONTENT_LIMITS.textWarnChars}).`,
        path,
      );
    }
  }

  // SK7 – Stufe, Angaben, Anwendung, Grund.
  const expectedLevel = expectedEvidenceLevel(entry.id);
  if (isCaffeine && entry.evidence_level !== null) {
    add('SK7', 'Koffein bekommt keine Stufe – „evidence_level“ muss null sein.', 'evidence_level');
  } else if (!isCaffeine && entry.evidence_level === null) {
    add('SK7', 'Stufe fehlt – nur Koffein hat keine Stufe.', 'evidence_level');
  } else if (expectedLevel !== undefined && expectedLevel !== entry.evidence_level) {
    add(
      'SK7',
      `Stufe „${String(entry.evidence_level)}“ passt nicht zum Core („${String(expectedLevel)}“).`,
      'evidence_level',
    );
  }
  const noClaimsAllowed = isCaffeine || isLevelC;
  if (noClaimsAllowed && entry.claim_ids.length > 0) {
    add(
      'SK7',
      isCaffeine
        ? 'Koffein hat keine zugelassene Angabe – „claim_ids“ muss leer sein.'
        : 'Stufe C hat keine Angaben – „claim_ids“ muss leer sein.',
      'claim_ids',
    );
  }
  if (isLevelC) {
    if (entry.how_to_de !== null) {
      add('SK7', 'Stufe C: keine Anwendung („how_to_de“ muss null sein).', 'how_to_de');
    }
    if (entry.not_recommended_reason_de === null) {
      add(
        'SK7',
        'Stufe C: Grund fehlt („not_recommended_reason_de“).',
        'not_recommended_reason_de',
      );
    }
  } else {
    if (entry.how_to_de === null) {
      add('SK7', 'Anwendung fehlt („how_to_de“).', 'how_to_de');
    }
    if (entry.not_recommended_reason_de !== null) {
      add('SK7', '„not_recommended_reason_de“ nur bei Stufe C.', 'not_recommended_reason_de');
    }
  }

  // SK4 – Angaben (bei Stufe C und Koffein meldet SK7 schon jede Angabe).
  if (!noClaimsAllowed) {
    entry.claim_ids.forEach((claimId, i) => {
      const path = `claim_ids.${i}`;
      const claim = claims.find((c) => c.id === claimId);
      if (claim === undefined) {
        const candidate = CANDIDATE_CLAIMS.some((c) => c.id === claimId);
        add(
          'SK4',
          candidate
            ? `Angabe „${claimId}“ ist nur ein Kandidat (Wortlaut noch nicht geprüft) und wird nie angezeigt.`
            : `Angabe „${claimId}“ steht nicht in APPROVED_CLAIMS.`,
          path,
        );
        return;
      }
      if (claim.supplementId !== entry.id) {
        add(
          'SK4',
          `Angabe „${claimId}“ gehört zu „${claim.supplementId}“, nicht zu „${entry.id}“.`,
          path,
        );
        return;
      }
      if (!claimConditionMet(claim, rules)) {
        add(
          'SK4',
          `Bedingung der Angabe „${claimId}“ nicht erfüllt: Die Tagesmenge im Core liegt unter ${
            claim.minDaily ? formatClaimDose(claim.minDaily) : '–'
          }.`,
          path,
        );
      }
      if (claimRequiredInfo(claim) === null) {
        add('SK4', `Angabe „${claimId}“ ohne Pflichthinweis (requiredInfoDe).`, path);
      }
    });
  }

  // SK6 – Quellen.
  if (entry.evidence_level === 'a' || entry.evidence_level === 'b') {
    if (entry.sources.length === 0) {
      add(
        'SK6',
        `Stufe ${entry.evidence_level.toUpperCase()} braucht mindestens eine Quelle.`,
        'sources',
      );
    }
  }
  const seen = new Set<string>();
  entry.sources.forEach((source, i) => {
    if (source.doi === null && source.pmid === null) {
      add('SK6', `Quelle „${source.title}“ ohne DOI und ohne PMID.`, `sources.${i}`);
    }
    const key = source.doi !== null ? `doi:${source.doi.toLowerCase()}` : `pmid:${source.pmid}`;
    if (source.doi !== null || source.pmid !== null) {
      if (seen.has(key)) {
        add('SK6', `Quelle „${source.title}“ ist doppelt.`, `sources.${i}`);
      }
      seen.add(key);
    }
  });

  return issues;
}
