import type { Metadata } from 'next';

import { P, RechtsSeite } from '../_components/Recht';

export const metadata: Metadata = { title: 'AGB' };

export default function Agb() {
  return (
    <RechtsSeite titel="Allgemeine Geschäftsbedingungen" stand={'Entwurf – Oktober 2026'}>
      <p>
        <P>
          Gliederung als Vorlage. Die Nutzungsbedingungen der App (Einwilligung in der App, Version
          1) und diese AGB müssen vor dem Start aufeinander abgestimmt werden.
        </P>
      </p>

      <h2>1. Geltungsbereich und Anbieter</h2>
      <p>
        <P>Anbieter (siehe Impressum), Geltung für App und Website, Verbraucher in DE, AT und CH</P>
      </p>

      <h2>2. Leistungen von Alpha5</h2>
      <p>
        <P>
          Beschreibung: Trainingsplan, Trainingstagebuch, später Ernährungs- und Supplementplan;
          Gratis- und Premium-Umfang
        </P>
      </p>

      <h2>3. Kein Ersatz für ärztliche Beratung</h2>
      <p>
        <P>
          Hinweis: Alpha5 ersetzt keine ärztliche Beratung; Gesundheits-Check; Nutzung ab 16 Jahren;
          Training auf eigene Verantwortung
        </P>
      </p>

      <h2>4. Konto und Registrierung</h2>
      <p>
        <P>Konto, Zugangsdaten, Testmodus, Löschung des Kontos</P>
      </p>

      <h2>5. Premium-Abo, Preise und Zahlung</h2>
      <p>
        <P>
          Preise, Laufzeit, automatische Verlängerung, Kündigung (Kündigungsbutton), Kauf über App
          Store / Google Play bzw. Stripe im Web
        </P>
      </p>

      <h2>6. Widerrufsrecht</h2>
      <p>
        <P>Widerrufsbelehrung und Muster-Widerrufsformular für digitale Inhalte/Dienstleistungen</P>
      </p>

      <h2>7. Pflichten der Nutzerinnen und Nutzer</h2>
      <p>
        <P>Wahrheitsgemäße Angaben, keine missbräuchliche Nutzung</P>
      </p>

      <h2>8. Haftung</h2>
      <p>
        <P>
          Haftungsbeschränkung nach geltendem Recht (Vorsatz, grobe Fahrlässigkeit,
          Kardinalpflichten)
        </P>
      </p>

      <h2>9. Änderungen der AGB</h2>
      <p>
        <P>Verfahren bei Änderungen, erneute Zustimmung</P>
      </p>

      <h2>10. Schlussbestimmungen</h2>
      <p>
        <P>Anwendbares Recht, Gerichtsstand, salvatorische Klausel</P>
      </p>
    </RechtsSeite>
  );
}
