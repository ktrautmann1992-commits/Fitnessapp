/**
 * Anbieter-neutrale Schnittstelle der Content-Pipeline zur KI-API (docs/PLAN-PHASE-5.md N8).
 *
 * generate/collect/results kennen nur diese Typen; die Umsetzung für Google Gemini steht in `gemini.ts`. Tests
 * ersetzen den Client durch einen Mock (keine echten Netzaufrufe in CI).
 *
 * Datenschutz: Eine Anfrage enthält ausschließlich Inhalts-Prompts (Rollen-Text, Regeln, Katalog-IDs, Matrix-Werte)
 * und das Antwort-Schema – NIE Nutzerdaten. Die Pipeline hat keinen Zugriff auf Nutzerdaten (kein Supabase-Schlüssel
 * in content-generate/content-collect).
 */
import type { ContentEffort } from '../config';
import type { ResponseUsage } from '../pricing';

/** Eine Anfrage im Batch (eine Zelle der Matrix). */
export interface BatchRequest {
  /** Eindeutige Kennung im Batch (Zuordnung der Antwort). */
  readonly customId: string;
  /** System-Text (für alle Anfragen eines Laufs gleich). */
  readonly systemInstruction: string;
  /** Anfrage-Text je Zelle. */
  readonly userText: string;
  /** JSON-Schema der Antwort (strukturierte Ausgabe, `json-schema.ts`). */
  readonly responseJsonSchema: Record<string, unknown>;
  /** Höchstzahl Ausgabe-Token inkl. Denken. */
  readonly maxOutputTokens: number;
  /** Denktiefe. */
  readonly effort: ContentEffort;
}

/** Wie eine gelieferte Antwort endete. */
export type FinishKind =
  /** normal beendet – Text auswerten */
  | 'stop'
  /** Höchstzahl Ausgabe-Token erreicht (abgeschnitten) */
  | 'max_tokens'
  /** abgelehnt bzw. vom Sicherheitsfilter blockiert */
  | 'refusal'
  /** anderer, unerwarteter Grund */
  | 'other';

/** Ergebnis einer Anfrage (anbieter-neutral). */
export interface BatchResult {
  readonly custom_id: string;
  readonly result:
    | {
        readonly type: 'succeeded';
        /** Antwort-Text (ohne Denk-Teile). */
        readonly text: string;
        readonly finish: FinishKind;
        /** Grund im Wortlaut der API (z. B. `SAFETY`), leer bei `stop`. */
        readonly finishDetail: string;
        readonly usage: ResponseUsage;
      }
    | { readonly type: 'errored'; readonly detail: string }
    | { readonly type: 'expired' }
    | { readonly type: 'canceled' };
}

/** Stand eines Batch-Laufs. */
export type BatchStatus =
  | { readonly state: 'pending'; readonly info: string }
  | { readonly state: 'ended'; readonly info: string; readonly results: BatchResult[] };

/** Der Teil der KI-API, den die Pipeline nutzt (im Test ersetzbar). */
export interface ContentApiClient {
  /** Anbieter (steht in der Merkdatei). */
  readonly provider: 'gemini';
  /** Eingabe-Token einer Anfrage (kostenlose Zähl-Funktion der API). */
  countTokens(model: string, request: BatchRequest): Promise<number>;
  /** Legt EINEN Batch an; liefert die Batch-Kennung. Ab hier entstehen Kosten. */
  createBatch(
    model: string,
    requests: readonly BatchRequest[],
    displayName: string,
  ): Promise<{ readonly id: string }>;
  /**
   * Stand eines Batches. `customIds` = Anfragen in der gesendeten Reihenfolge (nur als Rückfall, falls die API eine
   * Antwort ohne Kennung liefert – laut API ist die Reihenfolge der Antworten die der Anfragen).
   */
  getBatch(id: string, customIds: readonly string[]): Promise<BatchStatus>;
}
