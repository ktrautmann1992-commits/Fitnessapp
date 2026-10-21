import { pickReadAloudVoice, READ_ALOUD, type SpeechVoiceInfo } from '@fitnessapp/core';
import * as Speech from 'expo-speech';

/**
 * Vorlesen auf iPhone/Android (docs/PLAN-FIT-IM-ALTER.md 12 Nr. 5): Sprachausgabe des Geräts über expo-speech.
 * Stimmen des Geräts gelten als lokal; ohne deutsche Stimme liefert `readAloudVoice()` null (Knopf ausgeblendet).
 */
export async function readAloudVoice(): Promise<SpeechVoiceInfo | null> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return pickReadAloudVoice(
      voices.map((v) => ({ identifier: v.identifier, language: v.language, localService: true })),
    );
  } catch {
    return null;
  }
}

export function speak(text: string, voice: SpeechVoiceInfo, onEnd: () => void): void {
  void Speech.stop();
  Speech.speak(text, {
    language: voice.language,
    voice: voice.identifier,
    rate: READ_ALOUD.rate,
    onDone: onEnd,
    onStopped: onEnd,
    onError: onEnd,
  });
}

export function stopSpeaking(): void {
  void Speech.stop();
}
