// Strichcode-Leser für den Browser (Etappe E4b, docs/PLAN-E4.md 5.1): kopiert die WebAssembly-Datei von ZXing
// (Paket zxing-wasm, über barcode-detector) nach public/scanner/<Version>/, damit Expo sie mit dem Web-Export
// ausliefert. So lädt die App den Leser von UNSERER Domain und nie vom CDN des Pakets (jsDelivr) – das würde die
// IP-Adresse der Person an Dritte geben. Prüft die SHA-256-Prüfsumme gegen die Angabe im Paket.
// Läuft automatisch bei build/dev (package.json); die Kopie ist nicht eingecheckt (.gitignore).
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(appDir, 'package.json'));

const { ZXING_WASM_VERSION, ZXING_WASM_SHA256 } = await import('barcode-detector/ponyfill');
const source = require.resolve('zxing-wasm/reader/zxing_reader.wasm');
const bytes = readFileSync(source);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== ZXING_WASM_SHA256) {
  console.error(
    `Strichcode-Leser: Prüfsumme passt nicht (zxing-wasm ${ZXING_WASM_VERSION}). Version von zxing-wasm in ` +
      'apps/mobile/package.json an die Abhängigkeit von barcode-detector angleichen.',
  );
  process.exit(1);
}
const targetRoot = join(appDir, 'public', 'scanner');
rmSync(targetRoot, { recursive: true, force: true });
const target = join(targetRoot, ZXING_WASM_VERSION, 'zxing_reader.wasm');
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Strichcode-Leser ${ZXING_WASM_VERSION} → public/scanner/${ZXING_WASM_VERSION}/`);
