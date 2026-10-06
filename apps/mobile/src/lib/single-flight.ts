/**
 * Doppel-Tipp-Schutz (Wächter D K2): Solange ein Aufruf läuft, liefert jeder weitere denselben Promise statt eine
 * zweite Ausführung zu starten (z. B. „Datei herunterladen“ zweimal schnell hintereinander). Danach wieder frei.
 */
export function singleFlight<T>(run: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  return () => {
    if (running) return running;
    running = run().finally(() => {
      running = null;
    });
    return running;
  };
}
