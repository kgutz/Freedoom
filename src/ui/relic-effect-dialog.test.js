import { describe, expect, it, vi } from 'vitest';
import { effectControl, effectControlList, installRelicEffectDialog } from './relic-effect-dialog.js';

function fixture() {
  const listeners = {};
  const nodes = {};
  const body = { style: { overflow: 'auto' }, append: vi.fn() };
  const parent = { style: { overflow: 'scroll' } };
  const document = { body, getElementById: () => body.append.mock.calls.length ? dialog : null,
    createElement: () => dialog, addEventListener: (name, handler) => { listeners[name] = handler; } };
  const dialog = { open: false, setAttribute: vi.fn(),
    querySelector: selector => nodes[selector] ||= { textContent: '', focus: vi.fn(), addEventListener: (name, handler) => { listeners[`button:${name}`] = handler; } },
    addEventListener: (name, handler) => { listeners[`dialog:${name}`] = handler; },
    showModal: vi.fn(() => { dialog.open = true; }),
    close: vi.fn(() => { dialog.open = false; listeners['dialog:close'](); }),
    getBoundingClientRect: () => ({ left: 20, right: 320, top: 20, bottom: 320 }) };
  const trigger = { dataset: { effectName: 'Constancia', effectDescription: 'Descripción exacta: 30 XP.', effectKind: 'EFECTO PRINCIPAL' },
    isConnected: true, focus: vi.fn(), closest: () => parent };
  const event = (extra = {}) => ({ target: { closest: () => trigger }, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extra });
  installRelicEffectDialog(document);
  return { document, dialog, nodes, body, parent, trigger, listeners, event };
}

describe('Detalle accesible compartido de efectos', () => {
  it('expone solo el nombre, con botón nativo y descripción escapada en datos', () => {
    const html = effectControl({ id: 'test', name: 'Nombre', description: 'Texto "seguro" <script>' });
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="relicEffectInfoDialog"');
    expect(html).toContain('Texto &quot;seguro&quot; &lt;script&gt;');
    expect(html).toMatch(/>Nombre<\/button>$/);
    expect(html).not.toContain('<p>');
  });
  it('usa el mismo patrón para varios principales y extras', () => {
    const html = effectControlList(['A', 'B', 'C'].map(id => ({ id, name: id, description: `Detalle ${id}` })), 'EFECTO EXTRA');
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(3);
    expect(html.match(/data-effect-kind="EFECTO EXTRA"/g)).toHaveLength(3);
    expect(html).toContain('<span class="relic-effect-conjunction">y </span>');
    expect(html).toContain('>A</button><span class="relic-effect-comma">,</span></span>');
    expect(html).not.toContain('aria-hidden="true"');
    expect(html.replace(/<[^>]+>/g, '')).toBe('A, B y C');
  });
  it('abre una sola instancia, muestra copy exacto y coloca el foco en cerrar', () => {
    const f = fixture();
    f.listeners.click(f.event());
    f.listeners.click(f.event());
    installRelicEffectDialog(f.document);
    expect(f.dialog.showModal).toHaveBeenCalledTimes(1);
    expect(f.body.append).toHaveBeenCalledTimes(1);
    expect(f.nodes['#relicEffectInfoTitle'].textContent).toBe('Constancia');
    expect(f.nodes['#relicEffectInfoDescription'].textContent).toBe('Descripción exacta: 30 XP.');
    expect(f.nodes.button.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(f.body.style.overflow).toBe('hidden');
    expect(f.parent.style.overflow).toBe('hidden');
  });
  it.each(['button:click', 'dialog:cancel', 'dialog:keydown'])('%s restaura scroll y foco sin cerrar el padre', action => {
    const f = fixture(); f.listeners.click(f.event());
    const event = f.event({ key: 'Escape' }); f.listeners[action](event);
    expect(f.dialog.open).toBe(false);
    expect(f.body.style.overflow).toBe('auto');
    expect(f.parent.style.overflow).toBe('scroll');
    expect(f.trigger.focus).toHaveBeenCalledWith({ preventScroll: true });
    if (action !== 'button:click') expect(event.stopPropagation).toHaveBeenCalled();
  });
  it('no cierra con otras teclas ni al pulsar dentro; sí al pulsar fuera', () => {
    const f = fixture(); f.listeners.click(f.event());
    f.listeners['dialog:keydown'](f.event({ key: 'Enter' }));
    const inside = f.event({ target: f.dialog, clientX: 100, clientY: 100 });
    f.listeners['dialog:pointerdown'](inside); f.listeners['dialog:click'](inside);
    expect(f.dialog.open).toBe(true);
    const outside = f.event({ target: f.dialog, clientX: 5, clientY: 5 });
    f.listeners['dialog:pointerdown'](outside); f.listeners['dialog:click'](outside);
    expect(f.dialog.open).toBe(false);
  });
  it('no devuelve foco a un disparador retirado del DOM', () => {
    const f = fixture(); f.listeners.click(f.event()); f.trigger.isConnected = false;
    f.dialog.close(); expect(f.trigger.focus).not.toHaveBeenCalled();
  });
  it.each([false, true])('Tab (shift=%s) mantiene el foco dentro del detalle', shiftKey => {
    const f = fixture(); f.listeners.click(f.event());
    const event = f.event({ key: 'Tab', shiftKey });
    f.listeners['dialog:keydown'](event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(f.nodes.button.focus).toHaveBeenCalledTimes(2);
    expect(f.dialog.open).toBe(true);
  });
});
