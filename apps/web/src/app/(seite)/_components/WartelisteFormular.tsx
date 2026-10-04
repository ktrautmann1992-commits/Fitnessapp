'use client';

import Link from 'next/link';
import { type FormEvent, useRef, useState } from 'react';

import styles from '../seite.module.css';

type Meldung = { readonly text: string; readonly fehler: boolean } | null;
type FehlerFeld = 'email' | 'zustimmung' | null;

const MELDUNG_ID = 'warteliste-meldung';

const FEHLER_EMAIL = 'Bitte gib eine gültige E-Mail-Adresse ein.';
const FEHLER_ZUSTIMMUNG = 'Bitte bestätige, dass wir dich per E-Mail informieren dürfen.';
const FEHLER_NETZ = 'Keine Verbindung. Bitte prüf dein Internet und versuch es noch einmal.';

/**
 * Formular der Warteliste. Schickt an POST /api/warteliste (Double-Opt-in, src/lib/waitlist/handler.ts).
 * Das Feld „website“ ist ein Honeypot gegen Bots (für Menschen unsichtbar).
 */
export function WartelisteFormular() {
  const emailRef = useRef<HTMLInputElement>(null);
  const zustimmungRef = useRef<HTMLInputElement>(null);
  const [fehlerFeld, setFehlerFeld] = useState<FehlerFeld>(null);
  const [zustimmung, setZustimmung] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);

  async function absenden(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = emailRef.current;
    if (!email || !email.value || !email.checkValidity()) {
      setMeldung({ text: FEHLER_EMAIL, fehler: true });
      setFehlerFeld('email');
      email?.focus();
      return;
    }
    if (!zustimmung) {
      setMeldung({ text: FEHLER_ZUSTIMMUNG, fehler: true });
      setFehlerFeld('zustimmung');
      zustimmungRef.current?.focus();
      return;
    }
    setFehlerFeld(null);
    const website = new FormData(event.currentTarget).get('website');
    setSendet(true);
    setMeldung(null);
    try {
      const antwort = await fetch('/api/warteliste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.value, consent: true, website: website ?? '' }),
      });
      const daten = (await antwort.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      setMeldung({
        text: daten?.message ?? FEHLER_NETZ,
        // „Bald aktiv“ ist kein Fehler der Besucherin – freundlich, nicht in Signalfarbe.
        fehler: !antwort.ok && daten?.code !== 'not_configured',
      });
    } catch {
      setMeldung({ text: FEHLER_NETZ, fehler: true });
    } finally {
      setSendet(false);
    }
  }

  return (
    <form onSubmit={absenden} noValidate>
      <div className={styles.feld}>
        <label htmlFor="email">E-Mail-Adresse</label>
        <input
          ref={emailRef}
          type="email"
          id="email"
          name="email"
          autoComplete="email"
          placeholder="name@beispiel.de"
          maxLength={254}
          required
          aria-invalid={fehlerFeld === 'email'}
          aria-describedby={MELDUNG_ID}
        />
      </div>
      <div className={styles.honig} aria-hidden="true">
        <label htmlFor="website">Website (bitte leer lassen)</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className={styles.zustimmung}>
        <input
          type="checkbox"
          ref={zustimmungRef}
          id="zustimmung"
          aria-invalid={fehlerFeld === 'zustimmung'}
          aria-describedby={MELDUNG_ID}
          checked={zustimmung}
          onChange={(event) => setZustimmung(event.target.checked)}
        />
        <span data-testid="einwilligungstext">
          Ich möchte per E-Mail über den Start von Alpha5 informiert werden. Abmelden kann ich mich
          jederzeit. Es gilt die <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </span>
      </label>
      <button
        className={`${styles.knopf} ${styles['knopf--primaer']}`}
        id="eintragen"
        type="submit"
        disabled={sendet}
      >
        {sendet ? 'Wird gesendet …' : 'Auf die Warteliste'}
      </button>
      <p
        className={`${styles.meldung} ${meldung?.fehler ? styles['meldung--fehler'] : ''}`}
        id={MELDUNG_ID}
        role="status"
        aria-live="polite"
      >
        {meldung?.text}
      </p>
    </form>
  );
}
