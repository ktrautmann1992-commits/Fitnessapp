import { Directory } from 'expo-file-system';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SAVE_TARGET, saveTextFile, uniqueFileName } from './save-file.native';

vi.mock('expo-file-system', () => ({ Directory: { pickDirectoryAsync: vi.fn() } }));

describe('Datei speichern nativ (Datenexport, Etappe D)', () => {
  const write = vi.fn();
  const createFile = vi.fn(() => ({ write }));

  beforeEach(() => {
    vi.mocked(Directory.pickDirectoryAsync).mockReset();
    write.mockReset();
    createFile.mockClear();
  });

  it('schreibt in den gewählten Ordner – kein Teilen-Dialog, keine Zwischen-Datei', async () => {
    vi.mocked(Directory.pickDirectoryAsync).mockResolvedValue({
      createFile,
      list: () => [],
    } as unknown as Directory);
    expect(SAVE_TARGET).toBe('folder');
    await expect(saveTextFile('alpha5.json', '{"a":1}')).resolves.toBe('saved');
    expect(createFile).toHaveBeenCalledWith('alpha5.json', 'application/json');
    expect(write).toHaveBeenCalledWith('{"a":1}');
  });

  it('S1: zweiter Export am selben Tag in denselben Ordner → Name mit Zähler (iPhone überschreibt nie)', async () => {
    vi.mocked(Directory.pickDirectoryAsync).mockResolvedValue({
      createFile,
      list: () => [{ name: 'alpha5.json' }, { name: 'alpha5-2.json' }, { name: 'andere.txt' }],
    } as unknown as Directory);
    await expect(saveTextFile('alpha5.json', '{}')).resolves.toBe('saved');
    expect(createFile).toHaveBeenCalledWith('alpha5-3.json', 'application/json');
    expect(uniqueFileName('a.json', new Set())).toBe('a.json');
    expect(uniqueFileName('a.json', new Set(['a.json']))).toBe('a-2.json');
    expect(uniqueFileName('ohne', new Set(['ohne']))).toBe('ohne-2');
  });

  it('Ordner nicht lesbar → gewählter Name', async () => {
    vi.mocked(Directory.pickDirectoryAsync).mockResolvedValue({
      createFile,
      list: () => {
        throw new Error('no access');
      },
    } as unknown as Directory);
    await expect(saveTextFile('alpha5.json', '{}')).resolves.toBe('saved');
    expect(createFile).toHaveBeenCalledWith('alpha5.json', 'application/json');
  });

  it('Abbrechen der Ordner-Auswahl (iPhone und Android) ist kein Fehler', async () => {
    vi.mocked(Directory.pickDirectoryAsync).mockRejectedValue(
      Object.assign(new Error('File picking was cancelled by the user'), {
        code: 'ERR_FILE_PICKING_CANCELLED',
      }),
    );
    await expect(saveTextFile('a.json', '{}')).resolves.toBe('cancelled');
    vi.mocked(Directory.pickDirectoryAsync).mockRejectedValue(
      Object.assign(new Error('The file picker was cancelled by the user'), {
        code: 'ERR_PICKER_CANCELLED',
      }),
    );
    await expect(saveTextFile('a.json', '{}')).resolves.toBe('cancelled');
  });

  it('Fehler ohne Inhalte in der Meldung', async () => {
    vi.mocked(Directory.pickDirectoryAsync).mockResolvedValue({
      list: () => [],
      createFile: () => ({
        write: () => {
          throw new Error('geheim: {"notes":"Knie"}');
        },
      }),
    } as unknown as Directory);
    const error = await saveTextFile('a.json', '{"notes":"Knie"}').catch(
      (e: unknown) => e as Error,
    );
    expect((error as Error).message).toBe('save_failed');
  });
});
