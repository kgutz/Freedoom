import { describe, expect, it, vi } from 'vitest';
import { bindBackupControls } from './backup-controller.js';

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
  it('exporta la partida desde el control de emergencia', async () => {
    const { document, elements } = fixture();
    const writeText = vi.fn().mockResolvedValue(undefined);
    bindBackupControls({
      document,
      navigator: { clipboard: { writeText } },
      getState: () => ({ config: {}, days: { today: { c: 1 } } }),
      onImported: vi.fn(),
      showToast: vi.fn(),
    });
    elements.btnExport.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('{"config":{},"days":{"today":{"c":1}}}');
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
});
