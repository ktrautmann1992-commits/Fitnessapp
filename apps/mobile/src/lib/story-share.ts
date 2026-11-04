import type { StoryCard } from '@fitnessapp/core';
import { brandColors, fontFamily } from '@fitnessapp/ui';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import { MARK_ALPHA, MARK_FIVE } from '@/components/brand';

import {
  hexAlpha,
  STORY_COLORS,
  STORY_H,
  STORY_LINE,
  STORY_W,
  type StoryBox,
  storyLayout,
} from './story-layout';

/**
 * Story-Bild im Browser (Etappe E6): Canvas 2D (1080 × 1920) → `navigator.share({ files })`, sonst Download. Nur auf
 * ausdrücklichen Tipp, kein Upload, kein Server. Gegenstück für iPhone/Android: story-share.native.ts.
 */
export type StoryShareResult = 'shared' | 'downloaded' | 'cancelled';

export const STORY_FILE_NAME = 'alpha5-einheit.png';

function roundRect(ctx: CanvasRenderingContext2D, b: StoryBox): void {
  const r = Math.min(b.radius, b.width / 2, b.height / 2);
  ctx.beginPath();
  ctx.moveTo(b.x + r, b.y);
  ctx.arcTo(b.x + b.width, b.y, b.x + b.width, b.y + b.height, r);
  ctx.arcTo(b.x + b.width, b.y + b.height, b.x, b.y + b.height, r);
  ctx.arcTo(b.x, b.y + b.height, b.x, b.y, r);
  ctx.arcTo(b.x, b.y, b.x + b.width, b.y, r);
  ctx.closePath();
}

export function drawStory(ctx: CanvasRenderingContext2D, card: StoryCard): void {
  const layout = storyLayout(card);
  const C = STORY_COLORS;
  // Hintergrund: Verlauf + Leuchtpunkt + Ringe.
  const bg = ctx.createLinearGradient(0, 0, 0, STORY_H);
  bg.addColorStop(0, C.bgTop);
  bg.addColorStop(1, C.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  const g = layout.glow;
  const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
  glow.addColorStop(0, hexAlpha(C.glow, 0.38));
  glow.addColorStop(1, hexAlpha(C.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  ctx.strokeStyle = hexAlpha(C.ring, 0.07);
  ctx.lineWidth = 3;
  for (const r of layout.rings.radii) {
    ctx.beginPath();
    ctx.arc(layout.rings.x, layout.rings.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(layout.logo.x, layout.logo.y);
  ctx.scale(layout.logo.width / 1133, layout.logo.width / 1133);
  ctx.fillStyle = brandColors.blau;
  ctx.fill(new Path2D(MARK_ALPHA));
  ctx.fill(new Path2D(MARK_FIVE));
  ctx.restore();
  if (layout.linePath) {
    const path = new Path2D(layout.linePath);
    const box = layout.lineBox;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const halo of STORY_LINE.glow) {
      ctx.strokeStyle = hexAlpha(C.lineTo, halo.opacity);
      ctx.lineWidth = halo.width;
      ctx.stroke(path);
    }
    const stroke = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
    stroke.addColorStop(0, C.lineFrom);
    stroke.addColorStop(1, C.lineTo);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = STORY_LINE.width;
    ctx.stroke(path);
    if (layout.lineStart) {
      ctx.beginPath();
      ctx.arc(layout.lineStart.x, layout.lineStart.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = C.start;
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = C.lineTo;
      ctx.stroke();
    }
    if (layout.lineEnd) {
      ctx.beginPath();
      ctx.arc(layout.lineEnd.x, layout.lineEnd.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = C.end;
      ctx.fill();
    }
  }
  for (const tile of layout.tiles) {
    roundRect(ctx, tile);
    ctx.fillStyle = hexAlpha(C.tile, 0.82);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.tileBorder;
    ctx.stroke();
  }
  for (const item of layout.texts) {
    ctx.fillStyle = C[item.tone];
    // App-Schrift (in index.html vorgeladen) – kein Nachladen beim Teilen, Vorschau und Bild gleich.
    ctx.font = `${item.bold ? '700' : '400'} ${item.size}px '${fontFamily.base}', system-ui, sans-serif`;
    ctx.textAlign = item.align;
    ctx.fillText(item.upper ? item.text.toUpperCase() : item.text, item.x, item.y, item.maxWidth);
  }
  ctx.textAlign = 'left';
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
