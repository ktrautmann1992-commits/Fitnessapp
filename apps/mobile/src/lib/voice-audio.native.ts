import { setAudioModeAsync } from 'expo-audio';

/**
 * Audio-Modus für Sprachansagen (25.10.2026, expo-audio): während einer Aufzeichnung mit eingeschalteten Ansagen
 * „duckOthers“ (laufende Musik wird für die Ansage leiser statt gestoppt), Ton auch im Stumm-Modus von iOS und bei
 * gesperrtem Bildschirm (Hintergrundmodus `audio`, app.config.ts). Keine Aufnahme, kein Mikrofon. Fehler still – die
 * Ansage kommt dann ohne Ducking.
 */
export async function enableCueAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: true,
    allowsRecording: false,
  }).catch(() => undefined);
}

/** Nach der Aufzeichnung: Standard wieder herstellen (andere Apps spielen normal weiter). */
export async function disableCueAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: false,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
    allowsRecording: false,
  }).catch(() => undefined);
}
