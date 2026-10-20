import type { Metadata } from 'next';
import Link from 'next/link';

import { OPEN_FOOD_FACTS } from '@fitnessapp/core';

import { RechtsSeite } from '../_components/Recht';

export const metadata: Metadata = { title: 'Lizenzen und Quellen' };

/**
 * Lizenzen und Quellen (Etappe E4a, docs/PLAN-E4.md 6.1): Namensnennung der Nährwert-Quellen – BLS (Max Rubner-
 * Institut, CC BY 4.0) und Open Food Facts (ODbL 1.0 / DbCL 1.0, Muster-Hinweis nach ODbL 4.3) – und die Methode
 * unserer Änderungen an OFF-Daten (ODbL 4.6 b). Gleicher Inhalt wie in der App (Einstellungen → „Lizenzen und
 * Quellen“), dazu Software von Dritten (Strichcode-Leser, E4b). Wortlaut vor dem Livegang juristisch prüfen (Plan 6.2).
 */
export default function Lizenzen() {
  return (
    <RechtsSeite titel="Lizenzen und Quellen" stand={'Entwurf – Oktober 2026'}>
      <h2>Nährwerte unseres Lebensmittel-Katalogs</h2>
      <p>
        Nährwerte: Bundeslebensmittelschlüssel (BLS) 4.0, Max Rubner-Institut, Lizenz CC BY 4.0 (
        <a href="https://creativecommons.org/licenses/by/4.0/">
          creativecommons.org/licenses/by/4.0
        </a>
        ); umgerechnet und gerundet.
      </p>

      <h2>Produktdaten von Open Food Facts</h2>
      <p>
        Diese App enthält Informationen aus Open Food Facts (
        <a href={OPEN_FOOD_FACTS.homeUrl}>openfoodfacts.org</a>), die unter der Open Database
        License (ODbL 1.0,{' '}
        <a href={OPEN_FOOD_FACTS.odblUrl}>opendatacommons.org/licenses/odbl/1-0/</a>) bereitgestellt
        werden. Einzelne Inhalte stehen unter der Database Contents License (DbCL 1.0,{' '}
        <a href={OPEN_FOOD_FACTS.dbclUrl}>opendatacommons.org/licenses/dbcl/1-0/</a>).
      </p>
      <p>
        <strong>Methode unserer Änderungen:</strong> Wir übernehmen die Werte je 100 g bzw. 100 ml
        unverändert und rechnen nur so um: kJ → kcal (÷ 4,184), Natrium → Salz (× 2,5),
        Portionswerte → je 100 g, Runden auf ganze kcal und 0,1 g. Texte werden gekürzt und von
        Steuerzeichen bereinigt. Die Original-Daten erhältst du bei Open Food Facts (
        <a href={OPEN_FOOD_FACTS.dataUrl}>world.openfoodfacts.org/data</a>).
      </p>
      <p>
        Produktbilder von Open Food Facts zeigen wir nicht. Angaben von Open Food Facts sind ohne
        Gewähr – bitte mit der Packung vergleichen.
      </p>

      <h2>Software von Dritten (Strichcode-Leser)</h2>
      <p>
        Strichcode lesen im Browser: zxing-cpp (
        <a href="https://github.com/zxing-cpp/zxing-cpp">github.com/zxing-cpp/zxing-cpp</a>), Lizenz
        Apache 2.0 (
        <a href="https://www.apache.org/licenses/LICENSE-2.0">apache.org/licenses/LICENSE-2.0</a>);
        zxing-wasm (Lizenz MIT, C++-Anbindung Apache 2.0) und barcode-detector (Lizenz MIT), beide
        von Ze-Zheng Wu. In der App: expo-camera (Expo), Lizenz MIT. Die Kamerabilder werden nur auf
        deinem Gerät ausgewertet.
      </p>

      <h2>Schriften</h2>
      <p>
        App: Plus Jakarta Sans (Tokotype,{' '}
        <a href="https://github.com/tokotype/PlusJakartaSans">
          github.com/tokotype/PlusJakartaSans
        </a>
        ), Lizenz SIL Open Font License 1.1 (
        <a href="https://openfontlicense.org">openfontlicense.org</a>); in der App über
        @expo-google-fonts/plus-jakarta-sans (Expo, Lizenz MIT). Website und Druckansichten: Archivo
        (Omnibus-Type,{' '}
        <a href="https://github.com/Omnibus-Type/Archivo">github.com/Omnibus-Type/Archivo</a>),
        Lizenz SIL Open Font License 1.1. Alle Schriften liegen bei uns – beim Anzeigen wird keine
        Verbindung zu Google aufgebaut.
      </p>

      <h2>Datenschutz</h2>
      <p>
        Wie die Produktabfrage mit deinen Daten umgeht, steht in der{' '}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    </RechtsSeite>
  );
}
