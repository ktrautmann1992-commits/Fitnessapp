/**
 * Speicher des Widget-Stands (docs/PLAN-WIDGET.md 2). Browser und iPhone: es gibt (noch) kein Widget – nichts wird
 * gespeichert. Android: widget-store.android.ts (verschlüsselt).
 */
export interface WidgetSnapshotStore {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
  clear(): Promise<void>;
}

export const widgetSnapshotStore: WidgetSnapshotStore = {
  read: async () => null,
  write: async () => undefined,
  clear: async () => undefined,
};
