import {
  GPX_IMPORT,
  type GpxImportError,
  type GpxImportSummary,
  hikingTimeEstimate,
  importGpx,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, ChoiceList, Heading, Notice, TextField } from '@/components/ui';
import { t } from '@/i18n';
import { demoGpxText } from '@/lib/demo-gpx';
import { LOOP_NAME_MAX, type SavedLoop, toSavedGpxRoute } from '@/lib/loop-store';
import { type GpxPurpose, GPX_PURPOSES, purposeToSport } from '@/lib/gpx-route';
import { pickTextFile, TEXT_FILE_PICK_SUPPORTED } from '@/lib/text-file-pick';

const G = t.loop.gpx;
const H = t.endurance.hiking;

type State =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; error: GpxImportError | 'cancelled' | 'unreadable' }
  | { kind: 'ready'; summary: GpxImportSummary; name: string; purpose: GpxPurpose };

/**
 * GPX-Datei einlesen (Sportarten Stufe 1 · Wandern): Datei wählen → auf dem Gerät lesen (packages/core importGpx) →
 * Zusammenfassung mit Höhen und Gehzeit → als gemerkte Strecke ablegen (nur dieses Gerät). Im Testmodus zusätzlich eine
 * Beispiel-Tour ohne Datei.
 */
export function GpxImportCard({
  testMode,
  onSave,
  onAnnounce,
}: {
  testMode: boolean;
  /** Speichern; `id` und `saved_at` setzt der Aufrufer neu. */
  onSave: (route: SavedLoop) => Promise<boolean>;
  onAnnounce: (text: string) => void;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [message, setMessage] = useState<string | null>(null);

  function load(text: string, fileName: string | null) {
    const result = importGpx(text);
    if (!result.ok) {
      setState({ kind: 'error', error: result.error });
      onAnnounce(G.errors[result.error]);
      return;
    }
    const fallback = fileName ? fileName.replace(/\.gpx$/i, '') : '';
    setState({
      kind: 'ready',
      summary: result,
      name: (result.name ?? fallback).slice(0, LOOP_NAME_MAX),
      purpose: 'hike',
    });
    onAnnounce(G.summary);
  }

  async function open() {
    setMessage(null);
    setState({ kind: 'reading' });
    const picked = await pickTextFile({
      accept: '.gpx,application/gpx+xml,application/xml,text/xml',
      // Zeichen ≤ Bytes: dieselbe Grenze reicht für die Vorprüfung der Dateigröße.
      maxBytes: GPX_IMPORT.maxFileChars,
    });
    if (picked.kind === 'ok') {
      load(picked.text, picked.name);
      return;
    }
    if (picked.kind === 'cancelled') {
      setState({ kind: 'idle' });
      return;
    }
    const error = picked.kind === 'unsupported' ? 'unreadable' : picked.kind;
    setState({ kind: 'error', error });
    onAnnounce(G.errors[error]);
  }

  async function save() {
    if (state.kind !== 'ready') return;
    const { sport, walkKind } = purposeToSport(state.purpose);
    const route = toSavedGpxRoute(state.summary, {
      name: state.name,
      sport,
      walkKind,
      id: 'tmp',
      now: new Date().toISOString(),
    });
    if (await onSave(route)) {
      setState({ kind: 'idle' });
      setMessage(G.saved);
      onAnnounce(G.saved);
    }
  }

  const ready = state.kind === 'ready' ? state : null;
  const time = ready
    ? hikingTimeEstimate({
        distanceM: ready.summary.distanceM,
        gainM: ready.summary.ascentM,
        lossM: ready.summary.descentM,
      })
    : null;
  const walking = ready ? purposeToSport(ready.purpose).sport === 'walk' : false;

  return (
    <Card>
      <View style={styles.section} testID="gpx-import">
        <Heading level={2}>{G.title}</Heading>
        <Body muted>{G.intro}</Body>
        {TEXT_FILE_PICK_SUPPORTED ? (
          <Button
            label={state.kind === 'reading' ? G.reading : G.open}
            icon="plus"
            variant="secondary"
            loading={state.kind === 'reading'}
            onPress={() => void open()}
            testID="gpx-open"
          />
        ) : (
          <Body muted>{G.unsupported}</Body>
        )}
        {testMode ? (
          <Button
            label={G.demo}
            variant="secondary"
            onPress={() => load(demoGpxText(), null)}
            testID="gpx-demo"
          />
        ) : null}
        <Body muted style={styles.small}>
          {G.privacy}
        </Body>
        {state.kind === 'error' ? (
          <Notice tone="warning" testID="gpx-error">
            {G.errors[state.error]}
          </Notice>
        ) : null}
        {message ? (
          <Notice tone="success" testID="gpx-saved">
            {message}
          </Notice>
        ) : null}
        {ready ? (
          <View style={styles.section} testID="gpx-summary">
            <Body style={styles.strong}>{G.summary}</Body>
            <Body>{`${G.distance}: ${t.loop.distanceValue(ready.summary.distanceM)}`}</Body>
            {ready.summary.ascentM !== null ? (
              <Body>{`${G.ascent}: ${H.approx(ready.summary.ascentM)}`}</Body>
            ) : null}
            {ready.summary.descentM !== null ? (
              <Body>{`${G.descent}: ${H.approx(ready.summary.descentM)}`}</Body>
            ) : null}
            {ready.summary.maxAltitudeM !== null ? (
              <Body>{`${G.highest}: ${H.approx(ready.summary.maxAltitudeM)}`}</Body>
            ) : null}
            {ready.summary.ascentM === null && ready.summary.descentM === null ? (
              <Body muted>{G.noElevation}</Body>
            ) : null}
            {walking && time ? (
              <View testID="gpx-time">
                <Body>{`${H.timeLabel}: ${H.timeValue(time.minutes)}`}</Body>
                <Body muted style={styles.small}>
                  {time.withoutElevation ? H.timeNoElevation : H.timeNote}
                </Body>
              </View>
            ) : null}
            {ready.summary.skipped > 0 ? (
              <Body muted>{G.skipped(ready.summary.skipped)}</Body>
            ) : null}
            <TextField
              label={G.nameLabel}
              value={ready.name}
              onChangeText={(name) => setState({ ...ready, name })}
              maxLength={LOOP_NAME_MAX}
              testID="gpx-name"
            />
            <ChoiceList<GpxPurpose>
              label={G.sportLabel}
              options={GPX_PURPOSES.map((value) => ({
                value,
                label: G.sports[value],
                testID: `gpx-purpose-${value}`,
              }))}
              value={ready.purpose}
              onChange={(purpose) => setState({ ...ready, purpose })}
              horizontal
            />
            <View style={styles.row}>
              <Button
                label={G.cancel}
                variant="secondary"
                onPress={() => setState({ kind: 'idle' })}
              />
              <Button
                label={G.save}
                disabled={ready.name.trim() === ''}
                onPress={() => void save()}
                testID="gpx-save"
              />
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  small: { fontSize: 12 },
  strong: { fontWeight: '700' },
});
