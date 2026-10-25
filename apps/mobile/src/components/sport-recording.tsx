import {
  distanceText,
  durationText,
  isoDateInTimeZone,
  isSportId,
  recordingSummary,
  sessionTrainingLoad,
  sportEntryFromRecording,
  type SportId,
  sportName,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmDialog } from '@/components/screen';
import { kcalFor, useSessionKcalContext } from '@/components/session-kcal';
import { Body, Button, Card, FieldError, Heading, Notice, TextField } from '@/components/ui';
import { EffortSlider } from '@/components/workout';
import { deviceStore, newId } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';
import { createSportDraft } from '@/data/sport-entry';
import { t } from '@/i18n';
import { berlinTodayIso, formatDecimal } from '@/lib/format';
import { formatKcal } from '@/lib/nutrition-format';
import { endRecording } from '@/lib/recording-controller';
import { useRecordingSession } from '@/lib/recording-session';
import { useApp } from '@/state/app-state';

/**
 * GPS-Aufzeichnung einer Sportart (Sportarten Stufe 2: Skilanglauf, Skitour, Inline-Skaten, SUP, Kajak/Kanu). Die
 * Aufzeichnung selbst ist die normale Strecken-Aufzeichnung (Profil SPORT_CATALOGUE[…].gpsProfile für Filter und
 * Geschwindigkeit); gespeichert wird ein Sportart-Eintrag mit Dauer (Bewegungszeit) und Distanz
 * (sportEntryFromRecording). Die Karte wird für diese Sportarten (noch) nicht gespeichert – das sagt die App offen.
 * Welche Sportart zur laufenden Aufzeichnung gehört, merkt sich DIESES Gerät je Aufzeichnungs-id (kein
 * Gesundheitsdatum), damit sie auch nach einem Neustart der App stimmt.
 */

const S = t.sports;

interface StoredGpsSport {
  /** Aufzeichnungs-id; null = gerade gestartet (wird beim ersten Anzeigen gesetzt). */
  readonly recordingId: string | null;
  readonly sport: SportId;
}

/** Vor dem Start: Sportart merken (die Aufzeichnungs-id kommt erst mit dem Start). */
export async function rememberGpsSportart(sport: SportId): Promise<void> {
  await writeJson(deviceStore, STORAGE_KEYS.gpsSportRecording, {
    recordingId: null,
    sport,
  } satisfies StoredGpsSport).catch(() => undefined);
}

export async function forgetGpsSportart(): Promise<void> {
  await deviceStore.removeItem(STORAGE_KEYS.gpsSportRecording).catch(() => undefined);
}

/**
 * Sportart der laufenden Aufzeichnung: aus dem Aufruf (`sportart`) bzw. gemerkt für GENAU diese Aufzeichnung; sonst
 * null (normale Strecke Laufen/Rad/Gehen).
 */
export function useGpsSportart(param: unknown, recordingId: string | null): SportId | null {
  const fromParam = isSportId(param) ? param : null;
  const [stored, setStored] = useState<StoredGpsSport | null>(null);
  useEffect(() => {
    let alive = true;
    void readJson<StoredGpsSport>(deviceStore, STORAGE_KEYS.gpsSportRecording)
      .catch(() => null)
      .then(async (value) => {
        const valid = value && isSportId(value.sport) ? value : null;
        // Gerade gestartet: id dieser Aufzeichnung festhalten.
        if (recordingId && fromParam && (!valid || valid.recordingId !== recordingId)) {
          const next = { recordingId, sport: fromParam };
          await writeJson(deviceStore, STORAGE_KEYS.gpsSportRecording, next).catch(() => undefined);
          if (alive) setStored(next);
          return;
        }
        if (alive) setStored(valid);
      });
    return () => {
      alive = false;
    };
  }, [fromParam, recordingId]);
  if (fromParam) return fromParam;
  return stored && recordingId && stored.recordingId === recordingId ? stored.sport : null;
}

/** Speichern einer GPS-Sportart: Zusammenfassung, Anstrengung, Notiz; dann Tagebuch-Eintrag. */
export function SportRecordingSave({
  sport,
  onSaved,
  onDiscarded,
  onResume,
}: {
  sport: SportId;
  onSaved: (date: string) => void;
  onDiscarded: () => void;
  onResume: () => Promise<void>;
}) {
  const app = useApp();
  const current = useRecordingSession();
  const today = berlinTodayIso();
  const summary = useMemo(() => (current ? recordingSummary(current.state) : null), [current]);
  const values = summary ? sportEntryFromRecording(summary) : null;
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const kcalContext = useSessionKcalContext();
  if (!current || !summary || !app.session) return null;
  const name = sportName(sport);
  const day = values ? isoDateInTimeZone(values.startedAt) : today;
  const durationS = values ? (values.hours * 60 + values.minutes) * 60 : null;
  const kcal =
    durationS !== null
      ? kcalFor(kcalContext, {
          kind: 'strength',
          enduranceModality: null,
          effortTarget: null,
          durationS,
          measuredKcal: null,
          sport,
          effort,
        })
      : null;
  const load = sessionTrainingLoad({ durationS, effort, sport });
  const ownerUserId = app.session.userId;

  async function save() {
    if (!values) return;
    setBusy(true);
    setError(undefined);
    try {
      const draft = createSportDraft({
        ownerUserId,
        sport: {
          sport,
          hours: String(values.hours),
          minutes: String(values.minutes),
          distanceKm: values.distanceKm === null ? '' : formatDecimal(values.distanceKm),
        },
        performedOn: day,
        today,
        effort,
        notes,
        now: new Date().toISOString(),
        newId,
        startedAt: values.startedAt,
        finishedAt: values.finishedAt,
      });
      const outcome = await app.submitWorkout(draft);
      if (outcome.kind !== 'saved' && outcome.kind !== 'queued') {
        await app.discardDraft(draft.key).catch(() => undefined);
        setError(outcome.kind === 'invalid' ? S.errors.invalid : S.errors.rejected);
        return;
      }
      await endRecording();
      await forgetGpsSportart();
      onSaved(day);
    } catch {
      setError(S.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setConfirmDiscard(false);
    await endRecording();
    await forgetGpsSportart();
    onDiscarded();
  }

  return (
    <>
      <Card>
        <View style={styles.section} testID="sport-record-save">
          <Heading level={2}>{S.recording.saveTitle(name)}</Heading>
          <Body testID="sport-record-summary">
            {S.recording.summary(
              durationText(summary.movingS || summary.durationS),
              distanceText(summary.distanceM),
            )}
          </Body>
          <Notice tone="info">{S.recording.routeNote}</Notice>
          {values === null ? <Notice tone="warning">{S.recording.tooShort}</Notice> : null}
          <EffortSlider
            label={S.form.effortLabel}
            value={effort}
            onChange={setEffort}
            testID="sport-record-effort"
          />
          <TextField
            label={S.form.notes}
            value={notes}
            onChangeText={setNotes}
            multiline
            testID="sport-record-notes"
          />
          {kcal?.kcal != null ? <Body>{S.form.kcalPreview(formatKcal(kcal.kcal))}</Body> : null}
          {load !== null ? <Body muted>{S.form.loadPreview(load)}</Body> : null}
          <FieldError message={error} testID="sport-record-error" />
          <Button
            label={S.form.save}
            loading={busy}
            disabled={values === null}
            onPress={() => void save()}
            testID="sport-record-save-button"
          />
          <Button
            label={S.recording.resume}
            variant="secondary"
            onPress={() => void onResume()}
            testID="sport-record-resume"
          />
          <Button
            label={S.recording.discard}
            variant="danger"
            onPress={() => setConfirmDiscard(true)}
            testID="sport-record-discard"
          />
        </View>
      </Card>
      <ConfirmDialog
        visible={confirmDiscard}
        title={S.recording.discardConfirm}
        message={name}
        confirmLabel={S.recording.discardYes}
        onConfirm={() => void discard()}
        onCancel={() => setConfirmDiscard(false)}
        testID="sport-record-discard-dialog"
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
