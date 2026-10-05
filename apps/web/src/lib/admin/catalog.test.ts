import type { ContentFile } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { CONTENT_BUNDLE } from '@/generated/content-files';

import {
  buildCatalog,
  countByStatus,
  filterExercises,
  filterTemplates,
  hasActiveFilters,
  isContentId,
  normalizeSearch,
  parseFilters,
  pushPullStats,
  sessionStats,
  volumeBars,
} from './catalog';

/** Echter Stand aus content/ (beim Test gebündelt wie beim Bauen). */
const catalog = buildCatalog(CONTENT_BUNDLE.files, CONTENT_BUNDLE.strayFiles);

function fileOf(id: string): ContentFile {
  const file = CONTENT_BUNDLE.files.find((f) => f.fileName === `${id}.json`);
  if (!file) throw new Error(`Testdatei ${id} fehlt`);
  return file;
}

function withData(file: ContentFile, change: (data: Record<string, unknown>) => void): ContentFile {
  const data = structuredClone(file.data) as Record<string, unknown>;
  change(data);
  return { ...file, data };
}

describe('Katalog aus den Repository-Dateien', () => {
  it('Startbestand + Körpergewicht (K1/K2): 80 Übungen, 24 + 18 Vorlagen, keine kaputten Dateien, nichts blockiert', () => {
    expect(catalog.exercises).toHaveLength(80);
    expect(catalog.templates).toHaveLength(42);
    expect(catalog.brokenFiles).toEqual([]);
    expect(catalog.blockingTotal).toBe(0);
    expect(countByStatus(catalog.exercises.map((e) => e.exercise.status))).toEqual({
      draft: 80,
      published: 0,
      archived: 0,
    });
  });

  it('Übungen nach deutschem Namen sortiert; KI-Kennzeichnung gesetzt', () => {
    const names = catalog.exercises.map((e) => e.exercise.name_de);
    expect([...names].sort((a, b) => a.localeCompare(b, 'de-DE'))).toEqual(names);
    expect(catalog.exercises.every((e) => e.needsExpertReview)).toBe(true);
  });

  it('Prüfbericht je Inhalt: gelbe Hinweise des Startbestands landen bei der Vorlage', () => {
    const withWarnings = catalog.templates.filter((t) => t.summary.warnings > 0);
    expect(withWarnings.length).toBeGreaterThan(0);
    expect(catalog.templates.every((t) => t.summary.errors === 0)).toBe(true);
    for (const entry of withWarnings) {
      expect(entry.issues.every((issue) => issue.id === entry.template.id)).toBe(true);
    }
  });

  it('„Verwendet in“: Übungen kennen ihre Vorlagen', () => {
    const goblet = catalog.exerciseById.get('goblet-kniebeuge');
    expect(goblet?.usedIn.length).toBeGreaterThan(0);
    for (const ref of goblet!.usedIn) {
      expect(catalog.templateById.has(ref.id)).toBe(true);
    }
  });

  it('kaputte Dateien und fremde Dateien erscheinen getrennt und blockieren', () => {
    const broken = buildCatalog(
      [
        fileOf('goblet-kniebeuge'),
        withData(fileOf('liegestuetz'), (d) => {
          d.difficulty = 9;
        }),
        { kind: 'exercise', fileName: 'kaputt.json', jsonError: 'Unexpected token' },
      ],
      ['exercises/notiz.txt'],
    );
    expect(broken.exercises.map((e) => e.exercise.id)).toEqual(['goblet-kniebeuge']);
    expect(broken.brokenFiles.map((f) => f.id)).toEqual(['kaputt.json', 'liegestuetz']);
    expect(broken.blockingTotal).toBe(3);
  });

  it('roter Befund an freigegebenem Inhalt zählt als blockierend; rot sortiert vor gelb', () => {
    const changed = buildCatalog([
      withData(fileOf('goblet-kniebeuge'), (d) => {
        d.status = 'published';
        d.meta = { ...(d.meta as object), reviewed_by: 'KT', reviewed_at: '2026-10-03' };
        d.equipment_ids = ['hovercraft'];
      }),
    ]);
    const entry = changed.exerciseById.get('goblet-kniebeuge')!;
    expect(entry.summary.blocking).toBeGreaterThan(0);
    expect(entry.issues[0]?.severity).toBe('error');
  });
});

describe('Filter und Suche', () => {
  it('liest gültige Werte, ignoriert ungültige und leere', () => {
    expect(parseFilters({})).toEqual({ tab: 'uebungen' });
    const filters = parseFilters({
      tab: 'vorlagen',
      status: 'draft',
      ziel: 'muscle_gain',
      tage: '3',
      ort: 'home',
      level: ['beginner', 'advanced'],
      muster: 'gibt-es-nicht',
      fehler: '',
      q: '  Kniebeuge ',
    });
    expect(filters).toEqual({
      tab: 'vorlagen',
      status: 'draft',
      ziel: 'muscle_gain',
      tage: 3,
      ort: 'home',
      level: 'beginner',
      q: 'Kniebeuge',
    });
    expect(parseFilters({ tab: '<script>', tage: '99', geraet: '../x' })).toEqual({
      tab: 'uebungen',
    });
    expect(hasActiveFilters(parseFilters({ tab: 'vorlagen' }))).toBe(false);
    expect(hasActiveFilters(parseFilters({ q: 'x' }))).toBe(true);
  });

  it('Suche ignoriert Groß-/Kleinschreibung, Umlaut-Punkte und ß', () => {
    expect(normalizeSearch('  Kreuzheben  RUMÄNISCH ')).toBe('kreuzheben rumanisch');
    expect(normalizeSearch('Fuß')).toBe('fuss');
    const found = filterExercises(catalog.exercises, parseFilters({ q: 'kniebeuge' }));
    expect(found.length).toBeGreaterThan(1);
    expect(found.every((e) => e.searchText.includes('kniebeuge'))).toBe(true);
    // Mehrere Wörter: alle müssen vorkommen.
    expect(
      filterExercises(catalog.exercises, parseFilters({ q: 'goblet kniebeuge' })).map(
        (e) => e.exercise.id,
      ),
    ).toEqual(['goblet-kniebeuge']);
    expect(filterExercises(catalog.exercises, parseFilters({ q: 'gibtsnicht' }))).toEqual([]);
  });

  it('Übungen nach Bewegungsmuster, Gerät und „ohne Geräte“', () => {
    const squats = filterExercises(catalog.exercises, parseFilters({ muster: 'squat' }));
    expect(squats.length).toBe(7); // 4 + Kniebeuge zum Stuhl / mit Pause / Tempo (K1)
    expect(squats.every((e) => e.exercise.movement_pattern === 'squat')).toBe(true);
    const dumbbells = filterExercises(catalog.exercises, parseFilters({ geraet: 'dumbbells' }));
    expect(dumbbells.length).toBeGreaterThan(0);
    expect(dumbbells.every((e) => e.exercise.equipment_ids.includes('dumbbells'))).toBe(true);
    const none = filterExercises(catalog.exercises, parseFilters({ geraet: 'ohne' }));
    expect(none.every((e) => e.exercise.equipment_ids.length === 0)).toBe(true);
  });

  it('Vorlagen nach Ziel, Level, Tagen und Ort (Matrix 3 × 2 × 2 × 2 + Körpergewicht 3 × 2 × 3)', () => {
    const one = filterTemplates(
      catalog.templates,
      parseFilters({ ziel: 'fat_loss', level: 'beginner', tage: '3', ort: 'gym' }),
    );
    expect(one.map((t) => t.template.id)).toEqual(['fettverlust-einsteiger-3t-studio']);
    // Zuhause: 12 mit Kurzhanteln/Bändern + 18 Körpergewicht; 4 Tage: 12 + 6 Körpergewicht; 2 Tage nur Körpergewicht.
    expect(filterTemplates(catalog.templates, parseFilters({ ort: 'home' }))).toHaveLength(30);
    expect(filterTemplates(catalog.templates, parseFilters({ tage: '4' }))).toHaveLength(18);
    const two = filterTemplates(catalog.templates, parseFilters({ tage: '2' }));
    expect(two).toHaveLength(6);
    expect(two.every((t) => t.template.id.endsWith('-koerpergewicht'))).toBe(true);
  });

  it('Status, Prüfergebnis und KI-Kennzeichnung', () => {
    expect(filterTemplates(catalog.templates, parseFilters({ status: 'published' }))).toEqual([]);
    const warned = filterTemplates(catalog.templates, parseFilters({ fehler: 'gelb' }));
    const clean = filterTemplates(catalog.templates, parseFilters({ fehler: 'ohne' }));
    expect(warned.length + clean.length).toBe(42);
    expect(filterTemplates(catalog.templates, parseFilters({ fehler: 'rot' }))).toEqual([]);
    expect(filterExercises(catalog.exercises, parseFilters({ ki: 'offen' }))).toHaveLength(80);
    expect(filterExercises(catalog.exercises, parseFilters({ ki: 'geprueft' }))).toEqual([]);
  });

  it('nur gültige IDs für Detailseiten', () => {
    expect(isContentId('goblet-kniebeuge')).toBe(true);
    expect(isContentId('../etc/passwd')).toBe(false);
    expect(isContentId('Goblet')).toBe(false);
    expect(isContentId('a'.repeat(81))).toBe(false);
  });
});

describe('Kennzahlen einer Vorlage', () => {
  const entry = catalog.templateById.get('muskelaufbau-fortgeschritten-3t-studio')!;

  it('Wochensätze: große Muskelgruppen immer, Zielbereich aus Ziel/Level', () => {
    const bars = volumeBars(entry.template, catalog.exerciseById);
    const muscles = bars.map((bar) => bar.muscle);
    for (const large of ['chest', 'lats', 'upper_back', 'quadriceps', 'hamstrings', 'glutes']) {
      expect(muscles).toContain(large);
    }
    // Muskelaufbau · Fortgeschritten: 10–22 Wochensätze.
    expect(bars.every((bar) => bar.max === 22)).toBe(true);
    // Startbestand: seitliche Schulter 7,5 Sätze → unter dem Ziel (gelber Hinweis V11).
    expect(bars.find((bar) => bar.muscle === 'side_delts')).toMatchObject({
      sets: 7.5,
      state: 'low',
    });
    // Unterarme haben nur eine Obergrenze.
    const forearms = bars.find((bar) => bar.muscle === 'forearms');
    if (forearms) expect(forearms.min).toBeNull();
  });

  it('Dauer je Einheit und Drücken/Ziehen', () => {
    const stats = sessionStats(entry.template);
    expect(stats).toHaveLength(entry.template.sessions_per_week);
    expect(stats.every((s) => s.estimatedMinutes > 0)).toBe(true);
    expect(stats.every((s) => s.withinWindow)).toBe(true);
    const pushPull = pushPullStats(entry.template, catalog.exerciseById);
    expect(pushPull.push).toBeGreaterThan(0);
    expect(pushPull.pull).toBeGreaterThan(0);
  });
});
