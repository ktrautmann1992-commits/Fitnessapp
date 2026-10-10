import { describe, expect, it } from 'vitest';

import type { EquipmentLocation } from '../enums';
import { equipmentProfile } from '../plan/equipment-profile';
import { type GeneratedPlan, generateTrainingPlan } from '../plan/generate';
import type { PlanInputsInput } from '../plan/inputs';
import { planSafetyRules, type PlanSafetyRules } from '../plan/safety';
import { FULL_HOME, MONDAY, person, repoLibrary } from '../plan/test-library';
import { pref } from '../plan/swap-test-helpers';
import type { StoredSession } from '../plan/view';
import {
  type PrintBlock,
  type PrintDocument,
  printDocumentSchema,
  type PrintText,
} from './document';
import {
  buildTrainingPlanDocument,
  type ExportDisplayContext,
  type ExportProgressByLocation,
  type TrainingPlanExportOptionsInput,
  trainingPlanExportOptionsSchema,
} from './training-plan-document';

const library = repoLibrary();

function generate(inputs: PlanInputsInput): GeneratedPlan {
  const result = generateTrainingPlan(inputs, library, MONDAY);
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}

function stored(plan: GeneratedPlan): StoredSession[] {
  return plan.sessions.map((s, i) => ({
    ...s,
    id: `s${i}`,
    status: 'planned',
    original_date: null,
  }));
}

function displayFor(inputs: PlanInputsInput, rules?: PlanSafetyRules): ExportDisplayContext {
  const home = (inputs.homeEquipment ?? []).map((item) => ({
    equipmentId: item.equipmentId,
    weightsKg: item.weightsKg ?? [],
    barKg: item.barKg ?? null,
  }));
  return {
    rules: rules ?? planSafetyRules(inputs, MONDAY),
    previousStartGroup: 'beginner',
    library: library.exercises,
    profiles: new Map<EquipmentLocation, ReturnType<typeof equipmentProfile>>([
      ['gym', equipmentProfile('gym', home)],
      ['home', equipmentProfile('home', home)],
    ]),
  };
}

function build(
  inputs: PlanInputsInput,
  options: Partial<TrainingPlanExportOptionsInput> = {},
  extra: {
    rules?: PlanSafetyRules;
    progress?: ExportProgressByLocation;
    substituteLibrary?: ExportDisplayContext['substituteLibrary'];
    sessions?: (s: StoredSession[]) => StoredSession[];
    preferences?: NonNullable<ExportDisplayContext['swap']>['preferences'];
    swapRules?: PlanSafetyRules;
  } = {},
): PrintDocument {
  const plan = generate(inputs);
  const sessions = extra.sessions ? extra.sessions(stored(plan)) : stored(plan);
  const result = buildTrainingPlanDocument(
    plan,
    sessions,
    {
      ...displayFor(inputs, extra.rules),
      ...(extra.substituteLibrary ? { substituteLibrary: extra.substituteLibrary } : {}),
      ...(extra.preferences
        ? {
            swap: {
              preferences: extra.preferences,
              swapRules: extra.swapRules ?? extra.rules ?? planSafetyRules(inputs, MONDAY),
            },
          }
        : {}),
    },
    extra.progress ?? null,
    { onDate: MONDAY, ...options },
  );
  if (!result.ok) throw new Error(result.error);
  expect(printDocumentSchema.safeParse(result.document).success).toBe(true);
  return result.document;
}

const codesOf = (doc: PrintDocument): string[] =>
  JSON.stringify(doc).match(/"code":"[^"]+"/g) ?? [];

const tables = (doc: PrintDocument) =>
  doc.sections.filter((b): b is Extract<PrintBlock, { type: 'table' }> => b.type === 'table');

const exerciseTables = (doc: PrintDocument) =>
  tables(doc).filter((t) => t.caption.kind === 'text' && t.caption.code === 'session.exercises');

/** Seiten mit Kraft-Einheiten: Überschrift (Inhalt) direkt nach einem Seitenumbruch. */
function sessionPages(doc: PrintDocument): PrintBlock[][] {
  const pages: PrintBlock[][] = [[]];
  for (const block of doc.sections) {
    if (block.type === 'pageBreak') pages.push([]);
    (pages.at(-1) as PrintBlock[]).push(block);
  }
  return pages.filter((page) =>
    page.some(
      (b) =>
        b.type === 'table' && b.caption.kind === 'text' && b.caption.code === 'session.exercises',
    ),
  );
}

const valueOf = (page: PrintBlock[], code: string): PrintText | undefined => {
  const kv = page.find((b) => b.type === 'keyValue');
  return kv?.type === 'keyValue'
    ? kv.items.find((i) => i.label.kind === 'text' && i.label.code === code)?.value
    : undefined;
};

describe('trainingPlanExportOptionsSchema', () => {
  it('Standard: ohne Namen, 4 Mitschreib-Spalten hochkant', () => {
    expect(trainingPlanExportOptionsSchema.parse({ onDate: MONDAY })).toEqual({
      onDate: MONDAY,
      includeName: false,
      name: null,
      logColumns: 4,
      landscape: false,
    });
  });

  it('lehnt ungültige Optionen ab (B9: hochkant höchstens 4 Spalten)', () => {
    const bad: unknown[] = [
      {},
      { onDate: '05.10.2026' },
      { onDate: MONDAY, logColumns: 5 },
      { onDate: MONDAY, logColumns: -1 },
      { onDate: MONDAY, logColumns: 2.5 },
      { onDate: MONDAY, logColumns: 9, landscape: true },
      { onDate: MONDAY, includeName: true },
      { onDate: MONDAY, includeName: true, name: '   ' },
      { onDate: MONDAY, name: 'x'.repeat(61) },
      { onDate: MONDAY, name: 'Anna\u0000' },
      { onDate: MONDAY, includeName: true, name: 'Anna\u202Eabc' },
      { onDate: MONDAY, level: 'beginner' },
    ];
    for (const value of bad) {
      expect(trainingPlanExportOptionsSchema.safeParse(value).success, JSON.stringify(value)).toBe(
        false,
      );
    }
    expect(
      trainingPlanExportOptionsSchema.safeParse({ onDate: MONDAY, logColumns: 8, landscape: true })
        .success,
    ).toBe(true);
  });

  it('ungültige Optionen → Fehler statt Dokument; leerer Plan → no_sessions', () => {
    const inputs = person();
    const plan = generate(inputs);
    expect(
      buildTrainingPlanDocument(plan, stored(plan), displayFor(inputs), null, {
        onDate: MONDAY,
        logColumns: 6,
      }),
    ).toEqual({ ok: false, error: 'invalid_options' });
    expect(
      buildTrainingPlanDocument(plan, [], displayFor(inputs), null, { onDate: MONDAY }),
    ).toEqual({ ok: false, error: 'no_sessions' });
  });

  it('Bibliothek fehlt → library_missing statt leerer Einheiten', () => {
    const inputs = person();
    const plan = generate(inputs);
    expect(
      buildTrainingPlanDocument(
        plan,
        stored(plan),
        { ...displayFor(inputs), library: null },
        null,
        { onDate: MONDAY },
      ),
    ).toEqual({ ok: false, error: 'library_missing' });
  });
});

describe('buildTrainingPlanDocument – Deckblatt', () => {
  it('Titel und Dateiname ohne Namen; Name nur auf Wunsch (Standard aus)', () => {
    const without = build(person());
    expect(JSON.stringify(without)).not.toContain('cover.label.name');
    expect(without.meta.fileName).toBe('alpha5-trainingsplan-2026-10-05');
    expect(without.meta.title).toEqual({ kind: 'text', code: 'doc.title', params: {} });

    const withName = build(person(), { includeName: true, name: '  Anna  ' });
    expect(JSON.stringify(withName.sections.slice(0, 5))).toContain('"value":"Anna"');
    expect(withName.meta.fileName).not.toContain('anna');
    expect(JSON.stringify(withName.meta)).not.toContain('Anna');
    // Name ohne includeName wird ignoriert.
    expect(JSON.stringify(build(person(), { name: 'Anna' }))).not.toContain('Anna');
  });

  it('Planname aus Ziel und Tagen – ohne Level und ohne Vorlagenname (B1)', () => {
    const doc = build(person({ experienceLevel: 'advanced' }));
    const name = doc.sections.find(
      (b) => b.type === 'heading' && b.text.kind === 'text' && b.text.code === 'plan.name',
    );
    expect(name).toMatchObject({
      text: {
        params: { goal: 'muscle_gain', discipline: null, strengthDays: 3, enduranceDays: 0 },
      },
    });
    const json = JSON.stringify(doc);
    expect(json).not.toMatch(/Einsteiger|Fortgeschritten|beginner|advanced|competitive/);
    expect(json).not.toContain('Muskelaufbau ·');
  });

  it('neutraler Arzt-Hinweis und Fußzeile auf JEDEM Dokument, auch ohne Gesundheitsangaben (B1)', () => {
    for (const inputs of [
      person(),
      person({ healthScreening: { flags: ['injury', 'conservative_plan'] } }),
      person({ healthScreening: null }),
    ]) {
      const doc = build(inputs);
      expect(doc.sections).toContainEqual({
        type: 'notice',
        title: { kind: 'text', code: 'notice.medical.title', params: {} },
        text: { kind: 'text', code: 'notice.medical', params: {} },
      });
      expect(doc.meta.footer).toEqual({ kind: 'text', code: 'doc.footer', params: {} });
    }
  });

  it('keine Gesundheitsangaben, kein Geburtsdatum, keine Zyklus- oder Körperdaten im Modell (B1, B11)', () => {
    const inputs = person({
      healthScreening: { flags: ['pregnancy', 'medication', 'conservative_plan'] },
      birthDate: '1960-03-04',
    });
    const json = JSON.stringify(build(inputs));
    expect(json).not.toMatch(
      /pregnan|schwanger|flag|medication|injury|1960|birth|cycle|zyklus|weight_kg|body_|body_?weight_?kg|cautious|medical_notice|uses_health/i,
    );
  });

  it('Stand, Zeitraum, Tage und Orte', () => {
    const doc = build(person({ preferredDays: [1, 3, 5] }));
    const kv = doc.sections.find((b) => b.type === 'keyValue');
    expect(kv).toMatchObject({
      items: [
        { label: { code: 'cover.label.period' }, value: { code: 'value.dateRange' } },
        {
          label: { code: 'cover.label.days' },
          value: { params: { count: 3, weekdays: [1, 3, 5] } },
        },
        {
          label: { code: 'cover.label.locations' },
          value: { params: { locations: ['gym'], endurance: false } },
        },
        { label: { code: 'cover.label.asOf' }, value: { kind: 'date', iso: MONDAY } },
      ],
    });
  });
});

describe('buildTrainingPlanDocument – Wochen und Tage', () => {
  it('1 Trainingstag: Wochenübersicht mit 7 Spalten, Ruhetage, eine Seite je Einheit', () => {
    const doc = build(person({ sessionsPerWeek: 1, preferredDays: [3] }));
    const week = tables(doc)[0];
    expect(week?.columns).toHaveLength(8);
    for (const row of week?.rows ?? []) {
      expect(row.cells).toHaveLength(7);
      const training = row.cells.filter(
        (c) => !(c[0]?.kind === 'text' && c[0].code === 'cell.rest'),
      );
      expect(training.length).toBeLessThanOrEqual(1);
    }
    for (const page of sessionPages(doc)) {
      expect(valueOf(page, 'session.label.days')).toEqual({
        kind: 'text',
        code: 'value.weekdaysLong',
        params: { weekdays: [3] },
      });
    }
    expect(sessionPages(doc).length).toBeGreaterThanOrEqual(1);
  });

  it('7 Trainingstage (Kraft + Ausdauer): keine Zelle doppelt, Ausdauer-Tabelle, Deckel greift', () => {
    const doc = build(
      person({
        goalType: 'endurance',
        discipline: '10k',
        schedule: {
          mode: 'fixed',
          slots: [
            { weekday: 1, kind: 'strength_gym', minutes: 45 },
            { weekday: 2, kind: 'endurance', minutes: 40 },
            { weekday: 3, kind: 'strength_gym', minutes: 45 },
            { weekday: 4, kind: 'endurance', minutes: 40 },
            { weekday: 5, kind: 'strength_gym', minutes: 45 },
            { weekday: 6, kind: 'endurance', minutes: 60 },
            { weekday: 7, kind: 'endurance', minutes: 30 },
          ],
        },
      }),
    );
    const week = tables(doc)[0];
    for (const row of week?.rows ?? []) {
      const training = row.cells.filter(
        (c) => !(c[0]?.kind === 'text' && c[0].code === 'cell.rest'),
      );
      expect(training.length).toBeLessThanOrEqual(5);
    }
    const endurance = tables(doc).filter(
      (t) => t.caption.kind === 'text' && t.caption.code === 'endurance.heading',
    );
    expect(endurance.length).toBeGreaterThan(0);
    for (const table of endurance) {
      expect(table.rows.length).toBeLessThanOrEqual(20);
      for (const row of table.rows) {
        expect(row.cells[3]?.[0]).toMatchObject({ code: 'value.effort' });
        expect(row.header[0]).toMatchObject({ code: 'value.dateWithWeekday' });
      }
    }
    expect(codesOf(doc)).toContain('"code":"endurance.modality"');
  });

  it('Erholungswoche ist in der Übersicht markiert (Text, nicht nur Farbe) und in der Legende erklärt', () => {
    const doc = build(person());
    const rows = tables(doc)[0]?.rows ?? [];
    expect(
      rows.some(
        (r) =>
          r.header[0]?.kind === 'text' &&
          r.header[0].code === 'week.row' &&
          r.header[0].params.deload,
      ),
    ).toBe(true);
    expect(doc.sections).toContainEqual(
      expect.objectContaining({
        type: 'paragraph',
        text: expect.objectContaining({
          code: 'week.legend',
          params: expect.objectContaining({ hasDeloadWeek: true }),
        }),
      }),
    );
  });

  it('gestrichene Einheit erscheint als „entfällt“, nicht als Ruhetag', () => {
    const doc = build(
      person(),
      {},
      {
        sessions: (s) => s.map((x, i) => (i === 0 ? { ...x, status: 'skipped' as const } : x)),
      },
    );
    expect(codesOf(doc)).toContain('"code":"cell.skipped"');
  });

  it('Plan-Hinweise: nur Gerätegründe', () => {
    const inputs = person({ trainingLocation: 'home', homeEquipment: [] });
    const plan = generate(inputs);
    const withNotes = {
      ...plan,
      notes: [
        ...plan.notes,
        'days_capped',
        'endurance_walk',
        'week_total_capped',
        'exercises_substituted',
      ] as GeneratedPlan['notes'],
    };
    const result = buildTrainingPlanDocument(withNotes, stored(plan), displayFor(inputs), null, {
      onDate: MONDAY,
    });
    expect(result.ok).toBe(true);
    const json = JSON.stringify(result);
    expect(json).toContain('"note":"exercises_substituted"');
    expect(json).not.toMatch(/days_capped|endurance_walk|week_total_capped/);
  });
});

describe('buildTrainingPlanDocument – Kraft-Einheiten', () => {
  it('höchstens 4 Mitschreib-Spalten hochkant; 0 Spalten möglich; 8 nur quer (B9)', () => {
    const four = exerciseTables(build(person()));
    expect(four.length).toBeGreaterThan(0);
    for (const table of four) {
      expect(table.columns.filter((c) => c.role === 'log')).toHaveLength(4);
      expect(table.rows.every((r) => r.cells.length === table.columns.length - 1)).toBe(true);
    }
    for (const table of exerciseTables(build(person(), { logColumns: 0 }))) {
      expect(table.columns.filter((c) => c.role === 'log')).toHaveLength(0);
    }
    const landscape = build(person(), { logColumns: 8, landscape: true });
    for (const table of exerciseTables(landscape)) {
      expect(table.columns.filter((c) => c.role === 'log')).toHaveLength(8);
    }
    const breaks = landscape.sections.filter((b) => b.type === 'pageBreak');
    expect(breaks.some((b) => b.type === 'pageBreak' && b.orientation === 'landscape')).toBe(true);
    // Deckblatt und Wochenübersicht bleiben hochkant.
    expect(breaks[0]).toEqual({ type: 'pageBreak', orientation: 'portrait' });
  });

  it('Gerätetausch → Markierung „ersetzt (Gerät fehlt)“', () => {
    // Studio-Vorlage, aber Training zu Hause nur mit Kurzhanteln → Tausch aus Gerätegründen.
    const inputs = person({
      schedule: {
        mode: 'fixed',
        slots: [
          { weekday: 1, kind: 'strength_gym', minutes: 60 },
          { weekday: 3, kind: 'strength_gym', minutes: 60 },
          { weekday: 6, kind: 'strength_home', minutes: 60 },
        ],
      },
      homeEquipment: [{ equipmentId: 'dumbbells', weightsKg: [4, 8, 12] }],
    });
    expect(codesOf(build(inputs))).toContain('"code":"mark.equipmentSwap"');
  });

  it('Tausch aus Sicherheitsgründen erzeugt KEINE Markierung (B1)', () => {
    const inputs = person({ experienceLevel: 'advanced' });
    // Plan ohne Flag erzeugt, Anzeige mit strengeren Regeln (neuer Gesundheits-Check mit Flag).
    const stricter = planSafetyRules(
      { ...inputs, healthScreening: { flags: ['injury', 'conservative_plan'] } },
      MONDAY,
    );
    const plain = build(inputs);
    const strict = build(inputs, {}, { rules: stricter });
    expect(codesOf(plain)).not.toContain('"code":"mark.equipmentSwap"');
    expect(codesOf(strict)).not.toContain('"code":"mark.equipmentSwap"');
    expect(JSON.stringify(strict)).not.toMatch(/adjusted|angepasst/);
    // Es wurde tatsächlich getauscht bzw. ausgeblendet (sonst prüft der Test nichts).
    const names = (doc: PrintDocument) =>
      exerciseTables(doc).flatMap((t) => t.rows.map((r) => JSON.stringify(r.header[0])));
    expect(names(strict)).not.toEqual(names(plain));
    // Die Regeln wirken trotzdem (RPE-Deckel).
    const rpes = exerciseTables(strict).flatMap((t) =>
      t.rows.map((r) =>
        r.cells[2]?.[0]?.kind === 'text' && r.cells[2][0].code === 'value.rpe'
          ? r.cells[2][0].params.rpe
          : 0,
      ),
    );
    expect(Math.max(...rpes)).toBeLessThanOrEqual(stricter.rpeMax);
  });

  /** Seiteninhalte der Einheiten (Übungen, Dosierung, Dauer, Aufwärmen) entfernen – Überschrift bleibt. */
  function withoutExercises(doc: PrintDocument) {
    const out: PrintBlock[] = [];
    let inSession = false;
    for (const block of doc.sections) {
      if (block.type === 'pageBreak') inSession = false;
      if (block.type === 'heading' && block.level === 2 && block.text.kind === 'data') {
        inSession = true;
        out.push(block);
        continue;
      }
      if (!inSession) out.push(block);
    }
    return { meta: doc.meta, sections: out };
  }

  const flaggedOf = (inputs: PlanInputsInput): PlanInputsInput => ({
    ...inputs,
    healthScreening: { flags: ['injury', 'conservative_plan'] },
  });

  it('Modell mit und ohne Gesundheits-Flag ist bis auf die Übungen identisch (B1)', () => {
    const base = person({ experienceLevel: 'advanced', preferredDays: [1, 3, 5] });
    expect(withoutExercises(build(flaggedOf(base)))).toEqual(withoutExercises(build(base)));
  });

  it('Einsteiger: gleich bis auf Übungen und Wochenrhythmus (Erholungswoche nach 4 statt 5 Wochen)', () => {
    // Der Rhythmus ist Trainingsinhalt (DELOAD_SCHEDULE) wie die Übungen; Text, Codes und Aufbau bleiben gleich.
    const base = person({ experienceLevel: 'beginner', preferredDays: [1, 3, 5] });
    const shape = (doc: PrintDocument) =>
      JSON.stringify(withoutExercises(doc), (key, value: unknown) =>
        key === 'rows' || key === 'from' || key === 'to' ? undefined : value,
      );
    expect(shape(build(flaggedOf(base)))).toBe(shape(build(base)));
    // Auch in den Zeilen (Wochen, Ausdauer) dieselben Codes und Inhalte – ohne Wochennummern und Daten (K1).
    const rowContent = (doc: PrintDocument) =>
      [
        ...new Set(
          tables(doc)
            .filter((t) => !(t.caption.kind === 'text' && t.caption.code === 'session.exercises'))
            .flatMap((t) => t.rows.flatMap((r) => [...r.header, ...r.cells.flat()]))
            .map((c) =>
              c.kind === 'text'
                ? c.code === 'week.row' || c.code.startsWith('value.')
                  ? c.code
                  : JSON.stringify(c)
                : c.kind === 'data'
                  ? c.value
                  : c.kind,
            ),
        ),
      ].sort();
    expect(rowContent(build(flaggedOf(base)))).toEqual(rowContent(build(base)));
  });

  it('Mo Studio / Sa Zuhause → zwei Fassungen mit eigenen Übungen und Gewichten (B8)', () => {
    const inputs = person({
      schedule: {
        mode: 'fixed',
        slots: [
          { weekday: 1, kind: 'strength_gym', minutes: 60 },
          { weekday: 6, kind: 'strength_home', minutes: 60 },
        ],
      },
      homeEquipment: [...FULL_HOME],
    });
    const plan = generate(inputs);
    const sessions = stored(plan);
    // Jede Übung bekommt je Ort ein anderes Gewicht.
    const allIds = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id)))];
    const progressFor = (kg: number) =>
      new Map(
        allIds.map((id) => [
          id,
          {
            result: {
              progress: { weightKg: kg, targetReps: null, extraSet: false, durationS: null },
              firstSessionRpeTarget: null,
            },
            steps: [],
          },
        ]),
      );
    const progress: ExportProgressByLocation = new Map([
      ['gym', progressFor(30)],
      ['home', progressFor(12)],
    ]);
    const doc = build(inputs, {}, { progress });
    const pages = sessionPages(doc);
    const byLocation = (location: EquipmentLocation) =>
      pages.filter((p) => {
        const v = valueOf(p, 'session.label.location');
        return v?.kind === 'text' && v.code === 'location' && v.params.location === location;
      });
    const gym = byLocation('gym');
    const home = byLocation('home');
    expect(gym.length).toBeGreaterThan(0);
    expect(home.length).toBeGreaterThan(0);
    for (const page of gym) {
      expect(valueOf(page, 'session.label.days')).toMatchObject({ params: { weekdays: [1] } });
    }
    for (const page of home) {
      expect(valueOf(page, 'session.label.days')).toMatchObject({ params: { weekdays: [6] } });
    }
    const weights = (pagesOf: PrintBlock[][]) =>
      new Set(
        pagesOf.flatMap((p) =>
          p.flatMap((b) =>
            b.type === 'table'
              ? b.rows
                  .flatMap((r) => r.cells[4] ?? [])
                  .map((c) => (c.kind === 'text' && c.code === 'value.kg' ? c.params.kg : null))
              : [],
          ),
        ),
      );
    expect([...weights(gym)].filter((w) => w !== null)).toContain(30);
    expect([...weights(home)].filter((w) => w !== null)).toContain(12);
    expect(weights(home).has(30)).toBe(false);
  });

  it('ohne Fortschritt: Gewichts-Zelle leer (Gewichtsübung) bzw. eigener Text (Wächter S2); Wdh. als Spanne', () => {
    for (const table of exerciseTables(build(person()))) {
      for (const row of table.rows) {
        const id = (row.header[0] as { value: string }).value;
        const exercise = [...library.exercises.values()].find((e) => e.name_de === id);
        const expected =
          exercise?.load_type === 'weight'
            ? []
            : [
                {
                  kind: 'text',
                  code: `load.${exercise?.load_type === 'time' ? 'none' : exercise?.load_type}`,
                  params: {},
                },
              ];
        expect(row.cells[4], id).toEqual(expected);
        expect(row.cells[1]?.[0]).toMatchObject({
          code: expect.stringMatching(/^value\.(reps|seconds)$/),
        });
      }
    }
  });

  it('Körpergewicht-Plan zu Hause ohne Geräte: kein Gewicht, kein „Startgewicht“, keine Gerätemarkierung', () => {
    const doc = build(
      person({
        trainingLocation: 'home',
        homeEquipment: [],
        preferredDays: [2, 4],
        sessionsPerWeek: 2,
      }),
    );
    const pages = sessionPages(doc);
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(valueOf(page, 'session.label.location')).toMatchObject({
        params: { location: 'home' },
      });
    }
    for (const table of exerciseTables(doc)) {
      for (const row of table.rows) {
        expect(row.cells[4]?.[0]).toMatchObject({ code: expect.stringMatching(/^load\./) });
      }
    }
    expect(codesOf(doc)).not.toContain('"code":"mark.equipmentSwap"');
    // Anleitung, Legende und Hinweis ohne Gewicht (S2).
    const json = JSON.stringify(doc);
    expect(json).not.toContain('"hasWeight":true');
    expect(json).toContain('"code":"cover.howTo","params":{"logColumns":4,"hasWeight":false}');
  });
});

describe('buildTrainingPlanDocument – Wächter-Auflagen P1+P2', () => {
  it('S1: „Tage egal“ mit Studio und Zuhause → Ort je Fassung, Gewichte vom richtigen Ort', () => {
    const inputs = person({
      schedule: {
        mode: 'flex',
        slots: [
          { kind: 'strength_gym', minutes: 60 },
          { kind: 'strength_home', minutes: 45 },
        ],
      },
      homeEquipment: [{ equipmentId: 'dumbbells', weightsKg: [4, 8, 12] }],
    });
    const plan = generate(inputs);
    const ids = [...new Set(plan.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id)))];
    const at = (kg: number, steps: number[]) =>
      new Map(
        ids.map((id) => [
          id,
          {
            result: {
              progress: { weightKg: kg, targetReps: null, extraSet: false, durationS: null },
              firstSessionRpeTarget: null,
            },
            steps,
          },
        ]),
      );
    const doc = build(
      inputs,
      {},
      {
        progress: new Map([
          ['gym', at(20, [])],
          ['home', at(20, [4, 8, 12])],
        ]),
      },
    );
    const pages = sessionPages(doc);
    const locationOf = (page: PrintBlock[]) => {
      const v = valueOf(page, 'session.label.location');
      return v?.kind === 'text' && v.code === 'location' ? v.params.location : null;
    };
    const kgs = (page: PrintBlock[]) =>
      page.flatMap((b) =>
        b.type === 'table'
          ? b.rows
              .flatMap((r) => r.cells[4] ?? [])
              .flatMap((c) => (c.kind === 'text' && c.code === 'value.kg' ? [c.params.kg] : []))
          : [],
      );
    const gym = pages.filter((p) => locationOf(p) === 'gym');
    const home = pages.filter((p) => locationOf(p) === 'home');
    expect(gym.length).toBeGreaterThan(0);
    expect(home.length).toBeGreaterThan(0);
    expect(gym.flatMap(kgs)).toContain(20);
    expect(home.flatMap(kgs).every((kg) => kg <= 12)).toBe(true);
    // Studio-Fassung enthält eine Übung, die zu Hause nicht machbar ist.
    const homeProfile = equipmentProfile('home', [
      { equipmentId: 'dumbbells', weightsKg: [4, 8, 12] },
    ]);
    for (const page of home) {
      for (const b of page) {
        if (b.type !== 'table') continue;
        for (const r of b.rows) {
          const name = (r.header[0] as { value: string }).value;
          const ex = [...library.exercises.values()].find((e) => e.name_de === name);
          expect(ex && ex.equipment_ids.every((id) => homeProfile.available.has(id)), name).toBe(
            true,
          );
        }
      }
    }
    const cover = doc.sections.find((b) => b.type === 'keyValue');
    expect(JSON.stringify(cover)).toContain('"locations":["gym","home"]');
  });

  it('K6: Legende kennt Ruhetage, Einstieg und Gewicht', () => {
    const doc = build(person());
    const legend = doc.sections.find(
      (b) => b.type === 'paragraph' && b.text.kind === 'text' && b.text.code === 'week.legend',
    );
    expect(legend).toMatchObject({
      text: { params: { hasRestDay: true, hasWeight: true } },
    });
  });

  it('K7: alle Übungen ausgeblendet → neutraler Hinweis statt leerer Tabelle', () => {
    const inputs = person();
    const rules: PlanSafetyRules = {
      ...planSafetyRules(inputs, MONDAY),
      excludedCautionTags: ['spinal_loading'],
    };
    const doc = build(
      inputs,
      {},
      {
        rules,
        sessions: (all) =>
          all.map((s) => ({
            ...s,
            exercises: s.exercises.slice(0, 1).map((e) => ({
              ...e,
              exercise_id: 'kniebeuge-langhantel',
              source_exercise_id: 'kniebeuge-langhantel',
            })),
          })),
        substituteLibrary: new Map(),
      },
    );
    expect(exerciseTables(doc)).toHaveLength(0);
    expect(codesOf(doc)).toContain('"code":"session.noExercises"');
    expect(JSON.stringify(doc)).not.toMatch(/spinal|hidden|ausgeblendet/i);
  });
});

describe('buildTrainingPlanDocument – Seitenumbruch der Einheiten (Wächter K2)', () => {
  /** Jede Einheit: 8 Übungen mit langen Namen, Supersätze und sehr langes Aufwärmen/Cool-down. */
  const heavy = (all: StoredSession[]) =>
    all.map((s) => {
      const first = s.exercises[0];
      if (s.kind !== 'strength' || !first) return s;
      const long = 'Locker einlaufen und mobilisieren. '.repeat(17).slice(0, 600);
      return {
        ...s,
        warmup_de: long,
        cooldown_de: long,
        exercises: Array.from({ length: 8 }, (_, i) => ({
          ...first,
          order_no: i + 1,
          exercise_name_de: `${first.exercise_name_de} – sehr langsam, kontrolliert und mit voller Bewegungsamplitude`,
          superset_group: i < 2 ? 'A' : null,
        })),
      };
    });

  const continued = (doc: PrintDocument) =>
    doc.sections.filter(
      (b) => b.type === 'heading' && b.text.kind === 'text' && b.text.code === 'session.continued',
    );

  it('normale Einheiten bleiben auf einer Seite (keine Fortsetzung)', () => {
    for (const options of [{}, { logColumns: 8, landscape: true }]) {
      const doc = build(person(), options);
      expect(continued(doc)).toHaveLength(0);
    }
  });

  it('zu lange Einheit → Fortsetzungsseite; jede Übung genau einmal, Cool-down am Ende', () => {
    for (const options of [{}, { logColumns: 8, landscape: true }]) {
      const doc = build(person(), options, { sessions: heavy });
      const sessionsCount = new Set(exerciseTables(doc).map((t) => JSON.stringify(t.caption))).size;
      expect(continued(doc).length).toBeGreaterThanOrEqual(sessionsCount);
      const rows = exerciseTables(doc).reduce((sum, t) => sum + t.rows.length, 0);
      expect(rows).toBe(sessionsCount * 8);
      // Fortsetzung beginnt immer mit einem Seitenumbruch in derselben Ausrichtung.
      doc.sections.forEach((b, i) => {
        if (b.type === 'heading' && b.text.kind === 'text' && b.text.code === 'session.continued') {
          expect(doc.sections[i - 1]).toEqual({
            type: 'pageBreak',
            orientation: 'landscape' in options ? 'landscape' : 'portrait',
          });
        }
      });
      expect(doc.sections.at(-1)?.type).toBe('paragraph');
    }
  });
});

describe('buildTrainingPlanDocument – Übungs-Tausch (Etappe T1, docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 7.3)', () => {
  const bodyweight = person({
    trainingLocation: 'home',
    homeEquipment: [],
    preferredDays: [2, 4],
    sessionsPerWeek: 2,
  });

  it('ohne bzw. mit leeren Präferenzen: identisches Dokument (Regression)', () => {
    for (const inputs of [
      person(),
      bodyweight,
      person({ sessionsPerWeek: 1, preferredDays: [3] }),
    ]) {
      expect(build(inputs, {}, { preferences: [] })).toEqual(build(inputs));
    }
  });

  it('„getauscht (deine Wahl)“ mit einer Übung, die sicher einen Kandidaten hat', () => {
    const doc = build(
      person(),
      {},
      {
        sessions: (all) =>
          all.map((s) =>
            s.kind === 'strength'
              ? {
                  ...s,
                  exercises: s.exercises.slice(0, 1).map((e) => ({
                    ...e,
                    exercise_id: 'goblet-kniebeuge',
                    source_exercise_id: 'goblet-kniebeuge',
                    exercise_name_de: 'Goblet-Kniebeuge',
                  })),
                }
              : s,
          ),
        preferences: [pref('goblet-kniebeuge', 'gym', 'dislike')],
      },
    );
    expect(codesOf(doc)).toContain('"code":"mark.preferenceSwap"');
    expect(JSON.stringify(doc)).not.toContain('Goblet-Kniebeuge');
  });

  it('„Hier nicht machbar“ ohne Alternative → neutraler Druckhinweis „ausgelassen (deine Wahl)“, nie „Plan neu erstellen“', () => {
    const doc = build(
      person(),
      {},
      {
        sessions: (all) =>
          all.map((s) =>
            s.kind === 'strength'
              ? {
                  ...s,
                  exercises: ['liegestuetz', 'tuerrahmen-rudern'].map((id, i) => ({
                    ...s.exercises[0]!,
                    order_no: i + 1,
                    exercise_id: id,
                    source_exercise_id: id,
                  })),
                }
              : s,
          ),
        // Im Studio alle Ruder-Alternativen ausschließen.
        preferences: [
          pref('tuerrahmen-rudern', 'gym', 'not_feasible'),
          ...[...library.exercises.values()]
            .filter((e) => e.movement_pattern === 'horizontal_pull' && e.id !== 'tuerrahmen-rudern')
            .map((e) => pref(e.id, 'gym', 'dislike')),
        ],
      },
    );
    const codes = codesOf(doc);
    expect(codes).toContain('"code":"session.preferenceOmitted"');
    expect(codes).not.toContain('"code":"session.noExercises"');
    expect(JSON.stringify(doc)).toContain(
      '"code":"session.preferenceOmitted","params":{"count":1}',
    );
  });

  it('K7: gleiche angezeigte Übung, einmal getauscht und einmal geplant → getrennte Fassungen, Markierung je Fassung', () => {
    let n = 0;
    const doc = build(
      person(),
      {},
      {
        sessions: (all) =>
          all.map((s) => {
            if (s.kind !== 'strength') return s;
            n += 1;
            const id = n % 2 === 0 ? 'goblet-kniebeuge' : 'kniebeuge-koerpergewicht';
            return {
              ...s,
              template_day_index: 0,
              name_de: 'Ganzkörper',
              exercises: s.exercises.slice(0, 1).map((e) => ({
                ...e,
                exercise_id: id,
                source_exercise_id: id,
              })),
            };
          }),
        preferences: [pref('goblet-kniebeuge', 'gym', 'dislike', 'kniebeuge-koerpergewicht')],
      },
    );
    const marks = exerciseTables(doc).map((t) =>
      JSON.stringify(t.rows).includes('"code":"mark.preferenceSwap"'),
    );
    expect(marks.sort()).toEqual([false, true]);
  });

  it('alle Übungen „Hier nicht machbar“ → nur der neutrale Hinweis, keine leere Tabelle', () => {
    const doc = build(
      person(),
      {},
      {
        sessions: (all) =>
          all.map((s) =>
            s.kind === 'strength'
              ? {
                  ...s,
                  exercises: s.exercises.slice(0, 1).map((e) => ({
                    ...e,
                    exercise_id: 'tuerrahmen-rudern',
                    source_exercise_id: 'tuerrahmen-rudern',
                  })),
                }
              : s,
          ),
        preferences: [...library.exercises.keys()].map((id) => pref(id, 'gym', 'not_feasible')),
      },
    );
    expect(exerciseTables(doc)).toHaveLength(0);
    expect(codesOf(doc)).toContain('"code":"session.preferenceOmitted"');
    expect(codesOf(doc)).not.toContain('"code":"session.noExercises"');
  });
});
