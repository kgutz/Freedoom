import { describe, expect, it, vi } from 'vitest';
import { closeSkillInfoDialog, installSkillInfoDialog, showSkillInfoDialog } from './skill-info-dialog.js';

function fixture() {
  const listeners = {};
  const nodes = {};
  const body = { style: { overflow: 'auto' }, append: vi.fn() };
  const parent = { style: { overflow: 'scroll' } };
  const document = {
    body,
    getElementById: () => (body.append.mock.calls.length ? dialog : null),
    createElement: () => dialog,
  };
  const dialog = {
    open: false,
    className: '',
    innerHTML: '',
    setAttribute: vi.fn(),
    querySelector: selector => (nodes[selector] ||= { textContent: '', src: '', style: {} }),
    addEventListener: (name, handler) => { listeners[`dialog:${name}`] = handler; },
    showModal: vi.fn(() => { dialog.open = true; }),
    close: vi.fn(() => { dialog.open = false; listeners['dialog:close'](); }),
  };
  const trigger = { isConnected: true, focus: vi.fn() };
  const event = (extra = {}) => ({ preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extra });
  return { document, dialog, nodes, body, parent, trigger, listeners, event };
}

describe('Detalle de habilidad al mantener pulsado', () => {
  it('crea una sola instancia del diálogo nativo, sin botón de cierre ni kicker', () => {
    const f = fixture();
    installSkillInfoDialog(f.document);
    installSkillInfoDialog(f.document);
    expect(f.body.append).toHaveBeenCalledTimes(1);
    expect(f.dialog.innerHTML).not.toContain('<button');
    expect(f.dialog.innerHTML).not.toContain('skillInfoKicker');
  });

  it('muestra nombre, descripción, maná, nivel e ícono al abrir', () => {
    const f = fixture();
    showSkillInfoDialog(f.document, {
      trigger: f.trigger,
      name: 'Regeneración',
      description: 'Potencia 2 hábitos: +5 XP y +5% Vida cada uno.',
      mana: 55,
      level: 8,
      iconSrc: 'spells/druid_spells/druid_act_regen.webp',
      iconFallback: 'R',
    });
    expect(f.dialog.showModal).toHaveBeenCalledTimes(1);
    expect(f.nodes['#skillInfoTitle'].textContent).toBe('Regeneración');
    expect(f.nodes['#skillInfoDescription'].textContent).toBe('Potencia 2 hábitos: +5 XP y +5% Vida cada uno.');
    expect(f.nodes['#skillInfoMana'].textContent).toBe(55);
    expect(f.nodes['#skillInfoLevel'].textContent).toBe(8);
    expect(f.nodes['#skillInfoIcon'].src).toBe('spells/druid_spells/druid_act_regen.webp');
    expect(f.body.style.overflow).toBe('hidden');
  });

  it('no abre una segunda instancia mientras ya está abierto', () => {
    const f = fixture();
    showSkillInfoDialog(f.document, { trigger: f.trigger, name: 'A', description: 'a', mana: 1, level: 1 });
    showSkillInfoDialog(f.document, { trigger: f.trigger, name: 'B', description: 'b', mana: 2, level: 2 });
    expect(f.dialog.showModal).toHaveBeenCalledTimes(1);
    expect(f.nodes['#skillInfoTitle'].textContent).toBe('A');
  });

  it('closeSkillInfoDialog cierra el diálogo abierto y restaura scroll y foco', () => {
    const f = fixture();
    showSkillInfoDialog(f.document, { trigger: f.trigger, name: 'A', description: 'a', mana: 1, level: 1 });
    closeSkillInfoDialog(f.document);
    expect(f.dialog.close).toHaveBeenCalledTimes(1);
    expect(f.dialog.open).toBe(false);
    expect(f.body.style.overflow).toBe('auto');
    expect(f.trigger.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('closeSkillInfoDialog no hace nada si ya está cerrado o no existe', () => {
    const f = fixture();
    expect(() => closeSkillInfoDialog(f.document)).not.toThrow();
    showSkillInfoDialog(f.document, { trigger: f.trigger, name: 'A', description: 'a', mana: 1, level: 1 });
    closeSkillInfoDialog(f.document);
    closeSkillInfoDialog(f.document);
    expect(f.dialog.close).toHaveBeenCalledTimes(1);
  });

  it('Escape (cancel) también cierra, como respaldo de teclado', () => {
    const f = fixture();
    showSkillInfoDialog(f.document, { trigger: f.trigger, name: 'A', description: 'a', mana: 1, level: 1 });
    f.listeners['dialog:cancel'](f.event());
    expect(f.dialog.close).toHaveBeenCalledTimes(1);
  });

  it('un pointerdown sobre el backdrop (target es el propio diálogo) lo cierra', () => {
    const f = fixture();
    showSkillInfoDialog(f.document, { trigger: f.trigger, name: 'A', description: 'a', mana: 1, level: 1 });
    f.listeners['dialog:pointerdown'](f.event({ target: f.dialog }));
    expect(f.dialog.close).toHaveBeenCalledTimes(1);
  });

  it('un pointerdown sobre el contenido (no el propio diálogo) no lo cierra', () => {
    const f = fixture();
    showSkillInfoDialog(f.document, { trigger: f.trigger, name: 'A', description: 'a', mana: 1, level: 1 });
    f.listeners['dialog:pointerdown'](f.event({ target: {} }));
    expect(f.dialog.close).not.toHaveBeenCalled();
  });

  it('no devuelve foco a un disparador retirado del DOM', () => {
    const f = fixture();
    showSkillInfoDialog(f.document, { trigger: f.trigger, name: 'A', description: 'a', mana: 1, level: 1 });
    f.trigger.isConnected = false;
    closeSkillInfoDialog(f.document);
    expect(f.trigger.focus).not.toHaveBeenCalled();
  });
});
