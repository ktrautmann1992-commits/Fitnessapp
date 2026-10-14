import { Share } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { COPY_AVAILABLE, copyText, shareText } from './share-text.native';

const platform = vi.hoisted(() => ({ OS: 'ios' as 'ios' | 'android' }));

vi.mock('react-native', () => ({
  Platform: platform,
  Share: { share: vi.fn(), sharedAction: 'sharedAction', dismissedAction: 'dismissedAction' },
}));

describe('Weitergeben nativ (React-Native-Share, N12)', () => {
  beforeEach(() => {
    vi.mocked(Share.share).mockReset();
    platform.OS = 'ios';
  });

  it('öffnet den System-Teilen-Dialog mit genau dem Text', async () => {
    vi.mocked(Share.share).mockResolvedValue({ action: 'sharedAction' });
    await expect(shareText('- 500 g Reis', 'Einkaufsliste')).resolves.toBe('shared');
    expect(Share.share).toHaveBeenCalledWith(
      { message: '- 500 g Reis', title: 'Einkaufsliste' },
      { dialogTitle: 'Einkaufsliste', subject: 'Einkaufsliste' },
    );
    expect(COPY_AVAILABLE).toBe(false);
    await expect(copyText('x')).resolves.toBe('manual');
  });

  it('Android: immer nur „Teilen-Dialog geöffnet“, nie „Weitergegeben“ (Wächter N12 S2)', async () => {
    platform.OS = 'android';
    // Android löst auch nach Schließen ohne Ziel mit sharedAction auf.
    vi.mocked(Share.share).mockResolvedValue({ action: 'sharedAction' });
    await expect(shareText('x', 'Einkaufsliste')).resolves.toBe('opened');
  });

  it('Schließen ohne Ziel (iOS) → „cancelled“', async () => {
    vi.mocked(Share.share).mockResolvedValue({ action: 'dismissedAction' });
    await expect(shareText('x', 'Einkaufsliste')).resolves.toBe('cancelled');
  });

  it('Fehler ohne Listen-Inhalt in der Meldung', async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error('geheim: 500 g Reis'));
    const error = await shareText('500 g Reis', 'Einkaufsliste').catch((e: unknown) => e as Error);
    expect((error as Error).message).toBe('share_failed');
  });
});
