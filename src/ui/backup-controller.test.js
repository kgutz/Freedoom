import { describe, expect, it, vi } from 'vitest';
import { backupFileName, bindBackupControls } from './backup-controller.js';

function element(id) {
  const listeners = new Map();
  return {
    id,
    value: '',
    textContent: '',
    readOnly: false,
    classList: { add: vi.fn(), remove: vi.fn() },
    addEventListener: (type, listener) => listeners.set(type, listener),
    click: () => listeners.get('click')?.({ target: { id } }),
    focus: vi.fn(),
    select: vi.fn(),
  };
}

function fixture() {
  const ids = ['backupBg', 'backupText', 'backupTitle', 'backupAction', 'btnExport', 'btnImport'];
  const elements = Object.fromEntries(ids.map((id) => [id, element(id)]));
  return {
    elements,
    document: { getElementById: (id) => elements[id] },
  };
}

describe('herramientas de recuperación manual', () => {
  it('comparte la partida como archivo de texto cuando el móvil lo permite', async () => {
    const { document, elements } = fixture();
    const file = { name: 'Freedom-partida-2026-09-04.txt', type: 'text/plain;charset=utf-8' };
    const createFile = vi.fn(() => file);
    const share = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    bindBackupControls({
      document,
      navigator: { canShare: vi.fn(() => true), share },
      getState: () => ({ config: {}, days: { today: { c: 1 } } }),
      onImported: vi.fn(),
      showToast,
      createFile,
      downloadFile: vi.fn(),
      now: () => new Date(2026, 8, 4, 12),
    });
    elements.btnExport.click();
    await Promise.resolve();
    expect(createFile).toHaveBeenCalledWith(
      '{"config":{},"days":{"today":{"c":1}}}',
      'Freedom-partida-2026-09-04.txt',
    );
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [file] }));
    expect(showToast).toHaveBeenCalledWith('Partida compartida ✓', 'heal');
  });

  it('descarga el archivo cuando compartir archivos no está disponible', async () => {
    const { document, elements } = fixture();
    const file = { name: 'Freedom-partida-2026-09-04.txt' };
    const downloadFile = vi.fn(() => true);
    bindBackupControls({
      document,
      navigator: {},
      getState: () => ({ config: {}, days: {} }),
      onImported: vi.fn(),
      showToast: vi.fn(),
      createFile: () => file,
      downloadFile,
    });
    elements.btnExport.click();
    await Promise.resolve();
    expect(downloadFile).toHaveBeenCalledWith(file);
  });

  it('no inicia otra exportación cuando el usuario cancela el menú de compartir', async () => {
    const { document, elements } = fixture();
    const cancelled = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const downloadFile = vi.fn(() => true);
    const writeText = vi.fn();
    bindBackupControls({
      document,
      navigator: {
        canShare: vi.fn(() => true),
        share: vi.fn().mockRejectedValue(cancelled),
        clipboard: { writeText },
      },
      getState: () => ({ config: {}, days: {} }),
      onImported: vi.fn(),
      showToast: vi.fn(),
      createFile: () => ({ name: 'partida.txt' }),
      downloadFile,
    });
    elements.btnExport.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(downloadFile).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('conserva el portapapeles como último respaldo', async () => {
    const { document, elements } = fixture();
    const writeText = vi.fn().mockResolvedValue(undefined);
    bindBackupControls({
      document,
      navigator: { clipboard: { writeText } },
      getState: () => ({ config: {}, days: { today: { c: 1 } } }),
      onImported: vi.fn(),
      showToast: vi.fn(),
      createFile: () => ({ name: 'partida.txt' }),
      downloadFile: () => false,
    });
    elements.btnExport.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('{"config":{},"days":{"today":{"c":1}}}');
  });

  it('genera un nombre corto con la fecha local', () => {
    expect(backupFileName(new Date(2026, 8, 4, 23, 30))).toBe('Freedom-partida-2026-09-04.txt');
  });

  it('importa una partida desde el control de emergencia', () => {
    const { document, elements } = fixture();
    const onImported = vi.fn();
    bindBackupControls({
      document,
      navigator: { clipboard: { writeText: vi.fn() } },
      getState: () => ({ config: {}, days: {} }),
      onImported,
      showToast: vi.fn(),
    });
    elements.btnImport.click();
    elements.backupText.value = '{"config":{"startLimit":8},"days":{}}';
    elements.backupAction.click();
    expect(onImported).toHaveBeenCalledOnce();
    expect(onImported.mock.calls[0][0].config.startLimit).toBe(8);
  });

  it('aplica un comando aditivo desde el mismo recuadro', () => {
    const { document, elements } = fixture();
    const onImported = vi.fn();
    const showToast = vi.fn();
    bindBackupControls({
      document,
      navigator: { clipboard: { writeText: vi.fn() } },
      getState: () => ({ config: {}, days: {}, economy: { bossBlood: 2 } }),
      onImported,
      showToast,
    });
    elements.btnImport.click();
    elements.backupText.value = '!+sangre 1';
    elements.backupAction.click();
    expect(onImported.mock.calls[0][0].economy.bossBlood).toBe(3);
    expect(showToast).toHaveBeenCalledWith('Comando aplicado ✓', 'heal');
  });
});
