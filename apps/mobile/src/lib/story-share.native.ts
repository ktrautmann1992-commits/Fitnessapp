import type { StoryCard } from '@fitnessapp/core';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { STORY_H, STORY_W } from './story-layout';

/**
 * Story-Bild auf iPhone/Android (Etappe E6): Ansicht (StoryCardView) mit react-native-view-shot als PNG 1080 × 1920
 * in den Cache aufnehmen → System-Teilen-Dialog (expo-sharing; dort auch „Bild sichern“) → Datei danach löschen.
 * Keine Mediathek-Berechtigung, kein Upload, kein Server, nur auf ausdrücklichen Tipp.
 */
export type StoryShareResult = 'shared' | 'downloaded' | 'cancelled';

export async function shareStory(
  _card: StoryCard,
  view: RefObject<View | null>,
  options: { title: string; download: boolean },
): Promise<StoryShareResult> {
  if (!view.current) throw new Error('story_failed');
  if (!(await Sharing.isAvailableAsync())) throw new Error('share_unavailable');
  const uri = await captureRef(view, {
    format: 'png',
    quality: 1,
    width: STORY_W,
    height: STORY_H,
    result: 'tmpfile',
  });
  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: options.title,
    });
    return 'shared';
  } finally {
    try {
      new File(uri).delete();
    } catch {
      // Datei schon weg – nichts zu tun (Cache wird vom System geleert).
    }
  }
}

/** App: Teilen-Dialog des Systems (dort auch „Bild sichern“). */
export const STORY_SHARE_KIND = 'native' as const;
