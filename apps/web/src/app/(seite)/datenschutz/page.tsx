import type { Metadata } from 'next';

import { P, RechtsSeite } from '../_components/Recht';

export const metadata: Metadata = { title: 'Datenschutzerklärung' };

export default function Datenschutz() {
  return (
    <RechtsSeite titel="Datenschutzerklärung" stand={'Oktober 2026'}>
      <h2>1. Verantwortlicher</h2>
      <p>
        <P>Name und Anschrift wie im Impressum, E-Mail-Adresse für Datenschutzanfragen</P>
      </p>
      <p>
        Datenschutzbeauftragte Person: <P>Kontakt, falls bestellt (sonst Satz streichen)</P>
      </p>

      <h2>2. Überblick</h2>
      <p>
        Wir verarbeiten personenbezogene Daten nur, soweit das für die Website, die Warteliste, den
        Versand der Gratis-Rezepte und die App nötig ist. Gesundheits- und Körperdaten verarbeiten
        wir nur mit deiner ausdrücklichen, gesonderten Einwilligung. Wir verkaufen keine Daten und
        geben keine Gesundheitsdaten an Werbe-, Analyse- oder Affiliate-Partner weiter.
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

      <h2 id="gratis-rezepte">5. Gratis-Rezepte als PDF und Newsletter</h2>
      {/* TODO(Recht): Abschnitt vor dem Livegang prüfen lassen (Rechtsgrundlagen, Fristen). */}
      <p>
        Wenn du unsere 20 Rezepte als PDF anforderst, speichern wir deine E-Mail-Adresse, die
        Version des Einwilligungstexts, ob du zusätzlich den Newsletter bestellt hast, und die
        Zeitpunkte von Anfrage und Bestätigung (beim Newsletter auch den Zeitpunkt seiner
        Bestätigung). Zweck: dir den Download-Link zu schicken. Du bekommst zuerst eine
        Bestätigungs-Mail (Double-Opt-in), die ausdrücklich nennt, ob du nur den Download-Link oder
        zusätzlich den Newsletter bestätigst. Nach dem Klick auf den Link und auf „Jetzt bestätigen“
        schicken wir dir eine zweite Mail mit dem Download-Link. Fragst du die Rezepte später noch
        einmal an, schicken wir dir den Link erneut.
      </p>
      <p>
        Der Download hängt <strong>nicht</strong> vom Newsletter ab. Den Newsletter (Infos zum Start
        von Alpha5, Rezepte, Trainingstipps) bekommst du nur, wenn du das eigene, freiwillige
        Häkchen dafür setzt und ihn per Link bestätigst – setzt du das Häkchen erst bei einer
        späteren Anfrage, bekommst du dafür eine eigene Bestätigungs-Mail. Ohne Newsletter schicken
        wir dir nach der Mail mit dem Download-Link keine weiteren E-Mails und löschen deine Adresse
        30 Tage nach der Bestätigung automatisch (tägliche Löschung). Mit Newsletter speichern wir
        sie bis zu deiner Abmeldung{' '}
        <P>
          Speicherdauer Newsletter festlegen – Vorschlag: bis zur Abmeldung, spätestens 24 Monate
          nach der letzten Anforderung oder Bestätigung (TODO Recht)
        </P>
        . Unbestätigte Anfragen löschen wir wie bei der Warteliste spätestens nach 3 Tagen. Die
        Warteliste (Abschnitt 4) ist davon getrennt: Sie dient nur der Information über den Start
        und hat einen eigenen Abmelde-Link.
      </p>
      <p>
        Jede Mail enthält einen Link, mit dem du deine Adresse aus der Liste der Gratis-Rezepte
        sofort löschen (und damit auch den Newsletter abbestellen) kannst; die Links aller unserer
        Mails bleiben dafür gültig. Missbrauchsschutz, Prüfwerte (HMAC-Hash) und E-Mail-Versand über
        Resend wie in Abschnitt 4 beschrieben. Für Statistik zählen wir nur, wie viele Anfragen und
        Bestätigungen es pro Tag gab – ohne Bezug zu einer Person. Rechtsgrundlage: für die
        Zusendung des angeforderten Download-Links Art. 6 Abs. 1 lit. b DSGVO (Erfüllung deiner
        Anfrage) bzw. deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO){' '}
        <P>bei der rechtlichen Prüfung festlegen</P>, für den Newsletter deine Einwilligung (Art. 6
        Abs. 1 lit. a DSGVO), für den Missbrauchsschutz Art. 6 Abs. 1 lit. f DSGVO. Die Einwilligung
        kannst du jederzeit widerrufen.
      </p>

      <h2>6. Datenbank (Supabase, Frankfurt)</h2>
      <p>
        Warteliste, Anfragen der Gratis-Rezepte und App-Daten speichern wir bei Supabase in einem
        Rechenzentrum in Frankfurt am Main (EU).{' '}
        <P>Anbieter Supabase Inc., Auftragsverarbeitungsvertrag (DPA), ggf. Drittlandbezug</P>
      </p>

      <h2>7. App: Gesundheitsdaten (Art. 9 DSGVO)</h2>
      <p>
        Körper-, Gesundheits- und (später) Zyklusdaten verarbeiten wir nur mit deiner
        ausdrücklichen, getrennten Einwilligung (Art. 9 Abs. 2 lit. a DSGVO), um deinen Trainings-
        und Ernährungsplan zu erstellen. Die Einwilligung wird mit Zeitpunkt und Textversion
        gespeichert und kann in den Einstellungen jederzeit widerrufen werden. Zugriff hat nur dein
        Konto (Row Level Security). Gesundheitsdaten gelangen nicht in Logs, Analyse oder Werbung.{' '}
        <P>Kategorien im Detail, Speicherdauer, Löschfristen</P>
      </p>

      <h2>8. App: Produktabfrage per Barcode-Nummer (Open Food Facts)</h2>
      <p>
        Wenn du in der App die Nummer unter einem Strichcode eingibst, fragt{' '}
        <strong>nur unser Server</strong> (Vercel, Frankfurt) bei Open Food Facts (französischer
        Verein, Server in Frankreich) nach. Open Food Facts erhält dabei nur die Nummer – von der
        Adresse unseres Servers, mit unserem App-Namen und einer Funktions-Kontaktadresse. Dein
        Name, deine Nutzer-ID und deine IP-Adresse werden nicht übermittelt. Die Nummer steht nicht
        in Adressen oder Server-Protokollen.
      </p>
      <p>
        Die Antwort (Name, Marke, Nährwerte) speichern wir höchstens 90 Tage in einem gemeinsamen
        Zwischenspeicher <strong>ohne Bezug zu Personen</strong>. Je Person zählen wir nur die
        Anzahl der Abfragen je Stunde (ohne Nummern, 2 Tage), um Missbrauch zu begrenzen. Die
        Abfrage ist nur mit deiner Einwilligung in die Verarbeitung von Gesundheitsdaten möglich,
        weil sie deinem Ernährungstagebuch dient. Was du einträgst und eigene Produkte, die du
        anlegst, gehören zu deinem Tagebuch (Abschnitt 7) und werden beim Widerruf gelöscht. Öffnest
        du in der App den Link „Bei Open Food Facts ansehen“, verlässt du die App; Open Food Facts
        sieht dann deine IP-Adresse.{' '}
        <P>bei der rechtlichen Prüfung bestätigen (kein Auftragsverarbeiter)</P>
      </p>

      <h2>9. App: Wetter zu deinen Läufen (Open-Meteo)</h2>
      <p>
        Wenn du es in der App erlaubst (einmaliger Hinweis, jederzeit in den Einstellungen
        abschaltbar), holt <strong>dein Gerät direkt</strong> bei Open-Meteo (Schweiz, kostenlos,
        ohne Konto) das Wetter zum Start eines Laufs: Temperatur, gefühlte Temperatur, Wind,
        Niederschlag, Luftfeuchte und Wetterlage. Übermittelt werden nur eine auf{' '}
        <strong>0,1 Grad gerundete Startposition</strong> (ein Raster von etwa 7–11 km) sowie Tag
        und Stunde – nie die Strecke selbst. Open-Meteo sieht dabei wie bei jedem Abruf deine
        IP-Adresse. Das Wetter speichern wir bei der Strecke (Abschnitt 6, nur dein Konto); es ist
        kein Gesundheitsdatum und steht nicht in Protokollen.{' '}
        <P>bei der rechtlichen Prüfung bestätigen (Rechtsgrundlage Einwilligung, kein AVV nötig)</P>
      </p>

      <h2>10. Deine Rechte</h2>
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

      <h2>11. Änderungen</h2>
      <p>
        <P>Hinweis zur Aktualisierung dieser Erklärung</P>
      </p>
    </RechtsSeite>
  );
}
