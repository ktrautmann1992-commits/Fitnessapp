import type { StoryCard } from '@fitnessapp/core';
import { fontFamily } from '@fitnessapp/ui';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import { MARK_ALPHA, MARK_FIVE } from '@/components/brand';

import {
  hexAlpha,
  STORY_BADGE,
  STORY_H,
  STORY_LINE,
  STORY_W,
  type StoryBox,
  type StoryLayout,
  storyLayout,
  type StoryText,
  type StoryTheme,
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

function drawTexts(
  ctx: CanvasRenderingContext2D,
  layout: StoryLayout,
  layer: StoryText['layer'],
): void {
  for (const item of layout.texts) {
    if (item.layer !== layer) continue;
    ctx.fillStyle = layout.palette[item.tone];
    // App-Schrift (in index.html vorgeladen) – kein Nachladen beim Teilen, Vorschau und Bild gleich.
    ctx.font = `${item.bold ? '700' : '400'} ${item.size}px '${fontFamily.base}', system-ui, sans-serif`;
    ctx.textAlign = item.align;
    ctx.fillText(item.upper ? item.text.toUpperCase() : item.text, item.x, item.y, item.maxWidth);
  }
  ctx.textAlign = 'left';
}

export function drawStory(
  ctx: CanvasRenderingContext2D,
  card: StoryCard,
  theme: StoryTheme = 'neon',
): void {
  const layout = storyLayout(card, theme);
  const P = layout.palette;
  // Hintergrund: Verlauf, Leuchtpunkte, Schmuck-Linien, riesige Zahl.
  const bg = ctx.createLinearGradient(0, 0, 0, STORY_H);
  bg.addColorStop(0, P.bg[0]);
  bg.addColorStop(1, P.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  for (const g of layout.glows) {
    const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    glow.addColorStop(0, hexAlpha(g.color, g.opacity));
    glow.addColorStop(1, hexAlpha(g.color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
  }
  if (P.decorWidth > 0) {
    ctx.strokeStyle = hexAlpha(P.decor, P.decorOpacity);
    ctx.lineWidth = P.decorWidth;
    for (const d of layout.decor) ctx.stroke(new Path2D(d));
  }
  drawTexts(ctx, layout, 'back');
  const b = layout.badge;
  const badge = ctx.createRadialGradient(
    b.x + b.width / 2,
    b.y + b.height / 2,
    0,
    b.x + b.width / 2,
    b.y + b.height / 2,
    b.width * 0.7,
  );
  badge.addColorStop(0, STORY_BADGE.inner);
  badge.addColorStop(1, STORY_BADGE.outer);
  roundRect(ctx, b);
  ctx.fillStyle = badge;
  ctx.fill();
  ctx.save();
  ctx.translate(layout.logo.x, layout.logo.y);
  ctx.scale(layout.logo.width / 1133, layout.logo.width / 1133);
  ctx.fillStyle = STORY_BADGE.logo;
  ctx.fill(new Path2D(MARK_ALPHA));
  ctx.fill(new Path2D(MARK_FIVE));
  ctx.restore();
  if (layout.linePath) {
    const path = new Path2D(layout.linePath);
    const box = layout.lineBox;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const halo of STORY_LINE.glow) {
      ctx.strokeStyle = hexAlpha(P.lineGlow, halo.opacity);
      ctx.lineWidth = halo.width;
      ctx.stroke(path);
    }
    const stroke = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
    stroke.addColorStop(0, P.lineFrom);
    stroke.addColorStop(1, P.lineTo);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = STORY_LINE.width;
    ctx.stroke(path);
    if (layout.lineStart) {
      ctx.beginPath();
      ctx.arc(layout.lineStart.x, layout.lineStart.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = P.start;
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = P.startRing;
      ctx.stroke();
    }
    if (layout.lineEnd) {
      ctx.beginPath();
      ctx.arc(layout.lineEnd.x, layout.lineEnd.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = P.end;
      ctx.fill();
    }
  }
  for (const tile of layout.tiles) {
    roundRect(ctx, tile);
    ctx.fillStyle = hexAlpha(P.tile, P.tileOpacity);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hexAlpha(P.tileBorder, P.tileBorderOpacity);
    ctx.stroke();
  }
  drawTexts(ctx, layout, 'front');
}

async function storyBlob(card: StoryCard, theme: StoryTheme): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('story_failed');
  drawStory(ctx, card, theme);
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
  options: { title: string; download: boolean; theme: StoryTheme },
): Promise<StoryShareResult> {
  const blob = await storyBlob(card, options.theme);
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
