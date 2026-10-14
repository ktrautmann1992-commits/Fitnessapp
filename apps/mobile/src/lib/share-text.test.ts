/**
 * Etappe N12 – Weitergeben im Browser (docs/PLAN-PHASE-5.md 19.7 N12): Web Share API, Rückfall Kopieren, Rückfall
 * „manuell“; Abbrechen ist kein Fehler; nichts geht an einen Server (kein fetch), nichts wird geloggt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COPY_AVAILABLE, copyText, shareText } from './share-text';

const TEXT = 'Einkaufsliste 12.10.2026 – 18.10.2026\n\nObst & Gemüse\n- 500 g Möhren 🥕';

function stubNavigator(value: object) {
  vi.stubGlobal('navigator', value);
}

describe('Weitergeben im Browser (N12)', () => {
  const fetchSpy = vi.fn();
  const logSpies: ReturnType<typeof vi.spyOn>[] = [];
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      logSpies.push(vi.spyOn(console, method).mockImplementation(() => undefined));
    }
  });
  afterEach(() => {
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const spy of logSpies) expect(spy).not.toHaveBeenCalled();
    logSpies.length = 0;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Teilen-Dialog des Browsers mit genau dem Text', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    stubNavigator({ share, canShare: () => true, clipboard: { writeText } });
    await expect(shareText(TEXT, 'Einkaufsliste')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Einkaufsliste', text: TEXT });
    expect(writeText).not.toHaveBeenCalled();
    expect(COPY_AVAILABLE).toBe(true);
  });

  it('Abbrechen im Dialog → „cancelled“, kein Kopieren', async () => {
    const writeText = vi.fn();
    stubNavigator({
      share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })),
      clipboard: { writeText },
    });
    await expect(shareText(TEXT, 'Einkaufsliste')).resolves.toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('ohne Web Share API (z. B. Desktop-Browser) → Kopieren', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } });
    await expect(shareText(TEXT, 'Einkaufsliste')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it('canShare verneint oder anderer Fehler → Kopieren', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn();
    stubNavigator({ share, canShare: () => false, clipboard: { writeText } });
    await expect(shareText(TEXT, 'Einkaufsliste')).resolves.toBe('copied');
    expect(share).not.toHaveBeenCalled();
    stubNavigator({
      share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })),
      clipboard: { writeText },
    });
    await expect(shareText(TEXT, 'Einkaufsliste')).resolves.toBe('copied');
  });

  it('keine Zwischenablage bzw. verweigert → „manual“ (Text zum Markieren)', async () => {
    stubNavigator({});
    await expect(shareText(TEXT, 'Einkaufsliste')).resolves.toBe('manual');
    await expect(copyText(TEXT)).resolves.toBe('manual');
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await expect(copyText(TEXT)).resolves.toBe('manual');
  });
});
