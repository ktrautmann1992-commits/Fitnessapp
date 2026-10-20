import type { StoryCard } from '@fitnessapp/core';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { STORY_H, STORY_W } from './story-layout';

/**
 * Story-Bild auf iPhone/Android (Etappe E6): Ansicht (StoryCardView) mit react-native-view-shot als PNG 1080 × 1920
 * in den Cache aufnehmen → System-Teilen-Dialog (expo-sharing; dort auch „Bild sichern“). Die Datei wird beim nächsten
 * Teilen gelöscht (nicht sofort: manche Ziel-Apps lesen sie erst nach dem Schließen des Dialogs); den Cache leert
 * zusätzlich das System. Keine Mediathek-Berechtigung, kein Upload, kein Server, nur auf ausdrücklichen Tipp.
 */
export type StoryShareResult = 'shared' | 'downloaded' | 'cancelled';

let previousUri: string | null = null;

function removeFile(uri: string | null): void {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Datei schon weg – nichts zu tun.
  }
}

export async function shareStory(
  _card: StoryCard,
  view: RefObject<View | null>,
  options: { title: string; download: boolean },
): Promise<StoryShareResult> {
  if (!view.current) throw new Error('story_failed');
  removeFile(previousUri);
  previousUri = null;
  if (!(await Sharing.isAvailableAsync())) throw new Error('share_unavailable');
  const uri = await captureRef(view, {
    format: 'png',
    quality: 1,
    width: STORY_W,
    height: STORY_H,
    result: 'tmpfile',
  });
  previousUri = uri;
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: options.title,
  });
  return 'shared';
}

/** App: Teilen-Dialog des Systems (dort auch „Bild sichern“). */
export const STORY_SHARE_KIND = 'native' as const;
