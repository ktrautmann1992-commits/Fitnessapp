/**
 * Beispiel-Anpassungen für die CI-Zusammenfassung (docs/PLAN-PHASE-4B.md 5.8 und 12, Etappe A): Für AUSGEDACHTE
 * Test-Personen gibt es je eine ausgedachte Tagebuch-Folge, die Live-Anpassung (Premium, ohne KI) und ihren Erklärsatz
 * – so ist Etappe A am Handy sichtbar (GitHub-App → Pull Request → Checks → ci → Summary), bevor die App sie zeigt.
 * Feste Daten (nicht „heute“), damit die Tabelle stabil bleibt. Keine echten Nutzerdaten.
 */
import {
  type AdjustmentProposal,
  applyPlanChange,
  computeLiveAdjustments,
  equipmentProfile,
  explainAdjustment,
  type ExerciseLogEntry,
  type ExerciseProgress,
  generateTrainingPlan,
  type GeneratedPlan,
  type GeneratedSession,
  isBodyweightTemplateId,
  type LiveAdjustmentEnvironment,
  type LiveAdjustmentInputs,
  type LiveExerciseEntry,
  type LiveSessionLog,
  loadWeeksBeforeDeload,
  nextPlanBlock,
  type PlanChange,
  type PlanInputsInput,
  type PlanLibrary,
  planSafetyRules,
  planWeeks,
  type ProgressionContext,
  renderExplanation,
  restoreTemporaryChanges,
  type StoredAdjustment,
  type StoredSession,
  trailingLoadWeeks,
} from '@fitnessapp/core';

const START = '2026-10-05';
const BIRTH = '1990-01-15';

type Level = 'beginner' | 'advanced';
interface Person {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly level: Level;
  readonly inputs: PlanInputsInput;
}

function personInputs(
  level: Level,
  days: number[],
  extra: Partial<PlanInputsInput> = {},
): PlanInputsInput {
  return {
    goalType: 'muscle_gain',
    experienceLevel: level,
    schedule: {
      mode: 'fixed',
      slots: days.map((weekday) => ({ weekday, kind: 'strength_gym', minutes: 60 })),
    },
    homeEquipment: [],
    birthDate: BIRTH,
    sex: null,
    discipline: null,
    healthScreening: { flags: [] },
    ...extra,
  };
}

export const ADJUST_EXAMPLE_PERSONS: readonly Person[] = [
  {
    key: 'anna',
    name: 'Anna',
    description: 'Fortgeschritten, Studio Mo/Mi/Fr – Bankdrücken zweimal deutlich zu schwer',
    level: 'advanced',
    inputs: personInputs('advanced', [1, 3, 5]),
  },
  {
    key: 'ben',
    name: 'Ben',
    description: 'Einsteiger, Studio Mo/Mi/Fr – zwei Wochen in Folge sehr anstrengend',
    level: 'beginner',
    inputs: personInputs('beginner', [1, 3, 5]),
  },
  {
    key: 'clara',
    name: 'Clara',
    description: 'Fortgeschritten, Studio Mo/Mi/Fr – Bankdrücken drei Wochen ohne Fortschritt',
    level: 'advanced',
    inputs: personInputs('advanced', [1, 3, 5]),
  },
  {
    key: 'david',
    name: 'David',
    description: 'Fortgeschritten, Studio Mo/Mi/Fr – drei Wochen nur 5 von 9 Einheiten',
    level: 'advanced',
    inputs: personInputs('advanced', [1, 3, 5]),
  },
];

const BENCH: ProgressionContext = {
  loadType: 'weight',
  repsMin: 8,
  repsMax: 12,
  durationS: null,
  templateSets: 3,
  rpeTarget: 8,
  incrementKind: 'barbell',
};

const decimalDe = (n: number) => String(n).replace('.', ',');
const dateDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

function storedSessions(sessions: readonly GeneratedSession[], prefix = 's'): StoredSession[] {
  return sessions.map((s, i) => ({
    ...s,
    id: `${prefix}${i + 1}`,
    status: 'planned',
    original_date: null,
  }));
}

function environment(library: PlanLibrary): LiveAdjustmentEnvironment {
  return {
    library: library.exercises,
    profiles: new Map([
      ['gym', equipmentProfile('gym', [])],
      ['home', equipmentProfile('home', [])],
    ]),
  };
}

function inputsFor(
  person: Person,
  plan: GeneratedPlan,
  sessions: readonly StoredSession[],
  today: string,
  extra: Partial<LiveAdjustmentInputs>,
): LiveAdjustmentInputs {
  return {
    today,
    entitled: true,
    healthConsentValid: true,
    person: { birthDate: BIRTH },
    plan: {
      id: `plan-${person.key}`,
      startDate: plan.start_date,
      experienceLevel: person.level,
      fromHealthPlan: true,
      sessions,
    },
    rules: planSafetyRules(
      { experienceLevel: person.level, birthDate: BIRTH, healthScreening: { flags: [] } },
      today,
    ),
    sessionLogs: [],
    exerciseEntries: [],
    contexts: {},
    adjustments: [],
    sessionLocations: Object.fromEntries(sessions.map((s) => [s.id, 'gym'] as const)),
    ...extra,
  };
}

const state = (weightKg: number, targetReps: number): ExerciseProgress => ({
  weightKg,
  targetReps,
  extraSet: false,
  durationS: null,
});

function benchEntry(date: string, reps: number[], st: ExerciseProgress): LiveExerciseEntry {
  const entry: ExerciseLogEntry = {
    exerciseId: 'bankdruecken-langhantel',
    performedOn: date,
    loggedAt: `${date}T18:00:00Z`,
    status: 'done',
    loadType: 'weight',
    isIntroWeek: false,
    isDeload: false,
    targetSets: reps.length,
    targetWeightKg: st.weightKg,
    targetReps: st.targetReps,
    targetExtraSet: false,
    targetRpe: 8,
    state: st,
    weightConfirmed: false,
    sets: reps.map((r) => ({
      reps: r,
      weightKg: st.weightKg,
      durationS: null,
      rpe: null,
      done: true,
    })),
  };
  return { ...entry, sessionLogId: `log-${date}` };
}

function strengthLogs(
  sessions: readonly StoredSession[],
  from: string,
  to: string,
  rpe: number,
): LiveSessionLog[] {
  return sessions
    .filter(
      (s) =>
        s.kind === 'strength' && s.week_no >= 1 && s.scheduled_on >= from && s.scheduled_on <= to,
    )
    .map((s) => ({
      id: `log-${s.id}`,
      plannedSessionId: s.id,
      kind: 'strength',
      performedOn: s.scheduled_on,
      loggedAt: `${s.scheduled_on}T18:00:00Z`,
      status: 'completed',
      sessionRpe: rpe,
      isIntroWeek: s.is_intro_week,
      isDeload: s.is_deload,
      isFree: false,
    }));
}

function asStored(p: AdjustmentProposal, createdAt: string): StoredAdjustment {
  return {
    ...p,
    id: `adj-${p.rule}`,
    status: p.requiresConfirmation ? 'pending_confirmation' : 'applied',
    createdAt,
    decidedAt: null,
  };
}

function explanation(p: AdjustmentProposal, library: PlanLibrary): string {
  const names = new Map([...library.exercises.values()].map((e) => [e.id, e.name_de] as const));
  const { key, params } = explainAdjustment(p);
  return renderExplanation(key, params, names);
}

const RULE_DE: Record<string, string> = {
  fast_increase: 'Schneller steigern',
  load_reduce: 'Gewicht senken',
  volume_reduce: 'Eine Woche 1 Satz weniger',
  deload_forward: 'Erholungswoche vorgezogen',
  endurance_reduce: 'Ausdauer −15 %',
  stagnation_variation: 'Übung getauscht',
  fewer_days: 'Vorschlag: weniger Trainingstage (nur mit Bestätigung)',
};

function weekTable(before: readonly StoredSession[], after: readonly StoredSession[]): string[] {
  const rows = ['| Woche | ab | vorher | nachher |', '| --- | --- | --- | --- |'];
  const describe = (sessions: readonly StoredSession[]) => {
    const sets = sessions.reduce((sum, s) => sum + s.exercises.reduce((a, e) => a + e.sets, 0), 0);
    const kind = sessions.every((s) => s.is_deload)
      ? 'Erholung'
      : sessions.some((s) => s.is_intro_week)
        ? 'Einstieg'
        : 'Belastung';
    return `${kind}, ${sets} Sätze`;
  };
  const afterWeeks = planWeeks(after);
  for (const w of planWeeks(before)) {
    const a = afterWeeks.find((x) => x.blockNo === w.blockNo && x.weekNo === w.weekNo);
    const label = `${w.blockNo}.${w.weekNo}`;
    rows.push(
      `| ${label} | ${dateDe(w.monday)} | ${describe(w.sessions)} | ${a ? describe(a.sessions) : '–'} |`,
    );
  }
  return rows;
}

function section(person: Person, lines: string[]): string[] {
  return [`### ${person.name}`, '', `_${person.description}_`, '', ...lines, ''];
}

function proposalLines(p: AdjustmentProposal | undefined, library: PlanLibrary): string[] {
  if (!p) return ['Keine Anpassung.'];
  return [
    `**${RULE_DE[p.rule] ?? p.rule}** (ab ${dateDe(p.effectiveFrom)})`,
    '',
    `> ${explanation(p, library)}`,
  ];
}

/** Markdown „Beispiel-Anpassungen“. */
export function renderAdjustExamples(library: PlanLibrary): string {
  const env = environment(library);
  const out: string[] = [
    '## Beispiel-Anpassungen (Live-Anpassung, Premium, ohne KI)',
    '',
    'Ausgedachte Test-Personen mit ausgedachten Tagebuch-Folgen. Regeln aus `packages/core/src/adjust/` (Phase 4b, Etappe A).',
    'Gratis-Nutzer bekommen keine dieser Anpassungen.',
    '',
  ];
  const planOf = (person: Person) => {
    const result = generateTrainingPlan(person.inputs, library, START);
    if (!result.ok) throw new Error(`Kein Plan für ${person.name}`);
    return { plan: result.plan, sessions: storedSessions(result.plan.sessions) };
  };

  // Anna – R2: zweimal deutlich verfehlt.
  {
    const person = ADJUST_EXAMPLE_PERSONS[0] as Person;
    const { plan, sessions } = planOf(person);
    const entries = [
      benchEntry('2026-10-12', [5, 6, 5], state(60, 8)),
      benchEntry('2026-10-14', [6, 5, 5], state(60, 8)),
    ];
    const result = computeLiveAdjustments(
      inputsFor(person, plan, sessions, '2026-10-14', {
        exerciseEntries: entries,
        contexts: { 'bankdruecken-langhantel': BENCH },
      }),
      env,
    );
    const p = result.proposals.find((x) => x.rule === 'load_reduce');
    out.push(
      ...section(person, [
        'Folge: Bankdrücken 60 kg, Ziel 3 × 8 – am 12.10. 5/6/5 und am 14.10. 6/5/5 Wiederholungen.',
        '',
        ...proposalLines(p, library),
        '',
        `Zustand vorher → nachher: ${decimalDe(p?.stateBefore?.weightKg ?? 0)} kg → ${decimalDe(p?.stateAfter?.weightKg ?? 0)} kg (roh; die Anzeige rundet auf die Stufe des Orts ab).`,
      ]),
    );
  }

  // Ben – R3 zweimal in Folge → Erholungswoche vorgezogen.
  {
    const person = ADJUST_EXAMPLE_PERSONS[1] as Person;
    const { plan, sessions } = planOf(person);
    const first = computeLiveAdjustments(
      inputsFor(person, plan, sessions, '2026-10-16', {
        sessionLogs: strengthLogs(sessions, '2026-10-12', '2026-10-16', 9),
      }),
      env,
    ).proposals.find((x) => x.rule === 'volume_reduce');
    const lines: string[] = [
      'Folge: Woche 2 (ab 12.10.) und Woche 3 (ab 19.10.) jede Krafteinheit mit Belastung 9 von 10.',
      '',
      '1. Nach Woche 2:',
      '',
      ...proposalLines(first, library),
      '',
    ];
    if (first) {
      const prior = asStored(first, '2026-10-16T19:00:00Z');
      const afterFirst = applyPlanChange(sessions, first.changeAfter as PlanChange);
      const second = computeLiveAdjustments(
        inputsFor(person, plan, afterFirst, '2026-10-23', {
          sessionLogs: strengthLogs(afterFirst, '2026-10-12', '2026-10-23', 9),
          adjustments: [prior],
        }),
        env,
      ).proposals.find((x) => x.rule === 'deload_forward');
      lines.push('2. Nach Woche 3 (zweimal in Folge):', '', ...proposalLines(second, library), '');
      if (second) {
        const afterSecond = applyPlanChange(afterFirst, second.changeAfter as PlanChange);
        lines.push(
          'Wochen-Übersicht vorher/nachher:',
          '',
          ...weekTable(sessions, afterSecond),
          '',
          'Die getauschte Woche bekommt je Einheit die Sätze und das RPE der entsprechenden Einheit der Woche davor, insgesamt nie mehr Sätze als die Woche davor.',
          '',
        );
        const carried = trailingLoadWeeks(afterSecond);
        const restored = restoreTemporaryChanges(afterSecond, [
          prior,
          asStored(second, '2026-10-23T19:00:00Z'),
        ]);
        const rules = planSafetyRules(
          { experienceLevel: 'beginner', birthDate: BIRTH, healthScreening: { flags: [] } },
          '2026-11-15',
        );
        const next = nextPlanBlock(restored, {
          schedule: plan.inputs.schedule,
          loadWeeks: loadWeeksBeforeDeload('beginner', rules.cautious),
          rules,
          library: library.exercises,
          profiles: env.profiles as never,
          endurance: {
            goalType: plan.inputs.goalType,
            discipline: plan.inputs.discipline,
            experienceLevel: 'beginner',
          },
          previousStartGroup: plan.safety_rules.enduranceStartGroup,
          protectLastCore: isBodyweightTemplateId(library, plan.template_id),
          carriedLoadWeeks: carried,
        });
        const nextWeeks = planWeeks(storedSessions(next, 'n'));
        lines.push(
          `Folgeblock: ${carried} Belastungswochen nach der vorgezogenen Erholungswoche zählen mit (carriedLoadWeeks) → ${nextWeeks.filter((w) => !w.isDeload).length} Belastungswochen, dann Erholung. Nie mehr als ${loadWeeksBeforeDeload('beginner', false)} Belastungswochen in Folge.`,
        );
      }
    }
    out.push(...section(person, lines));
  }

  // Clara – R4: Stillstand → Übung getauscht.
  {
    const person = ADJUST_EXAMPLE_PERSONS[2] as Person;
    const { plan, sessions } = planOf(person);
    const st = state(60, 8);
    const entries = ['2026-09-28', '2026-10-12', '2026-10-19'].map((d) =>
      benchEntry(d, [8, 8, 7], st),
    );
    const result = computeLiveAdjustments(
      inputsFor(person, plan, sessions, '2026-10-21', {
        exerciseEntries: entries,
        contexts: { 'bankdruecken-langhantel': BENCH },
      }),
      env,
    );
    const p = result.proposals.find((x) => x.rule === 'stagnation_variation');
    out.push(
      ...section(person, [
        'Folge: Bankdrücken 60 kg am 28.09., 12.10. und 19.10. jeweils 8/8/7 Wiederholungen – Ziel nie ganz geschafft.',
        '',
        ...proposalLines(p, library),
        '',
        `Betroffene Einheiten: ${p?.plannedSessionIds.length ?? 0} (nur ab morgen, nur geplante ohne Eintrag).`,
      ]),
    );
  }

  // David – R5: weniger Trainingstage (Vorschlag).
  {
    const person = ADJUST_EXAMPLE_PERSONS[3] as Person;
    const { plan, sessions } = planOf(person);
    const window = sessions.filter((s) => s.week_no >= 2 && s.week_no <= 4);
    const logs = strengthLogs(
      window.filter((s) => !s.scheduled_on.match(/-(14|21|28|30)$/)),
      '2026-10-12',
      '2026-11-01',
      7,
    );
    const result = computeLiveAdjustments(
      inputsFor(person, plan, sessions, '2026-11-04', { sessionLogs: logs }),
      env,
    );
    const p = result.proposals.find((x) => x.rule === 'fewer_days');
    out.push(
      ...section(person, [
        'Folge: Wochen 2–4 – mittwochs fast immer ausgefallen.',
        '',
        ...proposalLines(p, library),
      ]),
    );
  }
  return `${out.join('\n')}\n`;
}
