'use client';

import { useState } from 'react';

import styles from '../seite.module.css';

interface Uebung {
  readonly name: string;
  readonly alternative: string;
  readonly daten: string;
}

/** Beispiel aus dem Entwurf: Oberkörper A, zu Hause mit Kurzhanteln. */
const UEBUNGEN: readonly Uebung[] = [
  {
    name: 'Kurzhantel-Bankdrücken',
    alternative: 'Liegestütze mit erhöhten Füßen',
    daten: '3 × 10 Wdh., 22 kg',
  },
  {
    name: 'Einarmiges Rudern',
    alternative: 'Rudern mit Widerstandsband',
    daten: '3 × 10 Wdh., 22 kg',
  },
  { name: 'Schulterdrücken sitzend', alternative: 'Pike-Liegestütze', daten: '3 × 12 Wdh., 14 kg' },
  { name: 'Hammercurls', alternative: 'Bizepscurls mit Kettlebell', daten: '3 × 12 Wdh., 12 kg' },
];

/** Belastungsempfinden 0–10 (RPE). */
export const RPE_TEXTE = [
  'Völlig locker',
  'Sehr leicht',
  'Leicht',
  'Locker',
  'Angenehm fordernd',
  'Spürbar',
  'Fordernd, aber gut machbar',
  'Anstrengend',
  'Sehr anstrengend',
  'Fast am Limit',
  'Absolutes Maximum',
] as const;

function Haken() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 8.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Interaktive Beispiel-Einheit: abhaken, Alternative wählen, Belastung einschätzen. Nur Anzeige, speichert nichts. */
export function Beispieleinheit() {
  const [erledigt, setErledigt] = useState<readonly boolean[]>(() => UEBUNGEN.map(() => false));
  const [alternativ, setAlternativ] = useState<readonly boolean[]>(() => UEBUNGEN.map(() => false));
  const [rpe, setRpe] = useState(6);

  const fertig = erledigt.filter(Boolean).length;
  const stand =
    fertig === UEBUNGEN.length ? 'Einheit geschafft' : `${fertig} von ${UEBUNGEN.length}`;
  const umschalten = (liste: readonly boolean[], index: number) =>
    liste.map((wert, i) => (i === index ? !wert : wert));

  return (
    <div
      className={styles.einheit}
      aria-label="Beispiel einer Trainingseinheit zum Ausprobieren"
      role="group"
    >
      <div className={styles['einheit__kopf']}>
        <div>
          <p className={styles['einheit__name']}>Heute: Oberkörper A</p>
          <p className={styles['einheit__hinweis']}>
            Beispiel zum Ausprobieren, zu Hause mit Kurzhanteln
          </p>
        </div>
        <span className={styles['einheit__stand']} data-testid="stand" aria-live="polite">
          {stand}
        </span>
      </div>

      <ul className={styles.uebungen}>
        {UEBUNGEN.map((uebung, index) => {
          const name = alternativ[index] ? uebung.alternative : uebung.name;
          const istErledigt = erledigt[index] ?? false;
          return (
            <li key={uebung.name} className={styles.uebung} data-erledigt={istErledigt}>
              <button
                type="button"
                className={styles['uebung__haken']}
                aria-pressed={istErledigt}
                aria-label={`${name} als erledigt markieren`}
                onClick={() => setErledigt((liste) => umschalten(liste, index))}
              >
                <Haken />
              </button>
              <div>
                <span className={styles['uebung__name']}>{name}</span>
                <span className={styles['uebung__daten']}>{uebung.daten}</span>
              </div>
              <button
                type="button"
                className={styles['uebung__alt']}
                onClick={() => setAlternativ((liste) => umschalten(liste, index))}
              >
                {alternativ[index] ? 'Original' : 'Alternative'}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.empfinden}>
        <label htmlFor="rpe">
          Wie anstrengend war es?{' '}
          <span className={styles['empfinden__wert']} data-testid="rpe-wert">
            {rpe}
          </span>
        </label>
        <input
          type="range"
          id="rpe"
          min={0}
          max={10}
          value={rpe}
          aria-describedby="rpe-text"
          aria-valuetext={`${rpe} – ${RPE_TEXTE[rpe]}`}
          onChange={(event) => setRpe(Number(event.target.value))}
        />
        <p className={styles['empfinden__text']} id="rpe-text">
          {RPE_TEXTE[rpe]}
        </p>
      </div>
    </div>
  );
}
