import {
  type ReadAloudExercise,
  readAloudExerciseText,
  type SpeechVoiceInfo,
} from '@fitnessapp/core';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui';
import { t } from '@/i18n';
import { useAccessibility } from '@/lib/accessibility';
import { readAloudVoice, speak, stopSpeaking } from '@/lib/speech';

/**
 * Vorlesen (docs/PLAN-FIT-IM-ALTER.md 12 Nr. 5, Etappe FA5): lokale deutsche Stimme des Geräts. `undefined` = wird
 * noch gesucht, `null` = keine passende Stimme (Knopf bleibt aus).
 */
export function useReadAloudVoice(): SpeechVoiceInfo | null | undefined {
  const [voice, setVoice] = useState<SpeechVoiceInfo | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    readAloudVoice()
      .catch(() => null)
      .then((found) => {
        if (alive) setVoice(found);
      });
    return () => {
      alive = false;
    };
  }, []);
  return voice;
}

/**
 * Knopf „Anleitung vorlesen“: nur sichtbar, wenn Vorlesen in den Einstellungen an ist UND eine lokale Stimme da ist.
 * Liest NUR die Anleitung (Text aus packages/core) – nie Gesundheitsdaten oder Planwerte.
 */
export function ReadAloudButton({ exercise }: { exercise: ReadAloudExercise }) {
  const { settings } = useAccessibility();
  const voice = useReadAloudVoice();
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!settings.readAloud || !voice) return null;
  const a = t.accessibility;
  return (
    <Button
      label={speaking ? a.readAloudStop : a.readAloudButton}
      icon={speaking ? 'stop' : 'play'}
      variant="secondary"
      accessibilityLabel={speaking ? a.readAloudStop : a.readAloudA11y(exercise.name)}
      onPress={() => {
        if (speaking) {
          stopSpeaking();
          setSpeaking(false);
          return;
        }
        setSpeaking(true);
        speak(readAloudExerciseText(exercise), voice, () => setSpeaking(false));
      }}
      testID="read-aloud"
    />
  );
}
