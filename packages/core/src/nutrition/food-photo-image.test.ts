import { describe, expect, it } from 'vitest';

import { AI_FOOD_PHOTO } from '../constants';
import { checkPhotoImage, detectPhotoType } from './food-photo-image';

const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)),
  );
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const le32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const le24 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff];
const text = (bytesIn: Uint8Array) => String.fromCharCode(...bytesIn);

/** Kleines JPEG-Gerüst: APP0, APP1 (EXIF mit GPS), COM, SOF0 (w×h), SOS + Daten + EOI. */
function jpeg(width = 640, height = 480): Uint8Array {
  const exif = 'Exif\0\0GPSLatitude 52.52 GPSLongitude 13.40';
  const com = 'Kommentar: Wohnung Musterstrasse 1';
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe0, ...be16(16)],
    'JFIF\0',
    [1, 1, 0, 0, 1, 0, 1, 0, 0],
    [0xff, 0xe1, ...be16(exif.length + 2)],
    exif,
    [0xff, 0xfe, ...be16(com.length + 2)],
    com,
    [0xff, 0xc0, ...be16(11), 8, ...be16(height), ...be16(width), 1, 1, 0x11, 0],
    [0xff, 0xda, ...be16(8), 1, 1, 0, 0, 0x3f, 0],
    [0x12, 0x34, 0x56],
    [0xff, 0xd9],
  );
}

function pngChunk(type: string, data: number[]): number[] {
  return [...be32(data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
}

function png(width = 800, height = 600): Uint8Array {
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    pngChunk('IHDR', [...be32(width), ...be32(height), 8, 2, 0, 0, 0]),
    pngChunk(
      'tEXt',
      [...'Location\0Berlin'].map((c) => c.charCodeAt(0)),
    ),
    pngChunk(
      'eXIf',
      [...'MM GPS'].map((c) => c.charCodeAt(0)),
    ),
    pngChunk('IDAT', [1, 2, 3]),
    pngChunk('IEND', []),
  );
}

function webp(width = 1024, height = 768): Uint8Array {
  const chunk = (type: string, data: number[]) => [
    ...[...type].map((c) => c.charCodeAt(0)),
    ...le32(data.length),
    ...data,
    ...(data.length % 2 ? [0] : []),
  ];
  const vp8x = chunk('VP8X', [0x08 | 0x04, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]);
  const image = chunk('VP8L', [0x2f, 0, 0, 0, 0, 7]);
  const exif = chunk(
    'EXIF',
    [...'GPSLatitude'].map((c) => c.charCodeAt(0)),
  );
  const xmp = chunk(
    'XMP ',
    [...'<x:xmpmeta/>'].map((c) => c.charCodeAt(0)),
  );
  const body = [...'WEBP'].map((c) => c.charCodeAt(0)).concat(vp8x, image, exif, xmp);
  return bytes('RIFF', le32(body.length), body);
}

describe('Bildart am Inhalt erkennen', () => {
  it('JPEG, PNG, WebP; alles andere nicht', () => {
    expect(detectPhotoType(jpeg())).toBe('image/jpeg');
    expect(detectPhotoType(png())).toBe('image/png');
    expect(detectPhotoType(webp())).toBe('image/webp');
    expect(detectPhotoType(bytes('GIF89a'))).toBeNull();
    expect(detectPhotoType(bytes('<svg onload=alert(1)>'))).toBeNull();
    expect(detectPhotoType(new Uint8Array())).toBeNull();
    expect(checkPhotoImage(bytes('%PDF-1.7'))).toEqual({ ok: false, reason: 'type' });
  });
});

describe('Metadaten entfernen (EXIF/Standort)', () => {
  it('JPEG: APP1 und Kommentar weg, Bild bleibt', () => {
    const r = checkPhotoImage(jpeg());
    if (!r.ok) throw new Error(r.reason);
    expect(r).toMatchObject({ mimeType: 'image/jpeg', width: 640, height: 480 });
    expect(text(r.bytes)).not.toContain('GPS');
    expect(text(r.bytes)).not.toContain('Musterstrasse');
    expect(text(r.bytes)).toContain('JFIF');
    expect([...r.bytes.slice(-5)]).toEqual([0x12, 0x34, 0x56, 0xff, 0xd9]);
  });

  it('PNG: Text- und EXIF-Chunks weg', () => {
    const r = checkPhotoImage(png());
    if (!r.ok) throw new Error(r.reason);
    expect(r).toMatchObject({ mimeType: 'image/png', width: 800, height: 600 });
    expect(text(r.bytes)).not.toContain('Berlin');
    expect(text(r.bytes)).not.toContain('eXIf');
    expect(text(r.bytes)).toContain('IDAT');
  });

  it('WebP: EXIF/XMP weg, Merker gelöscht, RIFF-Größe stimmt', () => {
    const r = checkPhotoImage(webp());
    if (!r.ok) throw new Error(r.reason);
    expect(r).toMatchObject({ mimeType: 'image/webp', width: 1024, height: 768 });
    expect(text(r.bytes)).not.toContain('GPS');
    expect(text(r.bytes)).not.toContain('xmpmeta');
    expect((r.bytes[20] ?? 0) & 0x0c).toBe(0);
    const size = (r.bytes[4] ?? 0) | ((r.bytes[5] ?? 0) << 8) | ((r.bytes[6] ?? 0) << 16);
    expect(size).toBe(r.bytes.length - 8);
  });
});

describe('Grenzen', () => {
  it('1.024 px gehen, 1.025 nicht', () => {
    expect(checkPhotoImage(jpeg(1024, 1024)).ok).toBe(true);
    expect(checkPhotoImage(jpeg(1025, 10))).toEqual({ ok: false, reason: 'too_large_px' });
    expect(checkPhotoImage(png(10, 1025))).toEqual({ ok: false, reason: 'too_large_px' });
    expect(checkPhotoImage(webp(1025, 10))).toEqual({ ok: false, reason: 'too_large_px' });
  });

  it('über 4 MB → zu groß', () => {
    const big = new Uint8Array(AI_FOOD_PHOTO.maxImageBytes + 1);
    big.set(jpeg());
    expect(checkPhotoImage(big)).toEqual({ ok: false, reason: 'too_big' });
  });

  it('abgeschnittene bzw. kaputte Dateien', () => {
    const j = jpeg();
    expect(checkPhotoImage(j.slice(0, 30))).toEqual({ ok: false, reason: 'broken' });
    expect(checkPhotoImage(bytes([0xff, 0xd8, 0xff, 0xd9]))).toEqual({
      ok: false,
      reason: 'broken',
    });
    const p = png();
    expect(checkPhotoImage(p.slice(0, p.length - 12))).toEqual({ ok: false, reason: 'broken' });
    expect(checkPhotoImage(bytes('RIFF', [4, 0, 0, 0], 'WEBP'))).toEqual({
      ok: false,
      reason: 'broken',
    });
  });
});
