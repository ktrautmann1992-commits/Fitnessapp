import { describe, expect, it } from 'vitest';

import { PAIN_MODE, PAIN_REGION_LOAD } from '../constants';
import { addDays } from '../dates';
import { BODY_REGIONS, PAIN_INTENSITIES, type BodyRegion, type PainIntensity } from '../enums';
import { EXERCISES, ex } from '../plan/swap-test-helpers';
import {
  activePainEpisodes,
  adviceForNewEpisode,
  endPainEpisode,
  isBlockedByPain,
  isPainEpisodeActive,
  lastActiveDay,
  loadsRegion,
  newPainEpisode,
  type PainEpisode,
  painAdviceReasons,
  painChains,
  painEffectOn,
  painEpisodeInputSchema,
  painEpisodeSchema,
  parsePainEpisodes,
  plannedLastDay,
  regionsLoadedBy,
  withNewPainEpisode,
} from './pain';

const TODAY = '2026-10-25';
let counter = 0;
function episode(
  region: BodyRegion,
  intensity: PainIntensity,
  duration: 3 | 7 | 14,
  startedOn: string,
  endedEarlyOn: string | null = null,
): PainEpisode {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    region,
    intensity,
    duration_days: duration,
    started_on: startedOn,
    ended_early_on: endedEarlyOn,
    created_at: `${startedOn}T08:00:00Z`,
  };
}

describe('Schema und Eingabe', () => {
  it('gültiger Eintrag; Dauer nur 3/7/14; Ende nicht vor Beginn', () => {
    expect(painEpisodeSchema.safeParse(episode('knee', 'mild', 3, TODAY)).success).toBe(true);
    expect(
      painEpisodeSchema.safeParse({ ...episode('knee', 'mild', 3, TODAY), duration_days: 5 })
        .success,
    ).toBe(false);
    expect(
      painEpisodeSchema.safeParse(episode('knee', 'mild', 3, TODAY, addDays(TODAY, -1))).success,
    ).toBe(false);
    expect(
      painEpisodeSchema.safeParse({ ...episode('knee', 'mild', 3, TODAY), note: 'Freitext' })
        .success,
    ).toBe(false);
  });

  it('Eingabe: Beginn immer heute, alle Regionen und Stärken', () => {
    const schema = painEpisodeInputSchema(TODAY);
    for (const region of BODY_REGIONS) {
      for (const intensity of PAIN_INTENSITIES) {
        for (const duration_days of PAIN_MODE.durationsDays) {
          expect(
            schema.safeParse({ region, intensity, duration_days, started_on: TODAY }).success,
          ).toBe(true);
        }
      }
    }
    expect(
      schema.safeParse({
        region: 'knee',
        intensity: 'mild',
        duration_days: 3,
        started_on: addDays(TODAY, 1),
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ region: 'zeh', intensity: 'mild', duration_days: 3, started_on: TODAY })
        .success,
    ).toBe(false);
  });

  it('parsePainEpisodes: kaputte Einträge fallen weg, sortiert nach Beginn', () => {
    const a = episode('knee', 'mild', 3, '2026-10-20');
    const b = episode('hip', 'mild', 3, '2026-10-10');
    expect(parsePainEpisodes([a, { kaputt: true }, b]).map((e) => e.id)).toEqual([b.id, a.id]);
  });
});

describe('Dauer und automatisches Ende', () => {
  it.each([3, 7, 14] as const)('%i Tage: letzter Tag = Beginn + Dauer − 1, danach inaktiv', (d) => {
    const e = episode('knee', 'mild', d, TODAY);
    expect(plannedLastDay(e)).toBe(addDays(TODAY, d - 1));
    expect(isPainEpisodeActive(e, addDays(TODAY, -1))).toBe(false);
    expect(isPainEpisodeActive(e, TODAY)).toBe(true);
    expect(isPainEpisodeActive(e, addDays(TODAY, d - 1))).toBe(true);
    expect(isPainEpisodeActive(e, addDays(TODAY, d))).toBe(false);
  });

  it('vorzeitig beendet: ab dem Ende-Tag normaler Plan; am Starttag beendet = nie wirksam', () => {
    const e = episode('knee', 'moderate', 7, TODAY);
    const ended = endPainEpisode(e, addDays(TODAY, 2));
    expect(lastActiveDay(ended)).toBe(addDays(TODAY, 1));
    expect(isPainEpisodeActive(ended, addDays(TODAY, 2))).toBe(false);
    const sameDay = endPainEpisode(e, TODAY);
    expect(lastActiveDay(sameDay)).toBeNull();
    expect(activePainEpisodes([sameDay], TODAY)).toEqual([]);
  });

  it('beenden eines abgelaufenen Eintrags ändert nichts', () => {
    const e = episode('knee', 'mild', 3, '2026-10-01');
    expect(endPainEpisode(e, TODAY)).toBe(e);
  });

  it('neuer Eintrag derselben Region beendet den laufenden; alte (> 365 Tage) fallen weg', () => {
    const running = episode('knee', 'mild', 7, addDays(TODAY, -2));
    const ancient = episode('hip', 'mild', 3, addDays(TODAY, -400));
    const other = episode('shoulder', 'mild', 7, addDays(TODAY, -1));
    const next = episode('knee', 'moderate', 7, TODAY);
    const result = withNewPainEpisode([running, ancient, other], next, TODAY);
    expect(result.map((e) => e.id)).toEqual([running.id, other.id, next.id]);
    expect(result[0]?.ended_early_on).toBe(TODAY);
    expect(result[1]?.ended_early_on).toBeNull();
  });
});

describe('Arzt-Hinweis: stark, länger als 14 Tage, wiederkehrend', () => {
  it('leicht/mittel, einmalig, kurz → kein Hinweis', () => {
    expect(painAdviceReasons([episode('knee', 'mild', 7, TODAY)], TODAY)).toEqual([]);
    expect(painAdviceReasons([episode('knee', 'moderate', 14, TODAY)], TODAY)).toEqual([]);
  });

  it('stark → Hinweis sofort', () => {
    expect(painAdviceReasons([episode('wrist', 'severe', 3, TODAY)], TODAY)).toEqual(['severe']);
  });

  it('genau 14 Tage → kein Hinweis; verlängert auf mehr als 14 Tage → „long“', () => {
    const first = episode('knee', 'mild', 14, addDays(TODAY, -13));
    expect(painAdviceReasons([first], TODAY)).toEqual([]);
    const extended = withNewPainEpisode([first], episode('knee', 'mild', 3, TODAY), TODAY);
    expect(painAdviceReasons(extended, TODAY)).toContain('long');
    expect(painChains(extended, 'knee')).toHaveLength(1);
  });

  it('Lücke bis 2 Tage zählt als dieselbe Phase, ab 3 Tagen neue Phase', () => {
    const a = episode('hip', 'mild', 7, addDays(TODAY, -12)); // bis TODAY-6
    const close = episode('hip', 'mild', 7, addDays(TODAY, -3)); // Lücke 2 Tage
    expect(painChains([a, close], 'hip')).toHaveLength(1);
    expect(painAdviceReasons([a, close], TODAY)).toEqual(['long']);
    const far = episode('hip', 'mild', 7, addDays(TODAY, -2)); // Lücke 3 Tage
    expect(painChains([a, far], 'hip')).toHaveLength(2);
    expect(painAdviceReasons([a, far], TODAY)).toEqual([]);
  });

  it('dritte Phase derselben Region binnen 90 Tagen → „recurring“; andere Region zählt nicht', () => {
    const p1 = episode('lower_back', 'mild', 3, addDays(TODAY, -80));
    const p2 = episode('lower_back', 'mild', 3, addDays(TODAY, -40));
    const p3 = episode('lower_back', 'mild', 3, TODAY);
    expect(painAdviceReasons([p1, p2, p3], TODAY)).toEqual(['recurring']);
    expect(painAdviceReasons([p2, p3], TODAY)).toEqual([]);
    const old = episode('lower_back', 'mild', 3, addDays(TODAY, -95));
    expect(painAdviceReasons([old, p2, p3], TODAY)).toEqual([]);
    const otherRegion = episode('neck', 'mild', 3, addDays(TODAY, -60));
    expect(painAdviceReasons([otherRegion, p2, p3], TODAY)).toEqual([]);
  });

  it('Vorschau vor dem Speichern (adviceForNewEpisode)', () => {
    const p1 = episode('elbow', 'mild', 3, addDays(TODAY, -50));
    const p2 = episode('elbow', 'mild', 3, addDays(TODAY, -20));
    const input = {
      region: 'elbow',
      intensity: 'mild',
      duration_days: 3,
      started_on: TODAY,
    } as const;
    expect(adviceForNewEpisode([p1, p2], input, TODAY)).toEqual(['recurring']);
    expect(adviceForNewEpisode([], { ...input, intensity: 'severe' }, TODAY)).toEqual(['severe']);
    expect(adviceForNewEpisode([], input, TODAY)).toEqual([]);
  });

  it('nur wirksame Regionen zählen (abgelaufene starke Phase → kein Hinweis mehr)', () => {
    const e = episode('ankle', 'severe', 3, addDays(TODAY, -10));
    expect(painAdviceReasons([e], TODAY)).toEqual([]);
  });
});

describe('Wirkung an einem Tag', () => {
  it('kein Eintrag → null', () => {
    expect(painEffectOn([], TODAY)).toBeNull();
  });

  it('mehrere Regionen, gleiche Region zweimal → stärkste; „bis“ = spätester Tag', () => {
    const effect = painEffectOn(
      [
        episode('knee', 'mild', 3, TODAY),
        episode('knee', 'moderate', 7, addDays(TODAY, -1)),
        episode('shoulder', 'mild', 14, TODAY),
      ],
      TODAY,
    );
    expect(effect?.regions).toEqual([
      { region: 'knee', intensity: 'moderate' },
      { region: 'shoulder', intensity: 'mild' },
    ]);
    expect(effect?.level).toBe('moderate');
    expect(effect?.until).toBe(addDays(TODAY, 13));
    expect(effect?.conservative).toBe(false);
  });

  it('Arzt-Hinweis → konservativ: jede Region wie „stark“', () => {
    const effect = painEffectOn(
      [episode('knee', 'severe', 3, TODAY), episode('wrist', 'mild', 3, TODAY)],
      TODAY,
    );
    expect(effect?.conservative).toBe(true);
    expect(effect?.regions.every((r) => r.intensity === 'severe')).toBe(true);
    expect(effect?.level).toBe('severe');
  });
});

describe('Welche Übung belastet welche Region (echte Bibliothek)', () => {
  const table: [BodyRegion, string, string][] = [
    // [Region, belastet schon bei „leicht“, bleibt bei „leicht“ erlaubt]
    ['knee', 'split-kniebeuge', 'glute-bridge'],
    ['shoulder', 'schulterdruecken-kurzhantel', 'kniebeuge-koerpergewicht'],
    ['lower_back', 'rumaenisches-kreuzheben-kurzhantel', 'beinstrecker'],
    ['elbow', 'bizepscurl-kurzhantel', 'kniebeuge-koerpergewicht'],
    ['wrist', 'liegestuetz', 'bankdruecken-kurzhantel'],
    ['hip', 'split-kniebeuge', 'bankdruecken-kurzhantel'],
    ['ankle', 'wadenheben-koerpergewicht', 'beinstrecker'],
    ['neck', 'schulterdruecken-kurzhantel', 'beinpresse'],
  ];

  it.each(table)('%s: %s belastet, %s nicht (leicht)', (region, loaded, spared) => {
    expect(loadsRegion(ex(loaded), region, 'mild')).toBe(true);
    expect(loadsRegion(ex(spared), region, 'mild')).toBe(false);
  });

  it('jede Region hat bei „mittel“ mehr gesperrte Übungen als bei „leicht“ (strong ⊂ any)', () => {
    for (const region of BODY_REGIONS) {
      const all = [...EXERCISES.values()];
      const mild = all.filter((e) => loadsRegion(e, region, 'mild'));
      const moderate = all.filter((e) => loadsRegion(e, region, 'moderate'));
      const severe = all.filter((e) => loadsRegion(e, region, 'severe'));
      expect(mild.length, region).toBeGreaterThan(0);
      expect(moderate.length, region).toBeGreaterThan(mild.length);
      expect(severe.map((e) => e.id)).toEqual(moderate.map((e) => e.id));
      for (const e of mild) expect(loadsRegion(e, region, 'moderate'), e.id).toBe(true);
    }
  });

  it('Belastungsart: Liegestütz (Stütz) belastet das Handgelenk bei leicht, Bankdrücken erst ab mittel', () => {
    expect(loadsRegion(ex('liegestuetz'), 'wrist', 'mild')).toBe(true);
    expect(loadsRegion(ex('bankdruecken-kurzhantel'), 'wrist', 'mild')).toBe(false);
    expect(loadsRegion(ex('bankdruecken-kurzhantel'), 'wrist', 'moderate')).toBe(true);
  });

  it('unbekannte Übung gilt immer als belastend (vorsichtig)', () => {
    for (const region of BODY_REGIONS) expect(loadsRegion(undefined, region, 'mild')).toBe(true);
    const effect = painEffectOn([episode('knee', 'mild', 3, TODAY)], TODAY);
    expect(isBlockedByPain(undefined, effect!)).toBe(true);
  });

  it('konservativ sperrt zusätzlich Sprünge, Wirbelsäulenlast, hohe Technik – auch ohne Bezug zur Region', () => {
    const conservative = painEffectOn([episode('elbow', 'severe', 3, TODAY)], TODAY)!;
    expect(isBlockedByPain(ex('kettlebell-swing'), conservative)).toBe(true);
    expect(isBlockedByPain(ex('kniebeuge-langhantel'), conservative)).toBe(true);
    expect(isBlockedByPain(ex('beinpresse'), conservative)).toBe(false);
  });

  it('Stuhl-Dips belasten die Schulter ausdrücklich (einzeln genannte Übung)', () => {
    expect(regionsLoadedBy(ex('dips-stuhl'))).toEqual(
      expect.arrayContaining(['shoulder', 'elbow', 'wrist']),
    );
  });

  it('jeder genannte Übungs-Name existiert in der Bibliothek', () => {
    for (const region of BODY_REGIONS) {
      for (const m of [...PAIN_REGION_LOAD[region].strong, ...PAIN_REGION_LOAD[region].any]) {
        if ('exercise' in m) expect(EXERCISES.has(m.exercise), m.exercise).toBe(true);
      }
    }
  });

  it('newPainEpisode baut einen gültigen Eintrag', () => {
    const e = newPainEpisode(
      { region: 'hip', intensity: 'mild', duration_days: 7, started_on: TODAY },
      { id: '00000000-0000-4000-8000-0000000000aa', createdAt: `${TODAY}T09:00:00Z` },
    );
    expect(e.ended_early_on).toBeNull();
    expect(painEpisodeSchema.safeParse(e).success).toBe(true);
  });
});
