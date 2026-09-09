import { describe, expect, it } from 'vitest';
import { outfitAuditMarkup } from './outfit-audit-view.js';

describe('auditoria visual de outfits', () => {
  it('incluye todos los heroes, outfits y superficies calibradas', () => {
    const html = outfitAuditMarkup();

    expect(html.match(/class="outfit-audit-class"/g)).toHaveLength(4);
    expect(html.match(/class="outfit-audit-outfit"/g)).toHaveLength(20);
    expect(html.match(/HÉROE · 120 × 120/g)).toHaveLength(20);
    expect(html.match(/FICHA · CUADRADO/g)).toHaveLength(20);
    expect(html.match(/TIENDA \/ COLECCIÓN · 4:5/g)).toHaveLength(20);
    expect(html).not.toContain('INVENTARIO EQUIPADO');
    expect(html.match(/HOY · 56 × 56 \+ FONDO/g)).toHaveLength(20);
    expect(html.match(/HÁBITOS · 58 × 58 \+ FONDO/g)).toHaveLength(20);
    expect(html.match(/class="hoy-hero outfit-audit-today-card"/g)).toHaveLength(20);
    expect(html.match(/class="habit-hero-card outfit-audit-habits-card"/g)).toHaveLength(20);
    expect(html.match(/outfit-audit-portrait-guide--eyes/g)).toHaveLength(40);
    expect(html.match(/5 contextos reales/g)).toHaveLength(4);
    expect(html).toContain('--audit-eye-line:52%');
    expect(html).toContain('--audit-eye-line:44%');
    expect(html).toContain('data-outfit-display');
    expect(html).toContain('--outfit-face-size:');
    expect(html).toContain('outfit-full-body--outfit-celestial-rhythm-master');
  });
});
