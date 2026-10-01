import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');

describe('salida del Callejón', () => {
  it('la X muestra el inventario y devuelve el foco sin abrir la ficha de personaje', () => {
    const handler = main.match(/if\(event\.target\.closest\('\[data-close-shop-map\]'\)\)\{([^}]+)\}/)[1];
    const showInventoryPanel = vi.fn();
    const returnToCharacterSheetFromShop = vi.fn();
    const focus = vi.fn();
    const document = { getElementById: vi.fn(() => ({ focus })) };
    new Function('showInventoryPanel', 'returnToCharacterSheetFromShop', 'document',
      `let forgeFromCity=true;${handler}`)(showInventoryPanel, returnToCharacterSheetFromShop, document);
    expect(showInventoryPanel).toHaveBeenCalledExactlyOnceWith('bag');
    expect(returnToCharacterSheetFromShop).not.toHaveBeenCalled();
    expect(document.getElementById).toHaveBeenCalledWith('bagTab');
    expect(focus).toHaveBeenCalledOnce();
  });
});
