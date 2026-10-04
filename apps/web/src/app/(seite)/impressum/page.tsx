import type { Metadata } from 'next';

import { P, RechtsSeite } from '../_components/Recht';

export const metadata: Metadata = { title: 'Impressum' };

export default function Impressum() {
  return (
    <RechtsSeite titel="Impressum" stand={'Entwurf – Oktober 2026'}>
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        <P>Name des Unternehmens bzw. Vor- und Nachname</P>
        <br />
        <P>Rechtsform, z. B. GmbH, UG (haftungsbeschränkt) oder Einzelunternehmen</P>
        <br />
        <P>Straße und Hausnummer (keine Postfachadresse)</P>
        <br />
        <P>PLZ und Ort, Land</P>
      </p>

      <h2>Vertreten durch</h2>
      <p>
        <P>Geschäftsführung bzw. vertretungsberechtigte Person(en)</P>
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <P>E-Mail-Adresse</P>
        <br />
        Telefon: <P>Telefonnummer oder zweiter schneller Kontaktweg</P>
      </p>

      <h2>Registereintrag</h2>
      <p>
        <P>Registergericht und Registernummer (falls im Handelsregister eingetragen)</P>
      </p>

      <h2>Umsatzsteuer-ID</h2>
      <p>
        Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: <P>USt-IdNr. (falls vorhanden)</P>
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        <P>Name und Anschrift der verantwortlichen Person</P>
      </p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        <P>
          Erklärung, ob ihr an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
          teilnehmt (§ 36 VSBG) – z. B. „Wir sind nicht bereit oder verpflichtet, an
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.“
        </P>
      </p>

      <h2>Österreich und Schweiz</h2>
      <p>
        <P>
          Falls Sitz oder Zielmarkt es erfordert: Angaben nach § 5 ECG / § 25 MedienG (Österreich)
          bzw. Art. 3 UWG (Schweiz)
        </P>
      </p>
    </RechtsSeite>
  );
}
