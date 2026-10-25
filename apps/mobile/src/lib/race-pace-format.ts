import {
  type CompetitionDiscipline,
  type CompetitionReference,
  RACE_PACE_PLAN,
  isRunCompetitionDiscipline,
  predictedTimeS,
  type RacePacePlan,
  riegelReliable,
} from '@fitnessapp/core';
import type { TranslatedBlock, TranslatedDocument } from '@fitnessapp/ui/print';

import { t } from '@/i18n';
import { clockText, disciplineText, kmText, paceText } from '@/lib/competition-format';
import { formatNumberDe } from '@/lib/nutrition-format';

const P = t.racePace;

/**
 * Anzeige des Renn-Pace-Plans (docs/PLAN-PHASE-10.md Abschnitt 22): Zielzeit wählen, Tabellen-Zeilen, Balken und das
 * Druck-Dokument. Rechnet keine Regeln (racePacePlan in packages/core) – nur Texte. Gramm nur mit „Kalorienzahlen
 * anzeigen“ (wie die Wettkampf-Ernährung). Rein, getestet.
 */

export interface RacePaceTarget {
  readonly timeS: number;
  /** `target` = eigene Zielzeit, `predicted` = Vorhersage aus der Referenzzeit (Riegel, wie im Plan). */
  readonly source: 'target' | 'predicted';
}

/** Welche Zeit der Plan nimmt: Zielzeit, sonst (oder auf Wunsch) die Vorhersage aus der Referenzzeit. */
export function racePaceTarget(
  competition: {
    readonly discipline: string;
    readonly targetTimeS: number | null;
    readonly reference: CompetitionReference | null;
  },
  preferPredicted = false,
): RacePaceTarget | null {
  const predicted =
    competition.reference !== null &&
    isRunCompetitionDiscipline(competition.discipline) &&
    riegelReliable(competition.reference, competition.discipline)
      ? Math.round(predictedTimeS(competition.reference, competition.discipline))
      : null;
  if (competition.targetTimeS !== null && !(preferPredicted && predicted !== null)) {
    return { timeS: competition.targetTimeS, source: 'target' };
  }
  return predicted === null ? null : { timeS: predicted, source: 'predicted' };
}

/** Kilometer-Angabe einer Grenze: 21097,5 → „21,1“, 5000 → „5“. */
const kmLabel = (m: number) => kmText(m);

export interface RacePaceRow {
  readonly key: string;
  readonly segment: string;
  readonly pace: string;
  readonly split: string;
  readonly total: string;
  readonly elevation: string | null;
  readonly a11y: string;
  /** Verpflegungs-Zeilen in diesem Abschnitt. */
  readonly fuel: readonly string[];
}

function fuelText(plan: RacePacePlan, index: number, showNumbers: boolean): string {
  const f = plan.fuelPoints[index];
  if (!f) return '';
  const where = P.fuelRow(kmLabel(f.distanceM), f.minute);
  if (!showNumbers || f.carbsG === null) return where;
  const amount =
    f.carbsG.min === 0
      ? P.fuelUpTo(formatNumberDe(f.carbsG.max))
      : P.fuelCarbs(formatNumberDe(f.carbsG.min), formatNumberDe(f.carbsG.max));
  return `${where}: ${amount}`;
}

export function racePaceRows(plan: RacePacePlan, showNumbers: boolean): RacePaceRow[] {
  return plan.splits.map((s) => {
    const from = kmLabel(s.fromM);
    const to = kmLabel(s.toM);
    return {
      key: String(s.index),
      segment: P.segment(from, to),
      pace: paceText(s.paceSPerKm),
      split: clockText(s.timeS),
      total: clockText(s.elapsedS),
      // Höhenmeter nur mit Höhenprofil und nur, wenn es im Abschnitt rauf oder runter geht.
      elevation:
        s.climbM === null || s.descentM === null || (s.climbM === 0 && s.descentM === 0)
          ? null
          : P.elevation(s.climbM, s.descentM),
      a11y: P.segmentA11y(from, to, paceText(s.paceSPerKm), clockText(s.elapsedS)),
      fuel: s.fuel.map((i) => fuelText(plan, i, showNumbers)),
    };
  });
}

/**
 * Balken je Abschnitt: Länge = Tempo (langsamster = 100 %). Unterschiede werden etwas vergrößert, aber nie mehr als
 * wäre die Spanne 10 % des Tempos – kleine Unterschiede bleiben klein (ehrliche Grafik).
 */
export function racePaceBars(plan: RacePacePlan): { key: string; share: number; label: string }[] {
  const paces = plan.splits.map((s) => s.paceSPerKm);
  const max = Math.max(...paces);
  const span = Math.max(max - Math.min(...paces), max * 0.1);
  return plan.splits.map((s) => ({
    key: String(s.index),
    share: 1 - (0.45 * (max - s.paceSPerKm)) / span,
    label: kmLabel(s.toM),
  }));
}

/** Hinweis zur Verpflegung (Stufe aus raceFuelingPlan). */
export function racePaceFuelNotice(plan: RacePacePlan): string | null {
  if (plan.fuelingStage === 'none') return P.fuelNone;
  if (plan.fuelingStage === 'general') return P.fuelGeneral;
  return null;
}

/** Druck-Dokument (wie die anderen PDF-Exporte: packages/ui rendert, keine Gesundheitsangaben). */
export function racePacePrintDocument(input: {
  readonly name: string;
  readonly discipline: CompetitionDiscipline;
  readonly distanceKm: number | null;
  readonly plan: RacePacePlan;
  readonly target: RacePaceTarget;
  readonly showNumbers: boolean;
  readonly courseName: string | null;
}): TranslatedDocument {
  const { plan } = input;
  const rows = racePaceRows(plan, input.showNumbers);
  const withElevation = plan.elevationUsed;
  const blocks: TranslatedBlock[] = [
    { type: 'heading', level: 1, text: P.printHeading(input.name) },
    {
      type: 'keyValue',
      items: [
        {
          label: t.competition.discipline,
          value: disciplineText(input.discipline, input.distanceKm),
        },
        { label: P.targetLabel[input.target.source], value: clockText(input.target.timeS) },
        { label: P.averageLabel, value: `${paceText(plan.averagePaceSPerKm)} min/km` },
        { label: P.strategyLabel, value: P.strategies[plan.strategy].label },
        ...(input.courseName ? [{ label: P.course, value: input.courseName }] : []),
      ],
    },
    {
      type: 'table',
      caption: P.table,
      captionLevel: 2,
      columns: [
        { header: P.col.segment, role: 'label' },
        { header: P.col.pace, role: 'value' },
        { header: P.col.split, role: 'value' },
        { header: P.col.total, role: 'value' },
        ...(withElevation ? [{ header: P.col.elevation, role: 'value' as const }] : []),
        { header: P.fuelTitle, role: 'value' },
      ],
      rows: rows.map((r) => ({
        header: [r.segment],
        cells: [
          [r.pace],
          [r.split],
          [r.total],
          ...(withElevation ? [[r.elevation ?? '']] : []),
          r.fuel.length > 0 ? [...r.fuel] : [''],
        ],
      })),
    },
  ];
  const fuelNotice = racePaceFuelNotice(plan);
  if (fuelNotice) blocks.push({ type: 'paragraph', text: fuelNotice });
  blocks.push({ type: 'notice', title: P.title, text: P.effortFirst });
  return {
    lang: 'de',
    title: P.printTitle,
    footer: P.printFooter,
    logoLabel: 'Alpha5',
    blocks,
  };
}

/** Distanz der Renn-Strecke (für die Auswahl einer gespeicherten Strecke): ±10 % passt. */
export function courseFits(routeDistanceM: number, raceDistanceM: number): boolean {
  return (
    Math.abs(routeDistanceM - raceDistanceM) / raceDistanceM <= RACE_PACE_PLAN.courseLengthTolerance
  );
}
