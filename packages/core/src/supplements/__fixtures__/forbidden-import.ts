/**
 * ABSICHTLICH VERBOTEN – Test des Tests für `supplements/structure.test.ts` (Plan 9.3 Nr. 5). Diese Datei importiert
 * einen Ordner (Barrel) und erreicht so den Händler-Code. Der Strukturtest muss sie erkennen; sie wird von keiner
 * anderen Datei importiert und ist von den normalen Prüfungen ausgenommen.
 */
export * from '../../retail';
