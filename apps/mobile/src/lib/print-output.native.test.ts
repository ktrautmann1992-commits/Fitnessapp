import * as Print from 'expo-print';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { A4_PORTRAIT, PRINT_TARGET, printHtml } from './print-output.native';

vi.mock('expo-print', () => ({ printAsync: vi.fn() }));

describe('Drucken nativ (expo-print, P4)', () => {
  beforeEach(() => {
    vi.mocked(Print.printAsync).mockReset();
  });

  it('öffnet den System-Druckdialog mit A4 595 × 842 (B3) – keine Datei, kein Teilen (B2)', async () => {
    vi.mocked(Print.printAsync).mockResolvedValue(undefined);
    expect(PRINT_TARGET).toBe('native');
    await expect(printHtml('<html></html>')).resolves.toBe('started');
    expect(Print.printAsync).toHaveBeenCalledWith({
      html: '<html></html>',
      width: 595,
      height: 842,
    });
    expect(A4_PORTRAIT).toEqual({ width: 595, height: 842 });
  });

  it('Abbrechen im Druckdialog (iOS) ist kein Fehler', async () => {
    vi.mocked(Print.printAsync).mockRejectedValue(
      Object.assign(new Error('Printing did not complete'), { code: 'ERR_PRINT_INCOMPLETE' }),
    );
    await expect(printHtml('<html></html>')).resolves.toBe('cancelled');
  });

  it('Fehler ohne Plan-Inhalte in der Meldung', async () => {
    vi.mocked(Print.printAsync).mockRejectedValue(new Error('geheim: <html>Plan</html>'));
    const error = await printHtml('<html>Plan</html>').catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('print_failed');
  });
});
