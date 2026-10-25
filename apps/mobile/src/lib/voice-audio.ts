/**
 * Audio-Modus für Sprachansagen – Browser: nichts zu tun (die Web Speech API mischt sich selbst ein). iPhone/Android:
 * voice-audio.native.ts (expo-audio: andere Musik leiser, auch bei gesperrtem Bildschirm).
 */
export async function enableCueAudio(): Promise<void> {
  // Browser: kein eigener Audio-Modus.
}

export async function disableCueAudio(): Promise<void> {
  // Browser: kein eigener Audio-Modus.
}
