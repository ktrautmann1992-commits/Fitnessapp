import type { StoryCard } from '@fitnessapp/core';
import { brandColors } from '@fitnessapp/ui';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import { MARK_ALPHA, MARK_FIVE } from '@/components/brand';

import { STORY_H, STORY_W, storyLayout } from './story-layout';

/**
 * Story-Bild im Browser (Etappe E6): Canvas 2D (1080 × 1920) → `navigator.share({ files })`, sonst Download. Nur auf
 * ausdrücklichen Tipp, kein Upload, kein Server. Gegenstück für iPhone/Android: story-share.native.ts.
 */
export type StoryShareResult = 'shared' | 'downloaded' | 'cancelled';

export const STORY_FILE_NAME = 'alpha5-einheit.png';

export function drawStory(ctx: CanvasRenderingContext2D, card: StoryCard): void {
  const layout = storyLayout(card);
  ctx.fillStyle = brandColors.schwarz;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  ctx.save();
  ctx.translate(layout.logo.x, layout.logo.y);
  ctx.scale(layout.logo.width / 1133, layout.logo.width / 1133);
  ctx.fillStyle = brandColors.blau;
  ctx.fill(new Path2D(MARK_ALPHA));
  ctx.fill(new Path2D(MARK_FIVE));
  ctx.restore();
  if (layout.linePath) {
    ctx.strokeStyle = brandColors.blau;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(layout.linePath));
  }
  for (const item of layout.texts) {
    ctx.fillStyle = item.muted ? brandColors.grauDunkel : brandColors.weiss;
    ctx.font = `${item.bold ? '700' : '400'} ${item.size}px Archivo, system-ui, sans-serif`;
    ctx.fillText(item.text, item.x, item.y, STORY_W - item.x - 40);
  }
}

async function storyBlob(card: StoryCard): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('story_failed');
  drawStory(ctx, card);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('story_failed'))),
      'image/png',
    ),
  );
}

export async function shareStory(
  card: StoryCard,
  _view: RefObject<View | null>,
  options: { title: string; download: boolean },
): Promise<StoryShareResult> {
  const blob = await storyBlob(card);
  const file = new File([blob], STORY_FILE_NAME, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (!options.download && typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: options.title });
      return 'shared';
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return 'cancelled';
      // Teilen nicht möglich → Download als Rückfall.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = STORY_FILE_NAME;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return 'downloaded';
}

/** Browser: Teilen über Web Share API, sonst Download. */
export const STORY_SHARE_KIND = 'web' as const;
