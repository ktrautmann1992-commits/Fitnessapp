'use client';

import { useState } from 'react';

import styles from '../admin.module.css';

/**
 * Kopiert Text in die Zwischenablage (z. B. IDs für den Workflow content-review). Ohne Zwischenablage-Zugriff
 * bleibt das Textfeld daneben zum Markieren und Kopieren.
 */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.buttonSecondary} ${styles.fullWidth}`}
        onClick={copy}
      >
        {state === 'copied' ? 'Kopiert ✓' : label}
      </button>
      <span role="status" aria-live="polite" className={`${styles.small} ${styles.muted}`}>
        {state === 'failed'
          ? 'Kopieren nicht möglich – bitte im Feld oben markieren und kopieren.'
          : ''}
      </span>
    </>
  );
}
