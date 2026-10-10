import * as core from '@fitnessapp/core';
import { planStartGroup, toSavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

import { activePlan, effectiveSafetyRules, generatePlanFromRows } from '@/data/training-plan';
import { t } from '@/i18n';

import { planPersonRows, seededBackend, TODAY, VERSIONS } from '../test/fixtures';
import {
  buildPlanPrint,
  DEFAULT_PRINT_FORM,
  exportOptions,
  logColumnChoices,
  nameErrorText,
  planPrintErrorText,
  type PrintFormState,
} from './print-plan';

vi.mock('@fitnessapp/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fitnessapp/core')>();
  return { ...actual, buildTrainingPlanDocument: vi.fn(actual.buildTrainingPlanDocument) };
});

/** Gespeicherter Plan im Testmodus (wie nach dem Onboarding). */
async function savedPlan(options: Parameters<typeof planPersonRows>[0] = {}) {
  const rows = planPersonRows(options);
  const setup = seededBackend(rows, TODAY, `${TODAY}T08:00:00.000Z`);
  const library = await setup.backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const generated = generatePlanFromRows(rows, VERSIONS, library, TODAY);
  if (!generated.ok) throw new Error(generated.error);
  const saved = await setup.backend.savePlan(toSavePlanPayload(generated.plan), rows);
  const active = activePlan(saved);
  const rules = effectiveSafetyRules(saved, VERSIONS, TODAY);
  if (!active || !rules) throw new Error('kein Plan');
  return { rows: saved, active, library, rules };
}

const form = (patch: Partial<PrintFormState> = {}): PrintFormState => ({
  ...DEFAULT_PRINT_FORM,
  ...patch,
});

describe('Plan als PDF – Zusammenstecken (P3/P4)', () => {
  it('Studio-Plan → Druck-HTML auf Deutsch, Titel ohne Namen, Startgruppe aus planStartGroup() (K9)', async () => {
    const plan = await savedPlan();
    const spy = vi.mocked(core.buildTrainingPlanDocument);
    spy.mockClear();
    const result = buildPlanPrint({ ...plan, today: TODAY, form: form(), target: 'web' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain('<html lang="de">');
    expect(result.html).toContain('Dein Trainingsplan');
    expect(result.title).toBe(t.print.docTitle);
    expect(result.landscape).toBe(false);
    const display = spy.mock.calls[0]?.[2];
    expect(display?.previousStartGroup).toBe(
      planStartGroup(plan.active.plan, plan.rows.profile?.birth_date ?? TODAY),
    );
    expect(spy.mock.calls[0]?.[3]).toBeNull();
  });

  it('„Ab jetzt immer“ wirkt im PDF (Plan-Untergrenze dabei), ohne Präferenzen kein Kennzeichen (Etappe T2)', async () => {
    const plan = await savedPlan();
    const spy = vi.mocked(core.buildTrainingPlanDocument);
    spy.mockClear();
    const plain = buildPlanPrint({ ...plan, today: TODAY, form: form(), target: 'web' });
    if (!plain.ok) throw new Error('kein Dokument');
    expect(plain.html).not.toContain(t.print.preferenceSwap);
    const display = spy.mock.calls[0]?.[2];
    expect(display?.swap?.swapRules).toEqual(
      core.displaySwapRules(plan.active.plan, plan.rows.profile?.birth_date ?? TODAY, plan.rules),
    );
    expect(display?.swap?.preferences).toEqual([]);
    // Alle Übungen der ersten Kraft-Einheit „mag ich nicht“ im Studio → mindestens eine getauscht.
    const first = plan.active.sessions.find((s) => s.kind === 'strength');
    const prefs = (first?.exercises ?? []).map((e) => ({
      user_id: plan.rows.profile?.user_id ?? '',
      exercise_id: e.exercise_id,
      location: 'gym' as const,
      kind: 'dislike' as const,
      replacement_exercise_id: null,
      created_at: '2026-10-03T08:00:00.000Z',
      updated_at: '2026-10-03T08:00:00.000Z',
    }));
    const swapped = buildPlanPrint({
      ...plan,
      rows: { ...plan.rows, exercisePreferences: prefs },
      today: TODAY,
      form: form(),
      target: 'web',
    });
    if (!swapped.ok) throw new Error('kein Dokument');
    expect(swapped.html).toContain(t.print.preferenceSwap);
  });

  it('Plan mit Gesundheitsangaben: kein Wort dazu im Dokument (B1)', async () => {
    const plan = await savedPlan({ flags: ['injury'] });
    expect(plan.active.plan.uses_health_data).toBe(true);
    const result = buildPlanPrint({ ...plan, today: TODAY, form: form(), target: 'web' });
    if (!result.ok) throw new Error('kein Dokument');
    expect(result.html).not.toMatch(/Gesundheit|Verletzung|vorsichtig|Einsteiger/i);
    expect(result.html).toContain(t.print.medical);
  });

  it('Name nur auf Wunsch und nie im Titel', async () => {
    const plan = await savedPlan();
    const without = buildPlanPrint({
      ...plan,
      today: TODAY,
      form: form({ name: 'Alex Beispiel' }),
      target: 'web',
    });
    const withName = buildPlanPrint({
      ...plan,
      today: TODAY,
      form: form({ includeName: true, name: 'Alex Beispiel' }),
      target: 'web',
    });
    if (!without.ok || !withName.ok) throw new Error('kein Dokument');
    expect(without.html).not.toContain('Alex');
    expect(withName.html).toContain('Alex Beispiel');
    expect(withName.html).toMatch(/<title>Trainingsplan<\/title>/);
  });

  it('verständliche Fehlermeldung bei ungültigem Namen (K11)', async () => {
    expect(nameErrorText(form({ includeName: true, name: '   ' }), TODAY)).toBe(
      t.printView.nameMissing,
    );
    expect(nameErrorText(form({ includeName: true, name: 'x'.repeat(61) }), TODAY)).toBe(
      t.printView.nameTooLong(60),
    );
    expect(nameErrorText(form({ includeName: true, name: 'Anna 👩‍💻' }), TODAY)).toBe(
      t.printView.nameInvalid,
    );
    expect(nameErrorText(form({ includeName: true, name: 'a‮b' }), TODAY)).toBe(
      t.printView.nameInvalid,
    );
    for (const ok of ['Jürgen Öztürk-Weiß', 'Zoë 😀', 'Anna ❤️']) {
      expect(nameErrorText(form({ includeName: true, name: ok }), TODAY)).toBeNull();
    }
    // Ungültiger Name ohne Häkchen stört nicht.
    expect(nameErrorText(form({ name: 'Anna 👩‍💻' }), TODAY)).toBeNull();

    const plan = await savedPlan();
    const result = buildPlanPrint({
      ...plan,
      today: TODAY,
      form: form({ includeName: true, name: 'Anna 👩‍💻' }),
      target: 'web',
    });
    expect(result).toEqual({
      ok: false,
      error: 'invalid_options',
      nameError: t.printView.nameInvalid,
    });
    if (!result.ok) expect(planPrintErrorText(result)).toBe(t.printView.nameInvalid);
  });

  it('Querformat nur im Web; nativ höchstens 4 Spalten hochkant (P4)', async () => {
    expect(logColumnChoices('web').map((c) => c.value)).toEqual([0, 2, 4, 8]);
    expect(logColumnChoices('native').map((c) => c.value)).toEqual([0, 2, 4]);
    expect(exportOptions(form({ logColumns: 8 }), TODAY)).toMatchObject({
      landscape: true,
      logColumns: 8,
    });
    expect(exportOptions(form({ logColumns: 4 }), TODAY)).toMatchObject({ landscape: false });

    const plan = await savedPlan();
    const web = buildPlanPrint({
      ...plan,
      today: TODAY,
      form: form({ logColumns: 8 }),
      target: 'web',
    });
    const native = buildPlanPrint({
      ...plan,
      today: TODAY,
      form: form({ logColumns: 8 }),
      target: 'native',
    });
    if (!web.ok || !native.ok) throw new Error('kein Dokument');
    expect(web.landscape).toBe(true);
    expect(web.html).toContain('class="page page--landscape"');
    expect(native.landscape).toBe(false);
    expect(native.html).not.toContain('class="page page--landscape"');
  });

  it('ohne Einheiten → verständlicher Hinweis statt leerem PDF', async () => {
    const plan = await savedPlan();
    const result = buildPlanPrint({
      ...plan,
      active: { ...plan.active, sessions: [] },
      today: TODAY,
      form: form(),
      target: 'web',
    });
    expect(result).toEqual({ ok: false, error: 'no_sessions' });
    if (!result.ok) expect(planPrintErrorText(result)).toBe(t.printView.noSessions);
  });
});
