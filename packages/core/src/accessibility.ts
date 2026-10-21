import { z } from 'zod';

import { LARGE_VIEW, READ_ALOUD } from './constants';
import type { GoalType } from './enums';

/**
 * Barrierefreiheit (docs/PLAN-FIT-IM-ALTER.md Abschnitt 12, Etappe FA5): „Große Ansicht“ und „Anleitungen vorlesen“.
 * Reine Regeln ohne UI – die App liest nur die Ergebnisse. Die Einstellungen gelten nur auf diesem Gerät und sind
 * KEINE Gesundheitsdaten (keine Begründung, kein Alter gespeichert).
 */

export const accessibilitySettingsSchema = z.strictObject({
  largeView: z.boolean(),
  readAloud: z.boolean(),
});
export type AccessibilitySettings = z.infer<typeof accessibilitySettingsSchema>;

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  largeView: false,
  readAloud: false,
};

/** Gespeicherten Wert lesen – Unbekanntes oder Kaputtes ergibt die Standardwerte (nie ein Absturz). */
export function parseAccessibilitySettings(raw: unknown): AccessibilitySettings {
  const parsed = accessibilitySettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_ACCESSIBILITY_SETTINGS;
}

/** Faktor für alle Schriftgrößen: 20/16 = 1,25 in der großen Ansicht, sonst 1. */
export function fontScale(largeView: boolean): number {
  return largeView ? LARGE_VIEW.baseFontPx / LARGE_VIEW.defaultBaseFontPx : 1;
}

/** Schriftgröße (px) für die Anzeige, auf ganze Pixel gerundet. Ungültige Werte bleiben unverändert. */
export function scaledFontSize(size: number, largeView: boolean): number {
  if (!Number.isFinite(size) || size <= 0) return size;
  return Math.round(size * fontScale(largeView));
}

/** Mindestgröße einer Tippfläche (px). */
export function minTouchTarget(largeView: boolean): number {
  return largeView ? LARGE_VIEW.minTouchPx : LARGE_VIEW.defaultMinTouchPx;
}

export interface LargeViewSuggestionInput {
  /** Alter in ganzen Jahren am Stichtag; null = unbekannt. */
  readonly ageYears: number | null;
  readonly goalType?: GoalType | null;
}

/**
 * Soll die App die große Ansicht vorschlagen? Ab 60 Jahren (FA-G2) – nur ein Vorschlag, nie automatisch an.
 * Das Ziel „Fit im Alter“ kommt mit Etappe FA1 dazu.
 */
export function suggestLargeView(input: LargeViewSuggestionInput): boolean {
  if (isActiveAgingGoal(input.goalType)) return true;
  return input.ageYears !== null && input.ageYears >= LARGE_VIEW.suggestFromAge;
}

/** Ziel „Fit im Alter“ – bewusst als Text-Vergleich, damit dieses Modul vor FA1 keine Enum-Änderung braucht. */
function isActiveAgingGoal(goal: GoalType | null | undefined): boolean {
  return (goal as string | null | undefined) === 'active_aging';
}

/** Eine Stimme der Sprachausgabe (Ausschnitt aus SpeechSynthesisVoice bzw. expo-speech Voice). */
export interface SpeechVoiceInfo {
  readonly identifier: string;
  readonly language: string;
  /** Web: `localService`. Nativ: Stimmen des Geräts gelten als lokal. */
  readonly localService: boolean;
}

/**
 * Stimme fürs Vorlesen wählen (Wächter S11): NUR lokale Stimmen (Sprachausgabe auf dem Gerät), bevorzugt genau
 * de-DE, dann andere deutsche Varianten (de-AT, de-CH). null → Knopf ausblenden.
 */
export function pickReadAloudVoice(voices: readonly SpeechVoiceInfo[]): SpeechVoiceInfo | null {
  const local = voices.filter((v) => v.localService);
  const norm = (lang: string) => lang.replace('_', '-').toLowerCase();
  const exact = local.find((v) => norm(v.language) === READ_ALOUD.language.toLowerCase());
  if (exact) return exact;
  return local.find((v) => norm(v.language).startsWith('de')) ?? null;
}

/** Was vorgelesen werden darf: NUR Übungsanleitungen (Plan 12 Nr. 5) – nie Gesundheitsdaten oder Planwerte. */
export interface ReadAloudExercise {
  readonly name: string;
  readonly description?: string;
  readonly steps: readonly string[];
  readonly tips?: readonly string[];
  readonly safetyNote?: string;
}

/** Feste Sprech-Bausteine (Deutsch). */
const SPOKEN = {
  steps: 'So geht es.',
  step: (n: number) => `Schritt ${n}:`,
  tips: 'Tipps.',
  safety: 'Sicherheit.',
} as const;

/** Einen Satz sauber abschließen (Punkt, wenn kein Satzzeichen am Ende). */
function sentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return '';
  return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Text zum Vorlesen einer Übungsanleitung: Name, Beschreibung, nummerierte Schritte, Tipps, Sicherheitshinweis.
 * Länger als READ_ALOUD.maxChars → am letzten ganzen Satz davor gekürzt.
 */
export function readAloudExerciseText(exercise: ReadAloudExercise): string {
  const parts: string[] = [sentence(exercise.name)];
  if (exercise.description) parts.push(sentence(exercise.description));
  const steps = exercise.steps.map((s) => s.trim()).filter((s) => s !== '');
  if (steps.length > 0) {
    parts.push(SPOKEN.steps);
    steps.forEach((step, i) => parts.push(`${SPOKEN.step(i + 1)} ${sentence(step)}`));
  }
  const tips = (exercise.tips ?? []).map((s) => s.trim()).filter((s) => s !== '');
  if (tips.length > 0) {
    parts.push(SPOKEN.tips);
    tips.forEach((tip) => parts.push(sentence(tip)));
  }
  if (exercise.safetyNote && exercise.safetyNote.trim() !== '') {
    parts.push(SPOKEN.safety, sentence(exercise.safetyNote));
  }
  const text = parts.filter((p) => p !== '').join(' ');
  if (text.length <= READ_ALOUD.maxChars) return text;
  const cut = text.slice(0, READ_ALOUD.maxChars);
  const lastEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return lastEnd > 0 ? cut.slice(0, lastEnd + 1) : cut;
}
