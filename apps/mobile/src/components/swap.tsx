import {
  alwaysAllowedFor,
  type EquipmentLocation,
  type ExercisePreferenceKind,
} from '@fitnessapp/core';
import { maxContentWidth, radius, spacing } from '@fitnessapp/ui';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { SwapTarget } from '@/data/exercise-swap';
import { t } from '@/i18n';
import { placeText } from '@/lib/swap-format';
import { useThemeColors } from '@/lib/theme';

import { Body, Button, FieldError, Heading, Notice, OptionButton } from './ui';

/**
 * Tausch-Dialog (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 8.2/8.3, Etappe T2) auf einer Fläche: Alternative wählen, „Wie
 * lange?“, bei „immer“ und mehrdeutigem Ort „Wo trainierst du diese Einheit?“ und „Warum?“ (nur „Mag ich nicht“ /
 * „Hier nicht machbar“, kein Freitext, D-1) plus der feste Hinweis D-2. Welche Übungen und ob „immer“ möglich ist,
 * kommt aus packages/core (swapChoices, alwaysAllowedFor) – hier nur Anzeige und Eingabe.
 *
 * Barrierefreiheit: Fokus beim Öffnen auf den Titel, Radio-Gruppen mit Zustand, deaktivierte Option mit sichtbarer
 * Erklärung, Escape bzw. Zurück schließt (onRequestClose), Touch-Ziele ≥ 48 dp.
 */

export type SwapDuration = 'today' | 'always';

export interface SwapDecision {
  candidateId: string;
  duration: SwapDuration;
  /** Nur bei „immer“: Ort der Präferenz. */
  location: EquipmentLocation | null;
  kind: ExercisePreferenceKind | null;
}

/** Fokus auf ein Element setzen (Browser: DOM-Fokus; App: Bildschirmleser-Fokus). */
export function focusView(view: View | null): void {
  if (!view) return;
  if (Platform.OS === 'web') {
    (view as unknown as { focus?: () => void }).focus?.();
    return;
  }
  const tag = findNodeHandle(view);
  if (tag !== null) AccessibilityInfo.setAccessibilityFocus(tag);
}

/** Browser: Fokus zurück auf den auslösenden Knopf (über seine testID). */
export function focusTestId(testID: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const element = document.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
  element?.focus();
}

export function SwapDialog({
  target,
  allowAlways,
  workout = false,
  backToPlanned,
  busy = false,
  error,
  onConfirm,
  onCancel,
  onOpenGuide,
  onAdjustEquipment,
}: {
  /** null = geschlossen. */
  target: SwapTarget | null;
  /** „Ab jetzt immer“ anbieten (Backend unterstützt Präferenzen; Supabase erst ab T3). */
  allowAlways: boolean;
  /** Im Trainingsmodus (Hinweis „Heute auslassen“ statt Tausch, wenn es keine Alternative gibt). */
  workout?: boolean;
  /** Trainingsmodus mit gewählter Alternative: „Zurück zu …“. */
  backToPlanned?: { label: string; onPress: () => void } | null;
  busy?: boolean;
  error?: string | undefined;
  onConfirm: (decision: SwapDecision) => void;
  onCancel: () => void;
  onOpenGuide: (exerciseId: string) => void;
  onAdjustEquipment: () => void;
}) {
  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onCancel}>
      {target ? (
        <SwapDialogContent
          // Neuer Tausch = frische Auswahl.
          key={`${target.sessionId}-${target.storedOrderNo}-${target.shownExerciseId}`}
          target={target}
          allowAlways={allowAlways}
          workout={workout}
          backToPlanned={backToPlanned ?? null}
          busy={busy}
          error={error}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onOpenGuide={onOpenGuide}
          onAdjustEquipment={onAdjustEquipment}
        />
      ) : null}
    </Modal>
  );
}

function SwapDialogContent({
  target,
  allowAlways,
  workout,
  backToPlanned,
  busy,
  error,
  onConfirm,
  onCancel,
  onOpenGuide,
  onAdjustEquipment,
}: {
  target: SwapTarget;
  allowAlways: boolean;
  workout: boolean;
  backToPlanned: { label: string; onPress: () => void } | null;
  busy: boolean;
  error: string | undefined;
  onConfirm: (decision: SwapDecision) => void;
  onCancel: () => void;
  onOpenGuide: (exerciseId: string) => void;
  onAdjustEquipment: () => void;
}) {
  const theme = useThemeColors();
  const titleRef = useRef<View>(null);
  const [candidate, setCandidate] = useState<string | null>(null);
  // „Nur heute“ vorausgewählt – außer an Terminen, an denen ein Tagestausch nie wirkt (Wächter T2-S1).
  const [duration, setDuration] = useState<SwapDuration | null>(
    target.todayAllowed ? 'today' : null,
  );
  const [location, setLocation] = useState<EquipmentLocation | null>(
    target.ambiguousLocation ? null : target.location,
  );
  const [kind, setKind] = useState<ExercisePreferenceKind | null>(null);
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    // Fokus beim Öffnen auf den Titel (8.3) – kurz warten, bis das Modal sichtbar ist.
    const id = setTimeout(() => focusView(titleRef.current), 50);
    return () => clearTimeout(id);
  }, []);

  const { choices } = target;
  const candidates = choices.today;
  const alwaysPossible =
    allowAlways && target.alwaysOffered && alwaysAllowedFor(choices, null, null);
  const alwaysForChoice =
    duration === 'always' && location !== null && candidate !== null
      ? alwaysAllowedFor(choices, location, candidate)
      : true;
  const alwaysLabel = target.ambiguousLocation
    ? t.swap.alwaysPlain
    : t.swap.always(placeText(target.location));

  function confirm() {
    if (candidate === null) {
      setProblem(t.swap.chooseCandidate);
      return;
    }
    if (duration === null) {
      setProblem(t.swap.chooseDuration);
      return;
    }
    if (duration === 'always') {
      if (location === null) {
        setProblem(t.swap.chooseLocation);
        return;
      }
      if (!alwaysAllowedFor(choices, location, candidate)) {
        setProblem(t.swap.alwaysNotForChoice);
        return;
      }
      if (kind === null) {
        setProblem(t.swap.chooseReason);
        return;
      }
    }
    setProblem(undefined);
    onConfirm({
      candidateId: candidate,
      duration,
      location: duration === 'always' ? location : null,
      kind: duration === 'always' ? kind : null,
    });
  }

  return (
    <View style={styles.backdrop}>
      <View
        accessibilityViewIsModal
        aria-modal
        role="dialog"
        aria-labelledby="swap-dialog-title"
        testID="swap-dialog"
        style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View ref={titleRef} tabIndex={-1} nativeID="swap-dialog-title" style={styles.title}>
            <Heading level={2}>{t.swap.dialogTitle}</Heading>
          </View>
          <Body>{t.swap.insteadOf(target.shownName)}</Body>

          {candidates.length === 0 ? (
            <Notice tone="info" testID="swap-no-candidates">
              <Body>
                {choices.reason === 'library_missing' ? t.swap.libraryMissing : t.swap.noCandidates}
              </Body>
              {workout ? <Body muted>{t.swap.noCandidatesWorkout}</Body> : null}
              {/* Nur zu Hause sind Geräte änderbar (im Studio gilt die volle Ausstattung); sie wirken erst mit
                  „Plan neu erstellen“ (Wächter T2-K8). */}
              {target.location === 'home' || target.ambiguousLocation ? (
                <>
                  <Body muted>{t.swap.adjustEquipmentHint}</Body>
                  <Button
                    label={t.swap.adjustEquipment}
                    variant="secondary"
                    onPress={onAdjustEquipment}
                  />
                </>
              ) : null}
            </Notice>
          ) : (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t.swap.candidatesLabel}
              style={styles.group}
              testID="swap-candidates"
            >
              <Text style={[styles.label, { color: theme.text }]}>{t.swap.candidatesLabel}</Text>
              {candidates.map((exercise) => (
                <View key={exercise.id} style={styles.candidate}>
                  <OptionButton
                    role="radio"
                    label={exercise.name_de}
                    description={
                      exercise.id === target.harderVariantId ? t.swap.harderVariant : undefined
                    }
                    selected={candidate === exercise.id}
                    onPress={() => {
                      setCandidate(exercise.id);
                      setProblem(undefined);
                    }}
                  />
                  <Button
                    label={t.swap.howTo}
                    variant="link"
                    accessibilityLabel={t.swap.howToA11y(exercise.name_de)}
                    onPress={() => onOpenGuide(exercise.id)}
                  />
                </View>
              ))}
            </View>
          )}

          {backToPlanned ? (
            <Button
              label={backToPlanned.label}
              variant="secondary"
              onPress={backToPlanned.onPress}
            />
          ) : null}

          {candidates.length > 0 ? (
            <>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={t.swap.durationTitle}
                style={styles.group}
                testID="swap-duration"
              >
                <Text style={[styles.label, { color: theme.text }]}>{t.swap.durationTitle}</Text>
                <OptionButton
                  role="radio"
                  label={target.later ? t.swap.onlyThisSession : t.swap.onlyToday}
                  selected={duration === 'today'}
                  disabled={!target.todayAllowed}
                  onPress={() => {
                    setDuration('today');
                    setProblem(undefined);
                  }}
                />
                {!target.todayAllowed ? (
                  <Body muted testID="swap-today-unavailable">
                    {t.swap.todayUnavailable}
                  </Body>
                ) : null}
                {allowAlways ? (
                  <>
                    <OptionButton
                      role="radio"
                      label={alwaysLabel}
                      description={alwaysPossible ? t.swap.alwaysHint : undefined}
                      selected={duration === 'always'}
                      disabled={!alwaysPossible}
                      onPress={() => {
                        setDuration('always');
                        setProblem(undefined);
                      }}
                    />
                    {!alwaysPossible ? (
                      <Body muted testID="swap-always-unavailable">
                        {!target.alwaysOffered
                          ? t.swap.alwaysDaySwapped
                          : choices.limitReached
                            ? t.swap.alwaysLimit
                            : t.swap.alwaysUnavailable}
                      </Body>
                    ) : null}
                  </>
                ) : null}
              </View>

              {duration === 'always' && target.ambiguousLocation ? (
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t.swap.locationTitle}
                  style={styles.group}
                  testID="swap-location"
                >
                  <Text style={[styles.label, { color: theme.text }]}>{t.swap.locationTitle}</Text>
                  {choices.locations.map((loc) => (
                    <OptionButton
                      key={loc}
                      role="radio"
                      label={loc === 'home' ? t.swap.locationHome : t.swap.locationGym}
                      selected={location === loc}
                      onPress={() => {
                        setLocation(loc);
                        setProblem(undefined);
                      }}
                    />
                  ))}
                </View>
              ) : null}

              {duration === 'always' && !alwaysForChoice ? (
                <Body muted testID="swap-always-not-for-choice">
                  {t.swap.alwaysNotForChoice}
                </Body>
              ) : null}

              {duration === 'always' ? (
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t.swap.reasonTitle}
                  style={styles.group}
                  testID="swap-reason"
                >
                  <Text style={[styles.label, { color: theme.text }]}>{t.swap.reasonTitle}</Text>
                  <OptionButton
                    role="radio"
                    label={t.swap.reasonDislike}
                    selected={kind === 'dislike'}
                    onPress={() => {
                      setKind('dislike');
                      setProblem(undefined);
                    }}
                  />
                  <OptionButton
                    role="radio"
                    label={t.swap.reasonNotFeasible}
                    description={t.swap.reasonNotFeasibleHint}
                    selected={kind === 'not_feasible'}
                    onPress={() => {
                      setKind('not_feasible');
                      setProblem(undefined);
                    }}
                  />
                </View>
              ) : null}
            </>
          ) : null}

          {/* D-2: Gesundheitsgründe gehören in den Gesundheits-Check – fester Hinweis. */}
          <Body muted testID="swap-health-hint">
            {t.swap.healthHint}
          </Body>
          <FieldError message={problem ?? error} testID="swap-error" />
          {candidates.length > 0 ? (
            <Button label={t.swap.confirm} onPress={confirm} loading={busy} testID="swap-confirm" />
          ) : null}
          <Button
            label={candidates.length > 0 ? t.swap.cancel : t.swap.close}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            testID="swap-cancel"
          />
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * Rückmeldung nach einem Tausch (8.2): sichtbarer Text, für den Bildschirmleser angesagt (Browser über Live-Region,
 * App über announceForAccessibility). „Rückgängig“ OHNE Zeitlimit (Wächter K4, WCAG 2.2.1) – bleibt, bis die Person
 * etwas anderes tut oder den Bildschirm verlässt (der Aufrufer setzt den Zustand dann zurück).
 */
export function SwapFeedback({
  text,
  tone = 'success',
  onUndo,
  undoBusy = false,
}: {
  text: string;
  tone?: 'success' | 'danger' | 'info';
  onUndo?: (() => void) | null;
  undoBusy?: boolean;
}) {
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(text);
    // Fokus auf die Rückmeldung (8.3, Wächter T2-K6) – nach dem Schließen des Dialogs nicht im Leeren.
    const id = setTimeout(() => focusView(ref.current), 50);
    return () => clearTimeout(id);
  }, [text]);
  return (
    <View
      ref={ref}
      tabIndex={-1}
      accessibilityLiveRegion="polite"
      aria-live="polite"
      testID="swap-feedback"
      style={styles.title}
    >
      <Notice tone={tone}>
        <Body>{text}</Body>
        {onUndo ? (
          <Button
            label={t.swap.undo}
            variant="secondary"
            onPress={onUndo}
            loading={undoBusy}
            testID="swap-undo"
          />
        ) : null}
      </Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: maxContentWidth,
    maxHeight: '100%',
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { outlineStyle: 'none' } as object,
  group: { gap: spacing.sm },
  candidate: { gap: 2 },
  label: { fontSize: 16, fontWeight: '600' },
});
