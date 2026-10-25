import {
  DEFAULT_VOICE_CUE_SETTINGS,
  type VoiceCueInterval,
  type VoiceCueSettings,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SectionLabel } from '@/components/design';
import { ToggleRow } from '@/components/my-routes';
import { Body, Button, Card, Checkbox, ChoiceList } from '@/components/ui';
import { deviceStore } from '@/data/create-backend';
import { t } from '@/i18n';
import { readAloudVoice, speak } from '@/lib/speech';
import { readVoiceSettings, writeVoiceSettings } from '@/lib/voice-coach';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';

const V = t.endurance.voice;
const listeners = new Set<() => void>();

/** Einstellung „Sprachansagen“ je Konto auf diesem Gerät; alle offenen Ansichten folgen einer Änderung. */
export function useVoiceSettings(): {
  readonly loaded: boolean;
  readonly settings: VoiceCueSettings;
  readonly update: (changes: Partial<VoiceCueSettings>) => void;
} {
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const [state, setState] = useState({ loaded: false, settings: DEFAULT_VOICE_CUE_SETTINGS });
  const load = useCallback(() => {
    if (!userId) return;
    void readVoiceSettings(deviceStore, userId).then((settings) =>
      setState({ loaded: true, settings }),
    );
  }, [userId]);
  useEffect(() => {
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, [load]);
  const update = useCallback(
    (changes: Partial<VoiceCueSettings>) => {
      if (!userId) return;
      setState((current) => {
        const settings = { ...current.settings, ...changes };
        void writeVoiceSettings(deviceStore, userId, settings)
          .catch(() => undefined)
          .then(() => {
            for (const l of listeners) if (l !== load) l();
          });
        return { loaded: true, settings };
      });
    },
    [load, userId],
  );
  return { ...state, update };
}

/** Einstellungen: Ein/Aus, Abstand, Inhalte, Probe-Ansage. */
export function VoiceCueSettingsCard({ compact = false }: { compact?: boolean }) {
  const app = useApp();
  const { loaded, settings, update } = useVoiceSettings();
  const [hasVoice, setHasVoice] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void readAloudVoice().then((v) => {
      if (alive) setHasVoice(v !== null);
    });
    return () => {
      alive = false;
    };
  }, []);
  const consent = app.rows !== null && healthConsentStatus(app.rows, app.versions) === 'valid';
  async function probe() {
    const voice = await readAloudVoice();
    if (voice) speak(V.testText, voice, () => undefined);
  }
  return (
    <Card>
      <View style={styles.gap} testID="voice-settings">
        {compact ? null : <SectionLabel>{V.title}</SectionLabel>}
        <ToggleRow
          label={V.toggle}
          value={settings.enabled}
          disabled={!loaded || hasVoice === false}
          onChange={(enabled) => update({ enabled })}
          testID="voice-enabled"
        />
        {hasVoice === false ? <Body muted>{V.noVoice}</Body> : <Body muted>{V.intro}</Body>}
        {settings.enabled && !compact ? (
          <>
            <ChoiceList<VoiceCueInterval>
              label={V.interval}
              options={(['km', 'half_km', 'time'] as const).map((value) => ({
                value,
                label: V.intervals[value],
              }))}
              value={settings.interval}
              onChange={(interval) => update({ interval })}
            />
            <SectionLabel level={3}>{V.content}</SectionLabel>
            <Checkbox
              label={V.pace}
              checked={settings.pace}
              onChange={(pace) => update({ pace })}
              testID="voice-pace"
            />
            <Checkbox
              label={V.time}
              checked={settings.time}
              onChange={(time) => update({ time })}
              testID="voice-time"
            />
            {consent ? (
              <>
                <Checkbox
                  label={V.heartRate}
                  checked={settings.heartRate}
                  onChange={(heartRate) => update({ heartRate })}
                  testID="voice-heart-rate"
                />
                <Body muted>{V.heartRateNote}</Body>
              </>
            ) : (
              <Body muted>{V.heartRateNoConsent}</Body>
            )}
            <Body muted>{V.sameRoute}</Body>
            <Body muted>{V.intervalsInfo}</Body>
            {hasVoice ? (
              <Button
                label={V.test}
                variant="secondary"
                onPress={() => void probe()}
                testID="voice-test"
              />
            ) : null}
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ gap: { gap: spacing.sm } });
