// Übungsfotos übernehmen (docs/UEBUNGSFOTOS.md). Läuft im Workflow exercise-photos-import.yml; braucht nur Node,
// curl und ImageMagick (cwebp, falls vorhanden, sonst der WebP-Schreiber von ImageMagick).
//
//   node scripts/exercise-photos.mjs                    Manifest abarbeiten: neue/geänderte Adressen herunterladen,
//                                                       umrechnen, imported.json, App-Zuordnung und Prüfbögen erneuern
//   node scripts/exercise-photos.mjs --from-dir <dir>   statt Download lokale Dateien <id>-start.png / <id>-end.png
//                                                       (auch .jpg/.webp) aus <dir> umrechnen; imported.json bleibt
//   node scripts/exercise-photos.mjs --registry-only    nur App-Zuordnung (und Prüfbögen) aus den vorhandenen Dateien
//   --no-sheets                                         keine Prüfbögen erzeugen
//
// Ergebnis:
//   apps/mobile/assets/exercise-photos/<id>-start.webp, <id>-end.webp   640×480, Mitte zugeschnitten, WebP ≤ 45 KB
//   apps/mobile/src/data/exercise-photo-registry.generated.ts            id → { start: require(…), end: require(…) }
//   content/exercise-photos/review/sheet-<n>.jpg                          6 Paare Start|Ende je Bogen, mit ID
//
// Der Manifest-Inhalt wird NIE geschrieben (sonst löste der Commit des Workflows ihn erneut aus).
// Ausgang: 0 = alles gut, 1 = Manifest ungültig / Werkzeug fehlt, 2 = einzelne Downloads/Umrechnungen fehlgeschlagen
// (die übrigen Bilder sind trotzdem geschrieben; die IDs stehen in der Ausgabe).
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Gleiche Werte wie EXERCISE_PHOTO_FORMAT / EXERCISE_PHOTOS_* in packages/core/src/content/exercise-photos.ts.
const WIDTH = 640;
const HEIGHT = 480;
const QUALITY = 72;
const MIN_QUALITY = 40;
const MAX_BYTES = 45 * 1024;
const PAIRS_PER_SHEET = 6;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(root, 'content/exercise-photos/manifest.json');
const IMPORTED = join(root, 'content/exercise-photos/imported.json');
const REVIEW_DIR = join(root, 'content/exercise-photos/review');
const ASSET_DIR = join(root, 'apps/mobile/assets/exercise-photos');
const REGISTRY = join(root, 'apps/mobile/src/data/exercise-photo-registry.generated.ts');
const EXERCISES_DIR = join(root, 'content/exercises');

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fromDir = option('--from-dir');
const registryOnly = args.includes('--registry-only');
const sheets = !args.includes('--no-sheets');

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, data) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
const exerciseExists = (id) => ID_RE.test(id) && existsSync(join(EXERCISES_DIR, `${id}.json`));

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

/** Einfache Prüfung (die vollständige Zod-Prüfung läuft als Test in packages/content). */
function validateManifest(manifest) {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['Manifest muss ein Objekt { "<übungs-id>": { … } } sein.'];
  }
  const problems = [];
  for (const [id, entry] of Object.entries(manifest)) {
    if (!exerciseExists(id)) problems.push(`${id}: Übung gibt es nicht in content/exercises.`);
    if (entry === null || typeof entry !== 'object') {
      problems.push(`${id}: Eintrag muss ein Objekt sein.`);
      continue;
    }
    for (const key of ['start', 'end']) {
      if (typeof entry[key] !== 'string' || !/^https:\/\/[^\s]+$/.test(entry[key])) {
        problems.push(`${id}.${key}: https-Adresse erwartet.`);
      }
    }
    for (const key of ['job_start', 'job_end']) {
      if (typeof entry[key] !== 'string' || !GUID_RE.test(entry[key])) {
        problems.push(`${id}.${key}: UUID erwartet.`);
      }
    }
    const extra = Object.keys(entry).filter(
      (k) => !['start', 'end', 'job_start', 'job_end'].includes(k),
    );
    if (extra.length > 0) problems.push(`${id}: unbekannte Felder ${extra.join(', ')}.`);
  }
  return problems;
}

const IM = has('magick') ? 'magick' : has('convert') ? 'convert' : null;
const MONTAGE = has('magick') ? ['magick', 'montage'] : has('montage') ? ['montage'] : null;
const CWEBP = has('cwebp');

/** Bild → 640×480 (Mitte zugeschnitten) → WebP; senkt die Qualität, bis die Datei ≤ 45 KB ist. */
function convert(input, output, tmp) {
  const png = join(tmp, 'cropped.png');
  run(IM, [
    input,
    '-auto-orient',
    '-colorspace',
    'sRGB',
    // Transparenz auf das helle Studio-Grau legen (WebP ohne Alphakanal ist kleiner).
    '-background',
    '#ececec',
    '-alpha',
    'remove',
    '-alpha',
    'off',
    '-resize',
    `${WIDTH}x${HEIGHT}^`,
    '-gravity',
    'center',
    '-extent',
    `${WIDTH}x${HEIGHT}`,
    '-strip',
    png,
  ]);
  let quality = QUALITY;
  for (;;) {
    if (CWEBP) {
      run('cwebp', [
        '-quiet',
        '-q',
        String(quality),
        '-m',
        '6',
        '-metadata',
        'none',
        png,
        '-o',
        output,
      ]);
    } else {
      run(IM, [png, '-quality', String(quality), '-define', 'webp:method=6', `webp:${output}`]);
    }
    const size = statSync(output).size;
    if (size <= MAX_BYTES) return { quality, size };
    if (quality <= MIN_QUALITY) {
      console.warn(
        `::warning::${output}: ${Math.round(size / 1024)} KB auch bei Qualität ${quality}.`,
      );
      return { quality, size };
    }
    quality -= 6;
  }
}

/** Download über https (nur https erlaubt), mit Wiederholungen; prüft, dass ein Bild ankam. */
function download(url, target) {
  run('curl', [
    '--fail',
    '--silent',
    '--show-error',
    '--location',
    '--proto',
    '=https',
    '--proto-redir',
    '=https',
    '--retry',
    '3',
    '--retry-delay',
    '3',
    '--connect-timeout',
    '20',
    '--max-time',
    '180',
    '--output',
    target,
    url,
  ]);
  run(IM === 'magick' ? 'magick' : 'identify', IM === 'magick' ? ['identify', target] : [target]);
}

function photoIdsOnDisk() {
  if (!existsSync(ASSET_DIR)) return [];
  const files = new Set(readdirSync(ASSET_DIR));
  return [...files]
    .filter((name) => name.endsWith('-start.webp'))
    .map((name) => name.slice(0, -'-start.webp'.length))
    .filter((id) => files.has(`${id}-end.webp`))
    .sort();
}

function writeRegistry(ids) {
  const lines = ids.map(
    (id) =>
      // Wie Prettier (quoteProps „as-needed“): Anführungszeichen nur, wo nötig.
      `  ${/^[a-z_$][a-z0-9_$]*$/i.test(id) ? id : `'${id}'`}: {\n` +
      `    start: require('../../assets/exercise-photos/${id}-start.webp'),\n` +
      `    end: require('../../assets/exercise-photos/${id}-end.webp'),\n` +
      `  },\n`,
  );
  const body = ids.length === 0 ? '{}' : `{\n${lines.join('')}}`;
  // Die eslint-Ausnahme nur, wenn es require() gibt (sonst meldet eslint sie als unnötig).
  const disable =
    ids.length === 0
      ? ''
      : '/* eslint-disable @typescript-eslint/no-require-imports -- Metro bündelt Bilder nur über require() */\n';
  const content = `${disable}// Automatisch erzeugt von scripts/exercise-photos.mjs (Workflow exercise-photos-import) – nicht von Hand ändern.
// Übungsfotos Start/Ende je Übung (docs/UEBUNGSFOTOS.md). Wird erst bei Bedarf nachgeladen (exercise-media.ts).
import type { ImageSourcePropType } from 'react-native';

export interface ExercisePhotoPair {
  readonly start: ImageSourcePropType;
  readonly end: ImageSourcePropType;
}

export const EXERCISE_PHOTOS: Readonly<Record<string, ExercisePhotoPair>> = ${body};
`;
  const current = existsSync(REGISTRY) ? readFileSync(REGISTRY, 'utf8') : null;
  if (current !== content) writeFileSync(REGISTRY, content);
  console.log(`Zuordnung: ${ids.length} Übung(en) mit Foto.`);
}

function writeSheets(ids, tmp) {
  mkdirSync(REVIEW_DIR, { recursive: true });
  for (const name of readdirSync(REVIEW_DIR)) {
    if (/^sheet-\d+\.jpg$/.test(name)) rmSync(join(REVIEW_DIR, name));
  }
  if (ids.length === 0) return;
  if (!MONTAGE) fail('ImageMagick „montage“ fehlt (apt-get install imagemagick).');
  for (let n = 0; n * PAIRS_PER_SHEET < ids.length; n++) {
    const group = ids.slice(n * PAIRS_PER_SHEET, (n + 1) * PAIRS_PER_SHEET);
    const montageArgs = [];
    for (const id of group) {
      const pair = join(tmp, `pair-${id}.png`);
      // WebP lesen: dwebp (Paket webp), falls ImageMagick selbst kein WebP lesen kann.
      const readable = (kind) => {
        const file = join(ASSET_DIR, `${id}-${kind}.webp`);
        if (!has('dwebp')) return file;
        const png = join(tmp, `${id}-${kind}-sheet.png`);
        run('dwebp', ['-quiet', file, '-o', png]);
        return png;
      };
      run(IM, [
        readable('start'),
        readable('end'),
        '-resize',
        '400x300',
        '-bordercolor',
        'white',
        '-border',
        '4',
        '+append',
        pair,
      ]);
      montageArgs.push('-label', id, pair);
    }
    const [cmd, ...pre] = MONTAGE;
    run(cmd, [
      ...pre,
      ...montageArgs,
      '-tile',
      '2x3',
      '-geometry',
      '+12+12',
      '-pointsize',
      '20',
      '-background',
      'white',
      '-quality',
      '80',
      join(REVIEW_DIR, `sheet-${n + 1}.jpg`),
    ]);
  }
  console.log(
    `Prüfbögen: ${Math.ceil(ids.length / PAIRS_PER_SHEET)} in content/exercise-photos/review/.`,
  );
}

function main() {
  if (!IM) fail('ImageMagick fehlt (apt-get install imagemagick).');
  mkdirSync(ASSET_DIR, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'exercise-photos-'));
  const failed = [];
  try {
    if (fromDir) {
      const dir = resolve(process.cwd(), fromDir);
      const files = readdirSync(dir);
      const source = (id, kind) =>
        ['png', 'jpg', 'jpeg', 'webp']
          .map((ext) => `${id}-${kind}.${ext}`)
          .find((name) => files.includes(name));
      const ids = [
        ...new Set(
          files.map((n) => n.match(/^(.+)-start\.(?:png|jpe?g|webp)$/)?.[1]).filter(Boolean),
        ),
      ].sort();
      for (const id of ids) {
        const end = source(id, 'end');
        if (!exerciseExists(id) || !end) {
          failed.push(`${id} (${!end ? 'Endbild fehlt' : 'Übung unbekannt'})`);
          continue;
        }
        for (const kind of ['start', 'end']) {
          const { size, quality } = convert(
            join(dir, source(id, kind)),
            join(ASSET_DIR, `${id}-${kind}.webp`),
            tmp,
          );
          console.log(`${id}-${kind}.webp: ${Math.round(size / 1024)} KB (Qualität ${quality})`);
        }
      }
    } else if (!registryOnly) {
      const manifest = readJson(MANIFEST);
      const problems = validateManifest(manifest);
      if (problems.length > 0) fail(`Manifest ungültig:\n${problems.join('\n')}`);
      const imported = existsSync(IMPORTED) ? readJson(IMPORTED) : {};
      // Aus dem Manifest entfernte Übungen: Fotos und Eintrag löschen (zurück zur Illustration).
      for (const id of Object.keys(imported)) {
        if (Object.hasOwn(manifest, id)) continue;
        for (const kind of ['start', 'end'])
          rmSync(join(ASSET_DIR, `${id}-${kind}.webp`), { force: true });
        delete imported[id];
        console.log(`${id}: aus dem Manifest entfernt – Fotos gelöscht.`);
      }
      for (const [id, entry] of Object.entries(manifest)) {
        const done = imported[id];
        const filesThere = ['start', 'end'].every((k) =>
          existsSync(join(ASSET_DIR, `${id}-${k}.webp`)),
        );
        if (filesThere && done?.start === entry.start && done?.end === entry.end) continue;
        try {
          const out = {};
          for (const kind of ['start', 'end']) {
            const raw = join(tmp, `${id}-${kind}.download`);
            download(entry[kind], raw);
            // Erst in tmp umrechnen; ins App-Verzeichnis erst, wenn beide Bilder geklappt haben.
            out[kind] = join(tmp, `${id}-${kind}.webp`);
            const { size, quality } = convert(raw, out[kind], tmp);
            console.log(`${id}-${kind}.webp: ${Math.round(size / 1024)} KB (Qualität ${quality})`);
          }
          for (const kind of ['start', 'end']) {
            writeFileSync(join(ASSET_DIR, `${id}-${kind}.webp`), readFileSync(out[kind]));
          }
          imported[id] = { start: entry.start, end: entry.end };
        } catch (error) {
          const detail = String(error?.stderr ?? error?.message ?? error)
            .trim()
            .split('\n')[0];
          failed.push(`${id} (${detail})`);
        }
      }
      const sorted = Object.fromEntries(
        Object.entries(imported).sort(([a], [b]) => a.localeCompare(b)),
      );
      writeJson(IMPORTED, sorted);
    }
    const ids = photoIdsOnDisk();
    writeRegistry(ids);
    if (sheets) writeSheets(ids, tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (failed.length > 0) {
    console.error(`::error::Fehlgeschlagen (${failed.length}): ${failed.join('; ')}`);
    process.exit(2);
  }
}

main();
