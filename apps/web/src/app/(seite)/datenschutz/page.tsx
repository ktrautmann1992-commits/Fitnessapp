import type { Metadata } from 'next';

import { P, RechtsSeite } from '../_components/Recht';

export const metadata: Metadata = { title: 'Datenschutzerklärung' };

export default function Datenschutz() {
  return (
    <RechtsSeite titel="Datenschutzerklärung" stand={'Entwurf – Oktober 2026'}>
      <h2>1. Verantwortlicher</h2>
      <p>
        <P>Name und Anschrift wie im Impressum, E-Mail-Adresse für Datenschutzanfragen</P>
      </p>
      <p>
        Datenschutzbeauftragte Person: <P>Kontakt, falls bestellt (sonst Satz streichen)</P>
      </p>

      <h2>2. Überblick</h2>
      <p>
        Wir verarbeiten personenbezogene Daten nur, soweit das für die Website, die Warteliste und
        die App nötig ist. Gesundheits- und Körperdaten verarbeiten wir nur mit deiner
        ausdrücklichen, gesonderten Einwilligung. Wir verkaufen keine Daten und geben keine
        Gesundheitsdaten an Werbe-, Analyse- oder Affiliate-Partner weiter.
      </p>

      <h2>3. Aufruf der Website (Hosting bei Vercel)</h2>
      <p>
        Die Website wird bei Vercel Inc. (USA) gehostet. Beim Aufruf verarbeitet Vercel technisch
        notwendige Daten (IP-Adresse, Zeitpunkt, aufgerufene Seite, Browser) zur Auslieferung und
        Absicherung. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.{' '}
        <P>
          Speicherdauer der Server-Logs, Auftragsverarbeitungsvertrag (DPA) mit Vercel,
          Drittlandtransfer (EU-US Data Privacy Framework bzw. Standardvertragsklauseln)
        </P>
      </p>
      <p>
        Schriften werden von unserem eigenen Server geladen, nicht von Google. Wir setzen keine
        Analyse- oder Werbe-Cookies ein.
      </p>

      <h2>4. Warteliste</h2>
      <p>
        Wenn du dich in die Warteliste einträgst, speichern wir deine E-Mail-Adresse, die Version
        des Einwilligungstexts und die Zeitpunkte von Eintragung und Bestätigung. Du bekommst eine
        Bestätigungs-Mail (Double-Opt-in); erst nach dem Klick auf den Link und auf „Anmeldung
        bestätigen“ bist du eingetragen. Der Bestätigungslink gilt 48 Stunden; unbestätigte Einträge
        löschen wir spätestens nach 3 Tagen automatisch (tägliche Löschung). Bestätigte Einträge
        speichern wir bis zum Start der App bzw. bis zu deiner Abmeldung{' '}
        <P>genaue Speicherdauer bestätigter Einträge, z. B. „bis zum Start, höchstens 24 Monate“</P>
        . Jede Mail enthält einen Abmelde-Link; beim Abmelden löschen wir deinen Eintrag
        vollständig.
      </p>
      <p>
        Die Links in der Mail enthalten einen zufälligen Code. Wir speichern ihn nur als
        pseudonymisierten Prüfwert (HMAC-Hash). Der Code steht im Link hinter „#“ und wird deshalb
        beim Öffnen nicht an unseren Server übertragen.
      </p>
      <p>
        Zum Schutz vor Missbrauch (zu viele Anmeldungen) speichern wir für höchstens 2 Tage
        (Löschung täglich) einen pseudonymisierten Prüfwert (HMAC-Hash) deiner IP-Adresse (bei IPv6
        nur des Netzbereichs) und deiner E-Mail-Adresse – nicht die Adressen selbst.
        Rechtsgrundlage: deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), für den Missbrauchsschutz
        Art. 6 Abs. 1 lit. f DSGVO. Die Einwilligung kannst du jederzeit widerrufen.
      </p>
      <p>
        <strong>E-Mail-Versand über Resend:</strong> Die Bestätigungs-Mail verschicken wir über den
        E-Mail-Dienst Resend (Anbieter mit Sitz in den USA). Dabei werden deine E-Mail-Adresse und
        der Mail-Inhalt an Resend übermittelt.{' '}
        <P>
          Genaue Firma und Anschrift von Resend, Versandregion (EU), Auftragsverarbeitungsvertrag
          (DPA), Drittlandtransfer (EU-US Data Privacy Framework bzw. Standardvertragsklauseln)
        </P>
      </p>

      <h2>5. Datenbank (Supabase, Frankfurt)</h2>
      <p>
        Warteliste und App-Daten speichern wir bei Supabase in einem Rechenzentrum in Frankfurt am
        Main (EU).{' '}
        <P>Anbieter Supabase Inc., Auftragsverarbeitungsvertrag (DPA), ggf. Drittlandbezug</P>
      </p>

      <h2>6. App: Gesundheitsdaten (Art. 9 DSGVO)</h2>
      <p>
        Körper-, Gesundheits- und (später) Zyklusdaten verarbeiten wir nur mit deiner
        ausdrücklichen, getrennten Einwilligung (Art. 9 Abs. 2 lit. a DSGVO), um deinen Trainings-
        und Ernährungsplan zu erstellen. Die Einwilligung wird mit Zeitpunkt und Textversion
        gespeichert und kann in den Einstellungen jederzeit widerrufen werden. Zugriff hat nur dein
        Konto (Row Level Security). Gesundheitsdaten gelangen nicht in Logs, Analyse oder Werbung.{' '}
        <P>Kategorien im Detail, Speicherdauer, Löschfristen</P>
      </p>

      <h2>7. Deine Rechte</h2>
      <ul>
        <li>Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17)</li>
        <li>Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21)</li>
        <li>Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3)</li>
        <li>
          Beschwerde bei einer Datenschutz-Aufsichtsbehörde{' '}
          <P>zuständige Aufsichtsbehörde am Sitz des Unternehmens</P>
        </li>
      </ul>
      <p>In der App kannst du deine Daten jederzeit exportieren und dein Konto löschen.</p>

      <h2>8. Änderungen</h2>
      <p>
        <P>Hinweis zur Aktualisierung dieser Erklärung</P>
      </p>
    </RechtsSeite>
  );
}
