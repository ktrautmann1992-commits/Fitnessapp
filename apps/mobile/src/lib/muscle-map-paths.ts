import type { MuscleGroup, MuscleMapView } from '@fitnessapp/core';

/**
 * Eigene, selbst gezeichnete Muskelkarte (Nachtrag „Muskelkarte“ in docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md):
 * stilisiert-anatomische Silhouette vorn und hinten, keine fremden Vorlagen. Koordinaten je Ansicht im Raster
 * 200 × 440; Körpermitte x = 100.
 *
 * - `half`: Umriss der LINKEN Bildhälfte – wird beim Zeichnen an der Körpermitte gespiegelt (symmetrisch).
 * - `center`: Umriss über die Mitte, nicht gespiegelt (z. B. Kopf).
 * Welche Muskelgruppe in welcher Ansicht vorkommt, steht in packages/core (MUSCLE_MAP_REGIONS); ein Test
 * (muscle-map-paths.test.ts) stellt sicher, dass jede dort genannte Region hier einen Umriss hat.
 */

export const MUSCLE_MAP_WIDTH = 200;
export const MUSCLE_MAP_HEIGHT = 440;
export const MUSCLE_MAP_CENTER_X = MUSCLE_MAP_WIDTH / 2;

export interface MuscleMapShape {
  readonly half?: readonly string[];
  readonly center?: readonly string[];
}

/** Körper-Umriss (linke Hälfte, ragt 1 Einheit über die Mitte, damit beim Spiegeln keine Naht sichtbar ist). */
const BODY_HALF =
  'M101,58 L91,58 C91,65 90,69 88,72 C80,76 68,78 58,82 C46,86 38,96 37,110 C35,126 34,142 33,158 ' +
  'C32,170 30,180 29,188 C26,206 22,226 20,246 C19,252 16,258 15,266 C14,276 18,284 23,282 ' +
  'C27,280 28,270 29,262 C31,256 32,250 33,246 C38,226 43,206 46,190 C48,178 50,166 52,152 ' +
  'C53,142 54,132 56,126 C59,140 61,156 62,172 C63,186 62,198 61,210 C59,222 57,236 57,250 ' +
  'C57,276 59,300 62,322 C63,334 62,342 61,350 C59,370 62,392 66,410 C66,416 62,422 60,428 ' +
  'C59,434 66,436 76,436 C82,436 85,432 84,426 C83,418 84,412 85,406 C88,388 89,368 88,350 ' +
  'C88,340 89,332 90,322 C93,300 95,276 96,252 C97,246 98,242 101,240 Z';

const HEAD =
  'M100,8 C112,8 121,18 121,34 C121,48 112,60 100,60 C88,60 79,48 79,34 C79,18 88,8 100,8 Z';

export const MUSCLE_MAP_BODY: Readonly<Record<MuscleMapView, MuscleMapShape>> = {
  front: { half: [BODY_HALF], center: [HEAD] },
  back: { half: [BODY_HALF], center: [HEAD] },
};

const FOREARM =
  'M38,192 C33,206 28,222 25,238 C27,243 30,243 32,241 C37,224 42,208 46,193 C44,189 40,189 38,192 Z';

/** Muskel-Regionen je Ansicht. */
export const MUSCLE_MAP_PATHS: Readonly<
  Record<MuscleMapView, Partial<Record<MuscleGroup, MuscleMapShape>>>
> = {
  front: {
    // Kapuzenmuskel, oberer Anteil zwischen Hals und Schulter.
    upper_back: { half: ['M87,74 C80,78 70,80 62,83 C70,86 79,86 86,84 C88,80 88,77 87,74 Z'] },
    side_delts: {
      half: [
        'M56,84 C46,88 40,97 39,110 C39,118 40,124 42,129 C43,116 46,104 51,95 C53,91 55,87 56,84 Z',
      ],
    },
    front_delts: {
      half: [
        'M60,86 C54,91 49,101 46,113 C45,121 46,128 48,132 C54,126 60,117 64,107 C66,99 65,91 60,86 Z',
      ],
    },
    chest: {
      half: [
        'M98,89 C90,87 78,87 69,91 C65,97 63,104 62,112 C62,124 67,132 77,134 C87,136 94,132 98,126 Z',
      ],
    },
    biceps: {
      half: [
        'M44,137 C40,149 38,161 39,173 C41,179 45,181 48,179 C51,167 53,153 54,139 C51,134 47,134 44,137 Z',
      ],
    },
    forearms: { half: [FOREARM] },
    abs: {
      half: ['M99,139 L89,139 C87,157 87,181 88,201 C89,215 93,226 99,234 Z'],
    },
    obliques: {
      half: [
        'M85,141 C77,139 69,143 65,151 C65,167 65,187 64,205 C71,210 79,212 86,214 C85,194 84,166 85,141 Z',
      ],
    },
    quadriceps: {
      half: [
        'M63,236 C59,256 59,282 62,306 C64,316 69,322 77,322 C84,322 88,314 89,302 C90,284 89,266 86,250 C80,243 71,238 63,236 Z',
      ],
    },
    adductors: {
      half: ['M89,253 C92,267 93,283 91,299 C94,289 97,273 98,257 C96,253 92,251 89,253 Z'],
    },
    calves: {
      half: [
        'M63,350 C60,366 62,382 66,398 C68,384 69,368 68,353 C67,350 65,349 63,350 Z',
        'M86,353 C88,367 87,383 84,396 C82,382 81,367 82,355 C83,352 85,352 86,353 Z',
      ],
    },
  },
  back: {
    // Kapuzenmuskel und Rautenmuskeln.
    upper_back: {
      half: [
        'M99,62 L92,64 C90,70 88,74 84,77 C76,81 67,83 61,85 C69,91 78,100 84,112 C90,124 95,138 99,150 Z',
      ],
    },
    rear_delts: {
      half: ['M58,86 C48,89 42,97 40,108 C45,112 53,112 60,106 C64,99 63,91 58,86 Z'],
    },
    side_delts: {
      half: ['M38,104 C36,114 37,122 40,128 C42,121 44,115 48,111 C44,110 40,108 38,104 Z'],
    },
    triceps: {
      half: [
        'M42,127 C38,143 36,159 37,175 C40,181 45,181 48,177 C52,161 54,145 55,131 C51,125 46,124 42,127 Z',
      ],
    },
    forearms: { half: [FOREARM] },
    lats: {
      half: [
        'M63,110 C71,110 78,116 84,124 C90,136 94,148 97,158 C93,172 86,186 76,196 C70,184 66,166 64,148 C62,134 62,122 63,110 Z',
      ],
    },
    lower_back: { half: ['M99,157 C95,161 92,167 91,177 C90,191 90,205 92,217 L99,218 Z'] },
    glutes: {
      half: ['M99,221 L88,219 C74,221 63,231 61,247 C61,261 70,271 84,271 C92,271 98,265 99,257 Z'],
    },
    hamstrings: {
      half: [
        'M62,274 C59,292 60,309 64,323 C70,329 80,329 87,323 C90,309 91,291 89,276 C80,280 70,280 62,274 Z',
      ],
    },
    adductors: { half: ['M91,278 C93,292 93,305 90,317 C94,307 97,293 98,279 Z'] },
    calves: {
      half: [
        'M63,341 C59,355 60,371 65,385 C70,393 80,393 84,385 C88,371 88,355 85,343 C78,337 70,337 63,341 Z',
      ],
    },
  },
};

/** Feine Hilfslinien (nur Kontur, keine Region): Mittellinie, Bauch-Segmente, Knie, Achillessehne. */
export const MUSCLE_MAP_DETAILS: Readonly<Record<MuscleMapView, MuscleMapShape>> = {
  front: {
    center: ['M100,90 L100,232', 'M89,160 L111,160', 'M88,181 L112,181', 'M89,202 L111,202'],
    half: ['M66,330 C70,326 78,326 82,330', 'M66,340 C70,344 78,344 82,340'],
  },
  back: {
    center: ['M100,64 L100,256'],
    half: ['M74,396 L74,414', 'M66,332 C72,334 80,334 86,332'],
  },
};
