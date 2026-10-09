import { describe, expect, it } from 'vitest';

import { GLOSSARY_LIMITS } from '../constants';
import { MOVEMENT_PATTERNS } from '../enums';
import { selectPlanContent, type PlanLibrary } from '../plan/content-pool';
import { equipmentProfile } from '../plan/equipment-profile';
import { planSafetyRules } from '../plan/safety';
import { loadRepoContentFiles, MONDAY, repoLibrary } from '../plan/test-library';
import {
  equipmentNames,
  findGlossaryExercise,
  GLOSSARY_GROUP_IDS,
  GLOSSARY_GROUPS,
  glossaryEntry,
  type GlossaryContext,
  glossaryGroupOf,
  glossarySearchOptionsSchema,
  normalizeSearchText,
  searchExercises,
  similarExercises,
} from './glossary';
import type { Exercise } from './schemas';
import { makeExercise } from './test-fixtures';
import { validateContent } from './validate';

/**
 * Übungs-Glossar (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 7.1, Etappe G1): Suche, Filter, Anzeigemodell und alle
 * Grenzfälle aus dem Plan – inklusive Echte-Inhalte-Test über den ganzen Inhaltsstand.
 */

const rules = (flags: string[] | null = [], birthDate = '1990-05-15') =>
  planSafetyRules(
    {
      experienceLevel: 'beginner',
      birthDate,
      healthScreening: flags === null ? null : { flags: flags as never[] },
    },
    MONDAY,
  );
const NORMAL = rules();

function lib(exercises: Exercise[], archived: Exercise[] = []): PlanLibrary {
  const map = new Map(exercises.map((e) => [e.id, e] as const));
  return {
    exercises: map,
    templates: [],
    containsDrafts: exercises.some((e) => e.status === 'draft'),
    displayExercises: new Map([...map, ...archived.map((e) => [e.id, e] as const)]),
  };
}

const kniebeuge = makeExercise({
  id: 'kniebeuge-langhantel',
  name_de: 'Kniebeuge mit Langhantel',
  name_en: 'Barbell Back Squat',
  aliases_de: ['Back Squat'],
  equipment_ids: ['barbell', 'power_rack'],
  difficulty: 3,
  caution_tags: ['spinal_loading'],
  alternatives: [
    { alternative_id: 'goblet-kniebeuge', reason: 'other_equipment', priority: 2 },
    { alternative_id: 'kniebeuge-koerpergewicht', reason: 'easier', priority: 3 },
    { alternative_id: 'pistol-squat', reason: 'harder', priority: 1 },
  ],
});
const goblet = makeExercise({
  id: 'goblet-kniebeuge',
  name_de: 'Goblet-Kniebeuge',
  name_en: 'Goblet Squat',
  equipment_ids: ['dumbbells'],
  difficulty: 2,
  alternatives: [{ alternative_id: 'wandsitzen', reason: 'easier', priority: 1 }],
});
const bodyweightSquat = makeExercise({
  id: 'kniebeuge-koerpergewicht',
  name_de: 'Kniebeuge ohne Gewicht',
  name_en: 'Air Squat',
  aliases_de: ['Luftkniebeuge'],
  equipment_ids: [],
  load_type: 'bodyweight',
  difficulty: 1,
});
const pistol = makeExercise({
  id: 'pistol-squat',
  name_de: 'Pistol Squat',
  name_en: 'Pistol Squat',
  equipment_ids: [],
  load_type: 'bodyweight',
  difficulty: 3,
  caution_tags: ['high_skill'],
});
const wallSit = makeExercise({
  id: 'wandsitzen',
  name_de: 'Wandsitzen',
  name_en: 'Wall Sit',
  equipment_ids: [],
  load_type: 'time',
  difficulty: 1,
});
const rdl = makeExercise({
  id: 'rumaenisches-kreuzheben',
  name_de: 'Rumänisches Kreuzheben',
  name_en: 'Romanian Deadlift',
  aliases_de: ['RDL'],
  movement_pattern: 'hinge',
  primary_muscles: ['hamstrings', 'glutes'],
  equipment_ids: ['barbell'],
  difficulty: 2,
  description_de: 'Hüftbeuge mit fast gestreckten Beinen für die hintere Kette und den Po.',
});
const bridge = makeExercise({
  id: 'glute-bridge',
  name_de: 'Glute Bridge',
  name_en: 'Glute Bridge',
  aliases_de: ['Beckenheben'],
  movement_pattern: 'hip_extension',
  primary_muscles: ['glutes'],
  equipment_ids: [],
  load_type: 'bodyweight',
  difficulty: 1,
  caution_tags: ['long_supine'],
  status: 'published',
  meta: {
    origin: 'manual',
    model: null,
    batch_id: null,
    created_on: '2026-10-03',
    expert_reviewed: true,
    reviewed_by: 'KT',
    reviewed_at: '2026-10-04',
    review_note: null,
  },
});
const cable = makeExercise({
  id: 'kabelrudern',
  name_de: 'Kabelrudern sitzend',
  name_en: 'Seated Cable Row',
  movement_pattern: 'horizontal_pull',
  primary_muscles: ['upper_back', 'lats'],
  equipment_ids: ['cable_station'],
  difficulty: 1,
});
const archivedRow = makeExercise({
  id: 'altes-rudern',
  name_de: 'Altes Rudern',
  name_en: 'Old Row',
  movement_pattern: 'horizontal_pull',
  primary_muscles: ['upper_back'],
  equipment_ids: [],
  status: 'archived',
});

const ALL = [kniebeuge, goblet, bodyweightSquat, pistol, wallSit, rdl, bridge, cable];
const LIB = lib(ALL, [archivedRow]);
const HOME_DUMBBELLS = equipmentProfile('home', [{ equipmentId: 'dumbbells', weightsKg: [10] }]);
const ids = (hits: { exercise: Exercise }[]) => hits.map((h) => h.exercise.id);
const ctx = (patch: Partial<GlossaryContext> = {}): GlossaryContext => ({
  library: LIB,
  rules: NORMAL,
  ...patch,
});

describe('normalizeSearchText', () => {
  it('Kleinschreibung, Umlaute, ß, Akzente', () => {
    expect(normalizeSearchText('Rumänisches')).toBe('rumaenisches');
    expect(normalizeSearchText('ÖSTERREICH Übung')).toBe('oesterreich uebung');
    expect(normalizeSearchText('Fußgelenk')).toBe('fussgelenk');
    expect(normalizeSearchText('Café Crème')).toBe('cafe creme');
  });

  it('Bindestriche, Satzzeichen, Emoji und mehrfacher Leerraum werden zu einem Leerzeichen', () => {
    expect(normalizeSearchText('  Goblet-Kniebeuge!!  ')).toBe('goblet kniebeuge');
    expect(normalizeSearchText('Kreuz\t heben 💪')).toBe('kreuz heben');
    expect(normalizeSearchText('💪🔥')).toBe('');
    expect(normalizeSearchText('')).toBe('');
  });
});

describe('Bereiche', () => {
  it('jedes Bewegungsmuster steht in genau einem Bereich', () => {
    const all = GLOSSARY_GROUP_IDS.flatMap((group) => GLOSSARY_GROUPS[group]);
    expect([...all].sort()).toEqual([...MOVEMENT_PATTERNS].sort());
    expect(new Set(all).size).toBe(all.length);
    expect(Object.keys(GLOSSARY_GROUPS).sort()).toEqual([...GLOSSARY_GROUP_IDS].sort());
  });

  it('Zuordnung wie im Plan', () => {
    expect(glossaryGroupOf('squat')).toBe('legs');
    expect(glossaryGroupOf('hinge')).toBe('hips');
    expect(glossaryGroupOf('elbow_extension')).toBe('push');
    expect(glossaryGroupOf('elbow_flexion')).toBe('pull');
    expect(glossaryGroupOf('core_flexion')).toBe('core');
    expect(glossaryGroupOf('carry')).toBe('conditioning');
  });
});

describe('searchExercises', () => {
  it('leere Suche bzw. nur Leerzeichen → alle (ohne Archivierte), nach deutschem Namen', () => {
    const all = searchExercises(LIB, {});
    expect(all).toHaveLength(ALL.length);
    expect(ids(all)).not.toContain('altes-rudern');
    expect(all.map((h) => h.exercise.name_de)).toEqual(
      [...ALL].map((e) => e.name_de).sort((a, b) => a.localeCompare(b, 'de')),
    );
    expect(all.every((h) => h.match === null)).toBe(true);
    expect(ids(searchExercises(LIB, { query: '   ' }))).toEqual(ids(all));
  });

  it('nur Sonderzeichen/Emoji → wie leere Suche, kein Fehler', () => {
    expect(searchExercises(LIB, { query: '💪🔥!?' })).toHaveLength(ALL.length);
  });

  it('200 Zeichen: auf GLOSSARY_LIMITS.queryMaxChars gekürzt, kein Fehler', () => {
    expect(searchExercises(LIB, { query: 'x'.repeat(200) })).toEqual([]);
    // Was vor der Grenze steht, zählt: „Wandsitzen“ + Leerzeichen bis 200 Zeichen findet die Übung.
    const padded = `Wandsitzen${' '.repeat(190)}`;
    expect(ids(searchExercises(LIB, { query: padded }))).toEqual(['wandsitzen']);
    // Hinter der Grenze wird abgeschnitten.
    const tooLate = `${' '.repeat(GLOSSARY_LIMITS.queryMaxChars)}zzz`;
    expect(searchExercises(LIB, { query: tooLate })).toHaveLength(ALL.length);
  });

  it('Groß/klein und Umlaute tolerant: „rumaenisch“, „RUMÄNISCH“ finden „Rumänisches Kreuzheben“', () => {
    for (const query of ['rumaenisch', 'RUMÄNISCH', 'Rumänisches']) {
      const hits = searchExercises(LIB, { query });
      expect(ids(hits)).toEqual(['rumaenisches-kreuzheben']);
      expect(hits[0]?.match).toBe('name_start');
    }
  });

  it('Wortgrenzen egal: „kreuz heben“ findet „Kreuzheben“, „kniebeuge langhantel“ über mehrere Wörter', () => {
    expect(ids(searchExercises(LIB, { query: 'kreuz heben' }))).toEqual([
      'rumaenisches-kreuzheben',
    ]);
    expect(ids(searchExercises(LIB, { query: 'kniebeuge langhantel' }))).toEqual([
      'kniebeuge-langhantel',
    ]);
  });

  it('Alias, englischer Name und Beschreibung', () => {
    expect(searchExercises(LIB, { query: 'rdl' })).toMatchObject([
      { exercise: { id: 'rumaenisches-kreuzheben' }, match: 'alias' },
    ]);
    expect(searchExercises(LIB, { query: 'beckenheben' })[0]?.match).toBe('alias');
    expect(searchExercises(LIB, { query: 'wall sit' })).toMatchObject([
      { exercise: { id: 'wandsitzen' }, match: 'name_en' },
    ]);
    expect(searchExercises(LIB, { query: 'hintere kette' })).toMatchObject([
      { exercise: { id: 'rumaenisches-kreuzheben' }, match: 'description' },
    ]);
  });

  it('Rangfolge: Name beginnt → Name enthält → Alias → englisch → Beschreibung; Gleichstand nach Name', () => {
    const hits = searchExercises(LIB, { query: 'kniebeuge' });
    expect(hits.slice(0, 3).map((h) => [h.exercise.id, h.match])).toEqual([
      ['kniebeuge-langhantel', 'name_start'],
      ['kniebeuge-koerpergewicht', 'name_start'],
      ['goblet-kniebeuge', 'name'],
    ]);
    // Danach nur Treffer in der Beschreibung („… Knie beugen …“), nach Name sortiert.
    const rest = hits.slice(3);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.every((h) => h.match === 'description')).toBe(true);
    expect(rest.map((h) => h.exercise.name_de)).toEqual(
      rest.map((h) => h.exercise.name_de).sort((a, b) => a.localeCompare(b, 'de')),
    );
    const squat = searchExercises(LIB, { query: 'squat' });
    expect(squat.map((h) => h.match)).toEqual(['name', 'alias', 'name_en', 'name_en']);
    expect(ids(squat)).toEqual([
      'pistol-squat',
      'kniebeuge-langhantel',
      'goblet-kniebeuge',
      'kniebeuge-koerpergewicht',
    ]);
  });

  it('Filter Ausrüstung: ohne Geräte · meine Geräte zu Hause · Studio (mit Geräten)', () => {
    expect(ids(searchExercises(LIB, { equipment: 'none' })).sort()).toEqual(
      ['glute-bridge', 'kniebeuge-koerpergewicht', 'pistol-squat', 'wandsitzen'].sort(),
    );
    // Zu Hause: ohne Geräte plus Kurzhanteln; ohne Heim-Profil nur ohne Geräte.
    expect(
      ids(searchExercises(LIB, { equipment: 'my_home' }, { homeProfile: HOME_DUMBBELLS })),
    ).toContain('goblet-kniebeuge');
    expect(
      ids(searchExercises(LIB, { equipment: 'my_home' }, { homeProfile: HOME_DUMBBELLS })),
    ).not.toContain('kabelrudern');
    expect(ids(searchExercises(LIB, { equipment: 'my_home' })).sort()).toEqual(
      ids(searchExercises(LIB, { equipment: 'none' })).sort(),
    );
    // Studio: nur Übungen mit Geräten, auch reine Studio-Geräte (Kabelzug).
    const gym = ids(searchExercises(LIB, { equipment: 'gym' }));
    expect(gym).toContain('kabelrudern');
    expect(gym).not.toContain('wandsitzen');
    expect(ids(searchExercises(LIB, { equipment: null }))).toHaveLength(ALL.length);
  });

  it('Filter Bereich und Schwierigkeit (mehrere = oder), mit Suchwort kombiniert', () => {
    expect(ids(searchExercises(LIB, { groups: ['hips'] })).sort()).toEqual([
      'glute-bridge',
      'rumaenisches-kreuzheben',
    ]);
    expect(ids(searchExercises(LIB, { groups: ['hips', 'pull'] }))).toHaveLength(3);
    expect(ids(searchExercises(LIB, { difficulty: [3] })).sort()).toEqual([
      'kniebeuge-langhantel',
      'pistol-squat',
    ]);
    expect(
      ids(searchExercises(LIB, { query: 'kniebeuge', groups: ['legs'], difficulty: [3] })),
    ).toEqual(['kniebeuge-langhantel', 'pistol-squat']);
    expect(searchExercises(LIB, { query: 'kniebeuge', groups: ['core'] })).toEqual([]);
  });

  it('Bibliothek leer bzw. null → leere Liste', () => {
    expect(searchExercises(null, {})).toEqual([]);
    expect(searchExercises(lib([]), { query: 'kniebeuge' })).toEqual([]);
  });

  it('Entwurf vs. veröffentlicht: live (ohne Entwürfe) nur freigegebene Übungen', () => {
    const result = { exercises: ALL, templates: [], issues: [] };
    const live = selectPlanContent(result, { allowDrafts: false });
    expect(ids(searchExercises(live, {}))).toEqual(['glute-bridge']);
    const test = selectPlanContent(result, { allowDrafts: true });
    expect(searchExercises(test, {})).toHaveLength(ALL.length);
  });

  it('Such-Optionen per Zod: gültig/ungültig', () => {
    expect(
      glossarySearchOptionsSchema.safeParse({ query: 'x', groups: ['legs'], difficulty: [1] })
        .success,
    ).toBe(true);
    expect(glossarySearchOptionsSchema.safeParse({ groups: ['arme'] }).success).toBe(false);
    expect(glossarySearchOptionsSchema.safeParse({ difficulty: [4] }).success).toBe(false);
    expect(glossarySearchOptionsSchema.safeParse({ equipment: 'garage' }).success).toBe(false);
    expect(glossarySearchOptionsSchema.safeParse({ extra: 1 }).success).toBe(false);
  });
});

describe('glossaryEntry', () => {
  it('Anzeigemodell: Texte, Bereich, Geräte-Namen, Schwierigkeit, Belastungsart, Merkmale', () => {
    const entry = glossaryEntry(
      'kniebeuge-langhantel',
      ctx({ planExerciseIds: new Set(['kniebeuge-langhantel']) }),
    );
    expect(entry).toMatchObject({
      id: 'kniebeuge-langhantel',
      name: 'Kniebeuge mit Langhantel',
      nameEn: 'Barbell Back Squat',
      aliases: ['Back Squat'],
      group: 'legs',
      difficulty: 'hard',
      loadType: 'reps',
      unilateral: false,
      notReviewed: true,
      isDraft: true,
      archived: false,
      feasible: { home: false, gym: true },
      inMyPlan: true,
      availableForMe: true,
    });
    expect(entry?.equipment.map((e) => e.name)).toEqual([
      'Langhantel mit Scheiben',
      'Rack (Hantelablage)',
    ]);
    expect(entry?.steps).toEqual(kniebeuge.steps_de);
    expect(entry?.tips).toEqual(kniebeuge.tips_de);
    expect(entry?.mistakes).toEqual(kniebeuge.common_mistakes_de);
    expect(entry?.safetyNote).toBe(kniebeuge.safety_note_de);
    expect(glossaryEntry('wandsitzen', ctx())).toMatchObject({
      loadType: 'hold',
      difficulty: 'easy',
    });
    expect(glossaryEntry('glute-bridge', ctx())).toMatchObject({
      notReviewed: false,
      isDraft: false,
      feasible: { home: true, gym: true },
      inMyPlan: false,
    });
  });

  it('notReviewed wie needsExpertReviewLabel: KI-Entwurf ohne Fachprüfung, auch wenn freigegeben', () => {
    const published = makeExercise({
      id: 'freigegeben-ki',
      status: 'published',
      meta: { ...kniebeuge.meta, reviewed_by: 'KT', reviewed_at: '2026-10-04' },
    });
    const library = lib([published, bridge]);
    expect(glossaryEntry('freigegeben-ki', ctx({ library }))).toMatchObject({
      isDraft: false,
      notReviewed: true,
    });
    // Manuell und fachlich geprüft → kein Kennzeichen.
    expect(glossaryEntry('glute-bridge', ctx({ library }))?.notReviewed).toBe(false);
  });

  it('Übung ohne Geräte vs. nur Studio: machbar zu Hause bzw. nur im Studio', () => {
    expect(glossaryEntry('wandsitzen', ctx())?.feasible).toEqual({ home: true, gym: true });
    expect(glossaryEntry('kabelrudern', ctx({ homeProfile: HOME_DUMBBELLS }))?.feasible).toEqual({
      home: false,
      gym: true,
    });
    expect(
      glossaryEntry('goblet-kniebeuge', ctx({ homeProfile: HOME_DUMBBELLS }))?.feasible,
    ).toEqual({ home: true, gym: true });
  });

  it('unbekannte ID bzw. Bibliothek fehlt → null', () => {
    expect(glossaryEntry('gibt-es-nicht', ctx())).toBeNull();
    expect(glossaryEntry('kniebeuge-langhantel', ctx({ library: null }))).toBeNull();
    expect(findGlossaryExercise(null, 'kniebeuge-langhantel')).toBeNull();
  });

  it('archivierte Übung nur per Direkt-ID (displayExercises), nie in der Liste und nie als ähnliche Übung', () => {
    expect(glossaryEntry('altes-rudern', ctx())).toMatchObject({
      archived: true,
      name: 'Altes Rudern',
    });
    expect(ids(searchExercises(LIB, { query: 'altes rudern' }))).toEqual([]);
    expect(glossaryEntry('kabelrudern', ctx())?.similar.map((s) => s.id)).not.toContain(
      'altes-rudern',
    );
    // Ohne sie in displayExercises (bzw. ganz ohne displayExercises) ist sie unbekannt.
    expect(glossaryEntry('altes-rudern', ctx({ library: lib(ALL) }))).toBeNull();
    expect(
      glossaryEntry(
        'altes-rudern',
        ctx({ library: { exercises: new Map(ALL.map((e) => [e.id, e])) } }),
      ),
    ).toBeNull();
  });

  it('Schwangerschaft / ab 65 / vorsichtig → availableForMe false, ohne Grund im Modell', () => {
    const pregnant = glossaryEntry('glute-bridge', ctx({ rules: rules(['pregnancy']) }));
    expect(pregnant?.availableForMe).toBe(false);
    expect(
      glossaryEntry('pistol-squat', ctx({ rules: rules([], '1955-01-01') }))?.availableForMe,
    ).toBe(false);
    expect(glossaryEntry('kniebeuge-langhantel', ctx({ rules: rules(null) }))?.availableForMe).toBe(
      false,
    );
    expect(glossaryEntry('glute-bridge', ctx())?.availableForMe).toBe(true);
    // Kein Grund, kein Merkmal, keine Regel im Anzeigemodell (kein Gesundheitsbezug).
    const keys = Object.keys(pregnant ?? {});
    expect(keys.some((k) => /reason|caution|tag|rule|health|pregnan/i.test(k))).toBe(false);
    expect(JSON.stringify(pregnant)).not.toMatch(/long_supine|pregnan|Schwanger/);
  });

  it('Regeln unbekannt → availableForMe null und keine ähnlichen Übungen (vorsichtig)', () => {
    expect(glossaryEntry('kniebeuge-langhantel', ctx({ rules: null }))).toMatchObject({
      availableForMe: null,
      similar: [],
    });
  });
});

describe('Ähnliche Übungen', () => {
  it('gleiches Muster, nicht schwerer, kein Wechsel Wiederholung ↔ Halten, Reihenfolge der Alternativen', () => {
    // Pistol Squat ist gleich schwer (3) und bei normalen Regeln erlaubt (high_skill nur bei Vorsicht/Alter gesperrt).
    expect(similarExercises(kniebeuge, ctx()).map((e) => e.id)).toEqual([
      'pistol-squat',
      'goblet-kniebeuge',
      'kniebeuge-koerpergewicht',
    ]);
    // Wandsitzen (Halten) ist nie eine ähnliche Übung der Kniebeuge (Wiederholungen) – auch nicht über Stufe 3.
    expect(similarExercises(goblet, ctx()).map((e) => e.id)).toEqual(['kniebeuge-koerpergewicht']);
    // Leichte Übung: keine schwereren Vorschläge.
    expect(similarExercises(bodyweightSquat, ctx())).toEqual([]);
  });

  it('nur erlaubte Übungen nach den aktuellen Regeln; vorsichtig: leichtere zuerst', () => {
    expect(similarExercises(kniebeuge, ctx({ rules: rules(null) })).map((e) => e.id)).toEqual([
      'kniebeuge-koerpergewicht',
      'goblet-kniebeuge',
    ]);
    expect(
      similarExercises(kniebeuge, ctx({ rules: rules([], '1955-01-01') })).map((e) => e.id),
    ).not.toContain('pistol-squat');
  });

  it('nur machbar an einem Trainingsort', () => {
    const home = equipmentProfile('home', []);
    expect(similarExercises(kniebeuge, ctx({ trainingProfiles: [home] })).map((e) => e.id)).toEqual(
      ['pistol-squat', 'kniebeuge-koerpergewicht'],
    );
    expect(
      similarExercises(kniebeuge, ctx({ trainingProfiles: [home, HOME_DUMBBELLS] })).map(
        (e) => e.id,
      ),
    ).toContain('goblet-kniebeuge');
  });

  it(`höchstens ${GLOSSARY_LIMITS.similarMax}, ohne Doppelte, Bibliothek mit gemeinsamem Hauptmuskel`, () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makeExercise({ id: `variante-${i}`, name_de: `Variante ${i}`, difficulty: 1 }),
    );
    const base = makeExercise({ id: 'basis', difficulty: 2 });
    const result = similarExercises(base, ctx({ library: lib([base, ...many]) }));
    expect(result).toHaveLength(GLOSSARY_LIMITS.similarMax);
    expect(new Set(result.map((e) => e.id)).size).toBe(result.length);
    expect(result.map((e) => e.id)).not.toContain('basis');
  });
});

describe('equipmentNames', () => {
  it('Katalog-Namen, unbekannte ID bleibt stehen', () => {
    expect(equipmentNames(['dumbbells', 'unbekannt'])).toEqual([
      { id: 'dumbbells', name: 'Kurzhanteln' },
      { id: 'unbekannt', name: 'unbekannt' },
    ]);
    expect(equipmentNames([])).toEqual([]);
  });
});

describe('Echte Inhalte (content/exercises)', () => {
  const repo = repoLibrary();
  const files = loadRepoContentFiles().filter((f) => f.kind === 'exercise');
  const exercises = [...repo.exercises.values()];

  it('jede Übung des Inhaltsstands ist in der Glossar-Bibliothek (Testmodus) und hat ein gültiges Anzeigemodell', () => {
    // Anzahl nicht fest (Wächter K2): alle geladenen Übungsdateien ohne roten Befund.
    const result = validateContent(loadRepoContentFiles());
    const red = new Set(
      result.issues.filter((i) => i.severity === 'error' && i.kind === 'exercise').map((i) => i.id),
    );
    expect(exercises.length).toBe(files.length - red.size);
    expect(exercises.length).toBeGreaterThan(0);
    const context: GlossaryContext = { library: repo, rules: NORMAL };
    for (const exercise of exercises) {
      const entry = glossaryEntry(exercise.id, context);
      expect(entry, exercise.id).not.toBeNull();
      expect(entry?.steps.length, exercise.id).toBeGreaterThanOrEqual(2);
      expect(entry?.tips.length, exercise.id).toBeGreaterThanOrEqual(1);
      expect(entry?.mistakes.length, exercise.id).toBeGreaterThanOrEqual(1);
      expect(entry?.safetyNote.length, exercise.id).toBeGreaterThan(0);
      expect(GLOSSARY_GROUP_IDS, exercise.id).toContain(entry?.group);
      expect(
        entry?.equipment.every((e) => e.name !== e.id),
        exercise.id,
      ).toBe(true);
      // Ähnliche Übungen halten die Regeln ein.
      for (const s of entry?.similar ?? []) {
        const other = repo.exercises.get(s.id);
        expect(other?.movement_pattern, `${exercise.id} → ${s.id}`).toBe(exercise.movement_pattern);
        expect(other?.difficulty ?? 99, `${exercise.id} → ${s.id}`).toBeLessThanOrEqual(
          exercise.difficulty,
        );
        expect(other?.load_type === 'time', `${exercise.id} → ${s.id}`).toBe(
          exercise.load_type === 'time',
        );
      }
    }
  });

  it('jede Übung findet sich über ihren Namen (auch ohne Umlaute) und über jeden Alias', () => {
    for (const exercise of exercises) {
      const byName = searchExercises(repo, { query: normalizeSearchText(exercise.name_de) });
      expect(byName[0]?.exercise.id, exercise.name_de).toBe(exercise.id);
      for (const alias of exercise.aliases_de) {
        expect(ids(searchExercises(repo, { query: alias })), alias).toContain(exercise.id);
      }
    }
  });

  it('alle Bewegungsmuster des Inhaltsstands sind einem Bereich zugeordnet; Bereichs-Filter teilen lückenlos auf', () => {
    const grouped = GLOSSARY_GROUP_IDS.flatMap((group) =>
      ids(searchExercises(repo, { groups: [group] })),
    );
    expect(grouped.sort()).toEqual(exercises.map((e) => e.id).sort());
  });

  it('Schwangerschaft: keine erlaubte Übung mit Rückenlage-Merkmal, auch nicht unter den ähnlichen', () => {
    const pregnancy = rules(['pregnancy']);
    expect(pregnancy.excludedCautionTags).toContain('long_supine');
    const context: GlossaryContext = { library: repo, rules: pregnancy };
    for (const exercise of exercises) {
      const entry = glossaryEntry(exercise.id, context);
      expect(entry?.availableForMe, exercise.id).toBe(
        !exercise.caution_tags.some((tag) => pregnancy.excludedCautionTags.includes(tag)),
      );
      if (exercise.caution_tags.includes('long_supine')) {
        expect(entry?.availableForMe, exercise.id).toBe(false);
      }
      for (const s of entry?.similar ?? []) {
        expect(repo.exercises.get(s.id)?.caution_tags, s.id).not.toContain('long_supine');
      }
    }
  });
});
