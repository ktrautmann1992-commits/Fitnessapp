import { join } from 'node:path';

import {
  EXERCISE_MEDIA_ASSET_DIR,
  EXERCISE_MEDIA_FOLDER,
  type ExerciseMedia,
  exerciseMediaSchema,
} from '@fitnessapp/core';
import * as prettier from 'prettier';

import { applyPalette, ILLUSTRATION_PALETTE } from './palette';
import { EXERCISE_ILLUSTRATIONS } from './poses';
import { EXERCISE_END_ILLUSTRATIONS } from './poses-end';
import { buildScene, renderTemplate } from './rig';

/**
 * Generator der eigenen Übungs-Illustrationen (Gründer-Entscheidung B, 21.10.2026). Erzeugt aus poses.ts:
 * 1. `apps/mobile/assets/exercise-media/<id>-start.svg` – Bild in hellen Farben (zum Ansehen, Prüfung in content:validate),
 *    dazu `<id>-end.svg` für Übungen mit Endposition (poses-end.ts, gleiche waagerechte Lage wie das Startbild),
 * 2. `content/exercise-media/<id>.json` – Zuordnung mit Alt-Text, Herkunft, Lizenz und Quelle,
 * 3. `apps/mobile/src/data/exercise-illustrations.generated.ts` – Vorlagen mit Farbmarken für die App (hell/dunkel).
 * Deterministisch: gleiche Daten → byte-gleiche Dateien (Test prüft, dass die eingecheckten Dateien aktuell sind).
 */

export const ILLUSTRATION_LICENSE = 'eigene Illustration Alpha5';
export const ILLUSTRATION_CREATOR = 'Alpha5';
/** Stand der Illustrationen (fest, damit die Ausgabe deterministisch bleibt; bei neuer Fassung anheben). */
export const ILLUSTRATION_DATE = '2026-10-21';
export const GENERATED_MODULE = 'apps/mobile/src/data/exercise-illustrations.generated.ts';

export const startFileName = (exerciseId: string) => `${exerciseId}-start.svg`;
export const endFileName = (exerciseId: string) => `${exerciseId}-end.svg`;

/** Quelle (Lizenz, Urheber, Stand) – gleich für Start- und Endbild. */
const OWN_WORK = {
  origin: 'own_work',
  license: { name: ILLUSTRATION_LICENSE, attribution_de: null },
  source: { creator: ILLUSTRATION_CREATOR, obtained_on: ILLUSTRATION_DATE },
  reviewed_by: null,
} as const;

/** SVG-Vorlagen (mit Farbmarken) einer Übung: Ausgangs- und ggf. Endposition in derselben waagerechten Lage. */
export function illustrationTemplates(exerciseId: string): {
  start_position: string;
  end_position?: string;
} {
  const start = EXERCISE_ILLUSTRATIONS[exerciseId];
  if (!start) throw new Error(`Keine Illustration für „${exerciseId}“.`);
  const end = EXERCISE_END_ILLUSTRATIONS[exerciseId];
  const startTemplate = renderTemplate(start.pose);
  if (!end) return { start_position: startTemplate };
  return {
    start_position: startTemplate,
    end_position: renderTemplate(end.pose, buildScene(start.pose).offsetX),
  };
}

export function mediaFor(exerciseId: string): ExerciseMedia {
  const illustration = EXERCISE_ILLUSTRATIONS[exerciseId];
  if (!illustration) throw new Error(`Keine Illustration für „${exerciseId}“.`);
  const end = EXERCISE_END_ILLUSTRATIONS[exerciseId];
  return exerciseMediaSchema.parse({
    exercise_id: exerciseId,
    images: [
      {
        kind: 'start_position',
        file: startFileName(exerciseId),
        alt_de: illustration.alt,
        ...OWN_WORK,
      },
      ...(end
        ? [{ kind: 'end_position', file: endFileName(exerciseId), alt_de: end.alt, ...OWN_WORK }]
        : []),
    ],
  });
}

async function format(repoRoot: string, repoPath: string, text: string): Promise<string> {
  const filepath = join(repoRoot, repoPath);
  const options = (await prettier.resolveConfig(filepath)) ?? {};
  return prettier.format(text, { ...options, filepath });
}

/** Alle erzeugten Dateien (Pfad relativ zur Repository-Wurzel → Inhalt). */
export async function generateIllustrationFiles(repoRoot: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const ids = Object.keys(EXERCISE_ILLUSTRATIONS).sort();
  const entries: string[] = [];
  for (const id of ids) {
    const templates = illustrationTemplates(id);
    files.set(
      `${EXERCISE_MEDIA_ASSET_DIR}/${startFileName(id)}`,
      `${applyPalette(templates.start_position, ILLUSTRATION_PALETTE.light)}\n`,
    );
    if (templates.end_position !== undefined) {
      files.set(
        `${EXERCISE_MEDIA_ASSET_DIR}/${endFileName(id)}`,
        `${applyPalette(templates.end_position, ILLUSTRATION_PALETTE.light)}\n`,
      );
    }
    const media = mediaFor(id);
    const jsonPath = `content/${EXERCISE_MEDIA_FOLDER}/${id}.json`;
    files.set(jsonPath, await format(repoRoot, jsonPath, `${JSON.stringify(media, null, 2)}\n`));
    entries.push(
      `  ${JSON.stringify(id)}: { media: ${JSON.stringify(media)}, templates: ${JSON.stringify(templates)} },`,
    );
  }
  const module = `/**
 * AUTOMATISCH ERZEUGT – NICHT VON HAND BEARBEITEN.
 *
 * Quelle: packages/content/src/illustrations/ (Gelenkwinkel je Übung in poses.ts, Figuren-Rig in rig.ts).
 * Neu erzeugen: pnpm illustrations (im Hauptordner) bzw. in der Claude-Code-Sitzung „Erzeuge die Übungsbilder neu.“
 * Vorlagen enthalten Farbmarken {rolle}; die App setzt je nach Hell/Dunkel ILLUSTRATION_COLORS ein.
 */
import type { ExerciseMedia } from '@fitnessapp/core';

export type IllustrationRole = ${Object.keys(ILLUSTRATION_PALETTE.light)
    .map((role) => JSON.stringify(role))
    .join(' | ')};

export const ILLUSTRATION_COLORS: Readonly<Record<'light' | 'dark', Readonly<Record<IllustrationRole, string>>>> = ${JSON.stringify(ILLUSTRATION_PALETTE)};

export interface GeneratedIllustration {
  readonly media: ExerciseMedia;
  /** Ausgangsposition immer; Endposition nur bei Übungen mit Bewegung (sonst fehlt sie → kein Wechselbild). */
  readonly templates: { readonly start_position: string; readonly end_position?: string };
}

export const GENERATED_ILLUSTRATIONS: Readonly<Record<string, GeneratedIllustration>> = {
${entries.join('\n')}
};
`;
  files.set(GENERATED_MODULE, await format(repoRoot, GENERATED_MODULE, module));
  return files;
}
