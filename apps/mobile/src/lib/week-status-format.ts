import type {
  CrossDayQuestion,
  WeekEntry,
  WeekStatusDay,
  WeekStatusSummary,
} from '@fitnessapp/core';

import { t } from '@/i18n';
import { formatKcal } from '@/lib/nutrition-format';

import { kmText } from './competition-format';
import { dayLabel, weekdayName, weekdayShort } from './plan-format';

/**
 * Texte der Training-Übersicht (docs/PLAN-AUSWERTUNG.md „Training-Übersicht“) – rein, getestet in week-status-format.test.ts. Keine
 * Fachlogik: Zustände, Zuordnungen und Summen rechnet weekStatus() in packages/core, hier wird nur formuliert.
 */

const W = t.trainingWeek;

export type BadgeTone = 'success' | 'primary' | 'warning' | 'danger' | 'muted';

/** Name des Tages: erledigte Einträge, sonst offene, woanders erledigte, gestrichene Einheiten, sonst „Ruhetag“. */
export function dayMainText(day: WeekStatusDay): string {
  if (day.entries.length > 0) return day.entries.map(entryTitle).join(' + ');
  if (day.open.length > 0) return day.open.map((o) => o.name_de).join(' + ');
  const moved = day.doneElsewhere[0];
  if (moved) return moved.name_de;
  const skipped = day.skipped[0];
  if (skipped) return `${skipped.name_de} – ${t.plan.skipped}`;
  const dropped = day.dropped[0];
  if (dropped) return `${dropped.name_de} – ${t.plan.skipped}`;
  return W.a11y.rest;
}

/** Zusätze (Leiste: in Klammern im Namen für Bildschirmleser; Woche: Beschreibungszeile). */
export function dayExtras(day: WeekStatusDay): string[] {
  const parts: string[] = [];
  if (day.isToday) parts.push(W.a11y.today);
  if (day.entries.length > 0) {
    parts.push(day.entries.every((e) => e.partial) ? W.a11y.partial : W.a11y.done);
  } else if (day.state === 'missed') {
    parts.push(W.a11y.missed);
  }
  for (const entry of day.entries) {
    if (entry.fulfils && entry.fulfils.shift !== 'same') {
      parts.push(W.a11y.insteadOf(weekdayShort(entry.fulfils.plannedOn)));
    }
  }
  for (const moved of day.doneElsewhere) {
    parts.push(
      moved.shift === 'early'
        ? W.a11y.doneEarly(weekdayShort(moved.doneOn))
        : W.a11y.doneLate(weekdayShort(moved.doneOn)),
    );
  }
  if (day.entries.length > 0) {
    for (const open of day.open) parts.push(W.a11y.alsoPlanned(open.name_de));
  }
  for (const open of day.open) {
    if (open.movedFrom) parts.push(W.a11y.movedFrom(weekdayShort(open.movedFrom)));
    if (open.isDeload) parts.push(W.a11y.deload);
  }
  for (const away of day.movedAway) parts.push(W.a11y.movedAway(weekdayShort(away.to)));
  return parts;
}

/** Name eines Tages der Leiste für Bildschirmleser: „Freitag, 23.10.: Lauf 22,8 km (heute, erledigt, statt Sa)“. */
export function stripDayA11y(day: WeekStatusDay): string {
  const extras = dayExtras(day);
  return `${dayLabel(day.date)}: ${dayMainText(day)}${extras.length > 0 ? ` (${extras.join(', ')})` : ''}`;
}

/** Kennzeichen am tatsächlichen Tag („statt Sa“) – null ohne Tagwechsel. */
export function insteadOfTag(day: WeekStatusDay): string | null {
  const moved = day.entries.find((e) => e.fulfils && e.fulfils.shift !== 'same');
  return moved?.fulfils ? W.insteadOf(weekdayShort(moved.fulfils.plannedOn)) : null;
}

/** Status-Kennzeichen eines Tages (Zeichen + Wort). */
export function dayBadge(day: WeekStatusDay): { text: string; tone: BadgeTone } {
  switch (day.state) {
    case 'done':
      return day.entries.every((e) => e.partial)
        ? { text: W.badge.partial, tone: 'success' }
        : { text: W.badge.done, tone: 'success' };
    case 'planned':
      return { text: W.badge.planned, tone: 'primary' };
    case 'missed':
      return { text: W.badge.missed, tone: 'danger' };
    case 'moved':
      return day.doneElsewhere[0]?.shift === 'late'
        ? { text: W.badge.late, tone: 'warning' }
        : { text: W.badge.early, tone: 'warning' };
    case 'skipped':
      return { text: W.badge.skipped, tone: 'muted' };
    case 'rest':
      return day.dropped.length > 0
        ? { text: W.badge.dropped, tone: 'muted' }
        : { text: W.badge.rest, tone: 'muted' };
  }
}

/** Dauer als Uhr „2:13:57“ bzw. „35:04“. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** Titel eines Eintrags: „Lauf 22,8 km“ bzw. Name. */
export function entryTitle(entry: Pick<WeekEntry, 'name_de' | 'distanceM'>): string {
  return entry.distanceM !== null && entry.distanceM > 0
    ? `${entry.name_de} ${W.hero.km(kmText(entry.distanceM))}`
    : entry.name_de;
}

/** Werte eines Eintrags: „2:13:57 · 5:51 min/km · ca. 1.520 kcal“ (Pace nur beim Laufen und Gehen). */
export function entryStats(
  entry: Pick<WeekEntry, 'durationS' | 'distanceM' | 'kcal' | 'modality' | 'kind' | 'doneSets'>,
): string[] {
  const parts: string[] = [];
  if (entry.durationS !== null && entry.durationS > 0) parts.push(clockText(entry.durationS));
  if (
    entry.durationS !== null &&
    entry.durationS > 0 &&
    entry.distanceM !== null &&
    entry.distanceM >= 100 &&
    (entry.modality === 'run' || entry.modality === 'walk')
  ) {
    parts.push(W.hero.pace(clockText(entry.durationS / (entry.distanceM / 1000))));
  }
  if (entry.kind === 'strength' && entry.doneSets > 0) parts.push(t.week.sets(entry.doneSets));
  if (entry.kcal !== null && entry.kcal > 0) parts.push(W.hero.kcal(formatKcal(entry.kcal)));
  return parts;
}

/** Beschreibungszeile einer Zeile der Woche. */
export function weekRowMeta(day: WeekStatusDay, options: { pending: ReadonlySet<string> }): string {
  const parts: string[] = [];
  if (day.isToday) parts.push(W.a11y.today);
  if (day.entries.length > 0) {
    for (const entry of day.entries) {
      if (entry.fromWatch) parts.push(W.sheet.fromWatch);
      if (entry.fulfils && entry.fulfils.shift !== 'same') {
        parts.push(W.a11y.insteadOf(weekdayShort(entry.fulfils.plannedOn)));
      }
      if (entry.free && !entry.fulfils && !entry.fromWatch) parts.push(t.week.free);
      if (entry.backfilled) parts.push(t.week.backfilled);
      if (entry.performedOn !== entry.shownOn) {
        parts.push(t.weekEval.performedOn(formatDate(entry.performedOn)));
      }
      if (entry.fulfils?.sessionId && options.pending.has(entry.fulfils.sessionId)) {
        parts.push(t.week.pending);
      }
      parts.push(...entryStats(entry).filter((p) => !p.includes('min/km')));
    }
    for (const open of day.open) parts.push(W.a11y.alsoPlanned(open.name_de));
    for (const moved of day.doneElsewhere) {
      parts.push(
        moved.shift === 'early'
          ? W.a11y.doneEarly(weekdayShort(moved.doneOn))
          : W.a11y.doneLate(weekdayShort(moved.doneOn)),
      );
    }
    return parts.join(' · ');
  }
  if (day.open.length > 0) {
    for (const open of day.open) {
      if (open.movedFrom) parts.push(W.a11y.movedFrom(weekdayShort(open.movedFrom)));
      if (open.estimatedMinutes) parts.push(W.hero.minutes(open.estimatedMinutes));
      if (open.isDeload) parts.push(W.a11y.deload);
    }
    return parts.join(' · ');
  }
  const moved = day.doneElsewhere[0];
  if (moved) {
    parts.push(
      moved.shift === 'early'
        ? W.a11y.doneEarly(weekdayShort(moved.doneOn))
        : W.a11y.doneLate(weekdayShort(moved.doneOn)),
    );
    return parts.join(' · ');
  }
  if (day.skipped.length > 0) parts.push(t.week.status.skipped.replace(/^– /, ''));
  if (day.dropped.length > 0) parts.push(t.week.droppedHint);
  for (const away of day.movedAway) parts.push(W.a11y.movedAway(weekdayShort(away.to)));
  if (parts.length === (day.isToday ? 1 : 0)) parts.push(W.sheet.restMeta);
  return parts.join(' · ');
}

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

/** Titel einer Zeile der Woche: „Mo · Oberkörper“, „Sa · frei“, „Di · Ruhetag“. */
export function weekRowTitle(day: WeekStatusDay): string {
  const short = weekdayShort(day.date);
  if (day.state === 'moved') return `${short} · ${W.weekPage.freeTitle}`;
  return `${short} · ${dayMainText(day)}`;
}

/** Wochen-Summe „2 von 3 Einheiten“ (+ zusätzliche). */
export function weekCountText(summary: WeekStatusSummary): string {
  return W.weekCount(summary.sessionsDone, summary.sessionsPlanned);
}

/** Texte der Frage „Soll dieser Lauf dafür zählen?“. */
export function questionTexts(q: CrossDayQuestion): {
  title: string;
  meta: string;
  text: string;
  yes: string;
  no: string;
} {
  const noun =
    q.kind === 'strength'
      ? W.question.nouns.strength
      : q.modality
        ? W.question.nouns[q.modality]
        : W.question.nouns.endurance;
  const meta: string[] = [weekdayShort(q.logDate)];
  if (q.startedAt) {
    const start = new Date(q.startedAt);
    if (!Number.isNaN(start.getTime())) {
      meta[0] = `${weekdayShort(q.logDate)} ${String(start.getHours()).padStart(2, '0')}:${String(
        start.getMinutes(),
      ).padStart(2, '0')}`;
    }
  }
  if (q.distanceM !== null && q.distanceM > 0) meta.push(W.hero.km(kmText(q.distanceM)));
  if (q.durationS !== null && q.durationS > 0) {
    const h = Math.floor(q.durationS / 3600);
    const m = Math.floor((q.durationS % 3600) / 60);
    meta.push(h > 0 ? W.question.hours(`${h}:${String(m).padStart(2, '0')}`) : `${m} min`);
  }
  const day = weekdayName(q.sessionDate);
  return {
    title: q.fromWatch ? W.question.titleWatch(noun.title) : W.question.titleFree(q.logName),
    meta: meta.join(' · '),
    text: `${
      q.shift === 'late'
        ? W.question.plannedPast(day, q.sessionName)
        : W.question.planned(day, q.sessionName)
    } ${W.question.ask(noun.ask)}`,
    yes: W.question.yes(day),
    no: W.question.no,
  };
}
