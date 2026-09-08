import { describe, expect, it } from 'vitest';
import { outfitAuditMarkup } from './outfit-audit-view.js';

describe('auditoria visual de outfits', () => {
  it('incluye todos los heroes, outfits y superficies calibradas', () => {
    const html = outfitAuditMarkup();

    expect(html.match(/class="outfit-audit-class"/g)).toHaveLength(4);
    expect(html.match(/class="outfit-audit-outfit"/g)).toHaveLength(20);
    expect(html.match(/HÉROE · 120 × 120/g)).toHaveLength(20);
    expect(html.match(/FICHA · CUADRADO/g)).toHaveLength(20);
    expect(html.match(/TIENDA \/ INVENTARIO · 4:5/g)).toHaveLength(20);
    expect(html.match(/HOY \/ HÁBITOS · 56 × 56/g)).toHaveLength(20);
    expect(html).toContain('data-outfit-display');
    expect(html).toContain('--outfit-face-size:');
    expect(html).toContain('outfit-full-body--outfit-celestial-rhythm-master');
  });
});
