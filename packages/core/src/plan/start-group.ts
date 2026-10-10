import { ageInYears } from '../age';
import { AGE_PLAN_RULES, ENDURANCE_EFFORT } from '../constants';
import { isoDateInTimeZone } from '../dates';
import { CAUTION_TAGS } from '../enums';
import { experienceLevelSchema } from '../validation';
import {
  type EnduranceStartGroup,
  planSafetyRules,
  type PlanSafetyRules,
  strictestRules,
} from './safety';

/** Felder eines gespeicherten Plans (user_plans), aus denen die Startgruppe bestimmt wird. */
export interface PlanStartGroupSource {
  readonly uses_health_data: boolean;
  readonly medical_notice: boolean;
  /** Erstellungszeitpunkt (ISO-Zeitstempel, user_plans.created_at). */
  readonly created_at: string;
  /** user_plans.inputs (Angaben ohne Gesundheitsdaten, PlanInputsSnapshot). */
  readonly inputs: unknown;
}

/**
 * Startgruppe Ausdauer, mit der ein GESPEICHERTER Plan erstellt wurde – die einzige Quelle für
 * `previousStartGroup` (NextPlanBlockOptions in schedule.ts, applyCurrentEnduranceRules in apply-safety.ts),
 * sobald `safety_rules` nicht mehr vorliegen (z. B. nach dem Neuladen; sie werden nie gespeichert).
 *
 * Bestimmt nur aus Spalten des Plans und dem Geburtsdatum (wie planSafetyRules().enduranceStartGroup beim
 * Erstellen):
 * - `uses_health_data = false` → ohne Gesundheits-Check erstellt → 'cautious',
 * - `medical_notice = true` → jedes Gesundheits-Flag (auch Schwangerschaft) → 'cautious',
 * - Alter am Erstellungstag (Europe/Berlin) unter 18 oder ab 65 → 'cautious',
 * - sonst das Level aus `inputs.experienceLevel` ('beginner' | 'advanced' | 'competitive').
 * Unlesbare Angaben oder Datum → 'competitive' (LOCKERSTER Wert): Die Startgruppe dient nur als Vergleich „ist die
 * aktuelle Gruppe strenger?“ – mit dem lockersten Wert setzt jede strengere aktuelle Gruppe den Ausdauer-Umfang
 * sicher zurück (Wächter-Auflage Etappe C). Rein und deterministisch.
 */
export function planStartGroup(plan: PlanStartGroupSource, birthDate: string): EnduranceStartGroup {
  if (!plan.uses_health_data || plan.medical_notice) {
    return 'cautious';
  }
  let createdOn: string;
  let age: number;
  try {
    createdOn = isoDateInTimeZone(plan.created_at);
    age = ageInYears(birthDate, createdOn);
  } catch {
    return 'competitive';
  }
  if (age < AGE_PLAN_RULES.minor.belowAge || age >= AGE_PLAN_RULES.senior.fromAge) {
    return 'cautious';
  }
  const inputs = plan.inputs;
  const level =
    typeof inputs === 'object' && inputs !== null
      ? experienceLevelSchema.safeParse((inputs as { experienceLevel?: unknown }).experienceLevel)
      : null;
  return level?.success ? level.data : 'competitive';
}

// ---------------------------------------------------------------------------------------------------------
// Mindest-Regeln eines gespeicherten Plans (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 4.5, Wächter B4)
// ---------------------------------------------------------------------------------------------------------

/**
 * Strengste Regeln, wenn Plan-Angaben bzw. Datum unlesbar sind (Wächter N3): vorsichtiger Plan inklusive
 * `overhead`, `long_supine` (Schwangerschaft nicht auszuschließen) und der Merkmale BEIDER Altersgrenzen – bewusst
 * nicht alle CAUTION_TAGS, sonst bliebe praktisch kein Tausch-Kandidat übrig.
 */
function unreadableFloorRules(): PlanSafetyRules {
  // Stichtag und Geburtsdatum hier nur, damit planSafetyRules rechnen kann (Alter 30) – die Altersregeln kommen danach.
  const base = planSafetyRules(
    {
      experienceLevel: 'beginner',
      birthDate: '2000-01-01',
      healthScreening: { flags: ['pregnancy', 'injury'] },
    },
    '2030-01-01',
  );
  return {
    ...base,
    rpeMax: Math.min(base.rpeMax, AGE_PLAN_RULES.minor.rpeMax, AGE_PLAN_RULES.senior.rpeMax),
    excludedCautionTags: CAUTION_TAGS.filter(
      (tag) =>
        base.excludedCautionTags.includes(tag) ||
        AGE_PLAN_RULES.minor.excludedCautionTags.some((t) => t === tag) ||
        AGE_PLAN_RULES.senior.excludedCautionTags.some((t) => t === tag),
    ),
    pregnancyNotice: false,
    enduranceEffortMax: Math.min(base.enduranceEffortMax, ENDURANCE_EFFORT.minorMax),
    enduranceStartGroup: 'cautious',
  };
}

/**
 * Mindest-Regeln, mit denen ein GESPEICHERTER Plan erstellt wurde – rekonstruiert nur aus Plan-Spalten und
 * Geburtsdatum (die Regeln des Erzeugens werden nie gespeichert):
 * - `uses_health_data = false` (ohne Gesundheits-Check) → vorsichtiger Plan einschließlich `overhead`,
 * - `medical_notice = true` (jedes Gesundheits-Flag) → dieselben Regeln PLUS `long_supine` (welches Flag galt, ist
 *   nicht gespeichert; eine Schwangerschaft ist nicht auszuschließen – vorsichtige Annahme),
 * - Alter am Erstellungstag (Europe/Berlin) unter 18 bzw. ab 65 → Altersregeln,
 * - Level aus `inputs.experienceLevel` (unlesbar → Einsteiger, die strengere Richtung),
 * - unlesbares Datum bzw. Geburtsdatum → strengste Regeln (unreadableFloorRules, Wächter N3) – anders als
 *   planStartGroup: hier dient der Wert als Einschränkung, nicht als Vergleich.
 *
 * NUR für die Auswahl von Tausch-Kandidaten (displaySwapRules), nie für die Anzeige selbst
 * (applyCurrentSafetyRules bleibt bei den aktuellen Regeln, sonst ändert sich die Anzeige ohne Präferenzen).
 * `pregnancyNotice` ist immer false (nur Anzeige-Hinweis, gehört zu den aktuellen Regeln). Rein, deterministisch.
 */
export function planFloorRules(plan: PlanStartGroupSource, birthDate: string): PlanSafetyRules {
  let createdOn: string;
  try {
    createdOn = isoDateInTimeZone(plan.created_at);
    ageInYears(birthDate, createdOn);
  } catch {
    return unreadableFloorRules();
  }
  const inputs = plan.inputs;
  const level =
    typeof inputs === 'object' && inputs !== null
      ? experienceLevelSchema.safeParse((inputs as { experienceLevel?: unknown }).experienceLevel)
      : null;
  const rules = planSafetyRules(
    {
      experienceLevel: level?.success ? level.data : 'beginner',
      birthDate,
      // Ohne Check → null (vorsichtig + overhead); Arzt-Hinweis → Flags, die `overhead` und `long_supine`
      // auslösen (vorsichtige Annahme, siehe oben); sonst Check ohne Flag.
      healthScreening: !plan.uses_health_data
        ? plan.medical_notice
          ? { flags: ['pregnancy', 'injury'] }
          : null
        : { flags: plan.medical_notice ? ['pregnancy', 'injury'] : [] },
    },
    createdOn,
  );
  return { ...rules, pregnancyNotice: false };
}

/**
 * Regeln für ALLE Tausch-Kandidaten (4.5): `strictestRules(aktuell, planFloorRules(plan, birthDate))`. Strengere
 * aktuelle Regeln wirken sofort; eine Lockerung (Schwangerschaft beendet, Flag entfällt, 18. Geburtstag) öffnet über
 * keinen Tausch etwas, bis der Plan neu erstellt ist (= Bestätigung nach PLAN-PHASE-3 5.4).
 */
export function displaySwapRules(
  plan: PlanStartGroupSource,
  birthDate: string,
  rules: PlanSafetyRules,
): PlanSafetyRules {
  return strictestRules(rules, planFloorRules(plan, birthDate));
}
