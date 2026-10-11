'use client';

import Link from 'next/link';
import { type FormEvent, useRef, useState } from 'react';

import { LEAD_MAGNET_CONSENT } from '@/lib/waitlist/consent';

import styles from '../seite.module.css';

type Meldung = { readonly text: string; readonly fehler: boolean } | null;
type FehlerFeld = 'email' | 'zustimmung' | null;

const MELDUNG_ID = 'rezepte-meldung';

const FEHLER_EMAIL = 'Bitte gib eine gültige E-Mail-Adresse ein.';
const FEHLER_ZUSTIMMUNG = 'Bitte bestätige, dass wir dir den Download-Link schicken dürfen.';
const FEHLER_NETZ = 'Keine Verbindung. Bitte prüf dein Internet und versuch es noch einmal.';

/** Einwilligungstext mit Link auf die Datenschutzerklärung (Text selbst aus consent.ts – eine Quelle). */
const [DOWNLOAD_VOR, DOWNLOAD_NACH] = LEAD_MAGNET_CONSENT.download.split('Datenschutzerklärung');

/**
 * Formular „20 Rezepte gratis als PDF“. Schickt an POST /api/gratis-rezepte (Double-Opt-in, Liste lead-magnet).
 * Pflicht ist nur die Einwilligung zur Zusendung des Download-Links. Das Newsletter-Häkchen ist freiwillig und
 * NICHT vorausgewählt (Gründer-Entscheidung 11.10.2026: Download ohne Newsletter-Pflicht).
 * Das Feld „website“ ist ein Honeypot gegen Bots (für Menschen unsichtbar).
 * TODO(Recht): Texte vor dem Livegang prüfen lassen.
 */
export function GratisRezepteFormular() {
  const emailRef = useRef<HTMLInputElement>(null);
  const zustimmungRef = useRef<HTMLInputElement>(null);
  const [fehlerFeld, setFehlerFeld] = useState<FehlerFeld>(null);
  const [zustimmung, setZustimmung] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
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
      const antwort = await fetch('/api/gratis-rezepte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value,
          consent: true,
          newsletter,
          website: website ?? '',
        }),
      });
      const daten = (await antwort.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      setMeldung({
        text: daten?.message ?? FEHLER_NETZ,
        // „Bald verfügbar“ ist kein Fehler der Besucherin – freundlich, nicht in Signalfarbe.
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
        <label htmlFor="rezepte-email">E-Mail-Adresse</label>
        <input
          ref={emailRef}
          type="email"
          id="rezepte-email"
          name="email"
          autoComplete="email"
          placeholder="name@beispiel.de"
          maxLength={254}
          required
          aria-invalid={fehlerFeld === 'email'}
          aria-describedby={MELDUNG_ID}
        />
      </div>
      <div className={styles.honig} aria-hidden="true" inert>
        <label htmlFor="rezepte-website">Website (bitte leer lassen)</label>
        <input type="text" id="rezepte-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className={styles.zustimmung}>
        <input
          type="checkbox"
          ref={zustimmungRef}
          id="rezepte-zustimmung"
          aria-invalid={fehlerFeld === 'zustimmung'}
          aria-describedby={MELDUNG_ID}
          checked={zustimmung}
          onChange={(event) => setZustimmung(event.target.checked)}
        />
        <span data-testid="rezepte-einwilligung">
          {DOWNLOAD_VOR}
          <Link href="/datenschutz#gratis-rezepte">Datenschutzerklärung</Link>
          {DOWNLOAD_NACH}
        </span>
      </label>
      <label className={styles.zustimmung}>
        <input
          type="checkbox"
          id="rezepte-newsletter"
          checked={newsletter}
          onChange={(event) => setNewsletter(event.target.checked)}
        />
        <span data-testid="rezepte-newsletter-text">{LEAD_MAGNET_CONSENT.newsletter}</span>
      </label>
      <button
        className={`${styles.knopf} ${styles['knopf--primaer']}`}
        id="rezepte-anfordern"
        type="submit"
        disabled={sendet}
      >
        {sendet ? 'Wird gesendet …' : 'Rezepte gratis anfordern'}
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
