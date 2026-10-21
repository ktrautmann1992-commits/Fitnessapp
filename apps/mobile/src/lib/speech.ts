import { pickReadAloudVoice, READ_ALOUD, type SpeechVoiceInfo } from '@fitnessapp/core';

/**
 * Vorlesen im Browser (docs/PLAN-FIT-IM-ALTER.md 12 Nr. 5, Wächter S11): Web Speech API, NUR Stimmen mit
 * `localService = true` (Sprachausgabe auf dem Gerät). Gibt es keine, liefert `readAloudVoice()` null und der Knopf
 * bleibt ausgeblendet. iPhone/Android: speech.native.ts (expo-speech, Sprachausgabe des Geräts).
 */

const VOICE_WAIT_MS = 1500;

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : null;
}

function voicesNow(s: SpeechSynthesis): SpeechVoiceInfo[] {
  return s.getVoices().map((v) => ({
    identifier: v.voiceURI,
    language: v.lang,
    localService: v.localService,
  }));
}

/** Lokale deutsche Stimme oder null. Manche Browser laden die Stimmen erst nach `voiceschanged`. */
export async function readAloudVoice(): Promise<SpeechVoiceInfo | null> {
  const s = synth();
  if (!s) return null;
  const first = pickReadAloudVoice(voicesNow(s));
  if (first || s.getVoices().length > 0) return first;
  return new Promise((resolve) => {
    const done = () => {
      s.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
      resolve(pickReadAloudVoice(voicesNow(s)));
    };
    const timer = setTimeout(done, VOICE_WAIT_MS);
    s.addEventListener('voiceschanged', done);
  });
}

/** Text vorlesen (bricht eine laufende Ausgabe ab). `onEnd` kommt auch bei Fehler oder Abbruch. */
export function speak(text: string, voice: SpeechVoiceInfo, onEnd: () => void): void {
  const s = synth();
  if (!s) {
    onEnd();
    return;
  }
  const target = s.getVoices().find((v) => v.voiceURI === voice.identifier && v.localService);
  if (!target) {
    onEnd();
    return;
  }
  s.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = target;
  utterance.lang = target.lang;
  utterance.rate = READ_ALOUD.rate;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  s.speak(utterance);
}

export function stopSpeaking(): void {
  synth()?.cancel();
}
