import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const help = html.match(/<!-- CENTRO DE AYUDA \(superpuesto\) -->([\s\S]*?)<!-- GRIMORIO \(detalle de habilidades\) -->/)?.[1] || '';

describe('contenido del Centro de ayuda', () => {
  it('cubre las funciones principales de la versión actual', () => {
    expect(help).toContain('<b>Cacería</b>');
    expect(help).toContain('<b>Mercado y pociones</b>');
    expect(help).toContain('¿Para qué sirven los Atributos?');
    expect(help).toContain('¿Cómo funcionan Fusión y Desfusión?');
    expect(help).toContain('un <b>60% de probabilidad</b>');
    expect(help).toContain('Fortuna');
    expect(help).toContain('Experiencia');
    expect(help).toContain('Vida, Maná y Sangre');
  });

  it('explica correctamente el cambio a Consumo controlado', () => {
    expect(help).toContain('se aplica desde hoy');
    expect(help).not.toContain('empezará la siguiente semana');
  });

  it('mantiene todas las respuestas indexadas para la búsqueda', () => {
    const itemCount = (help.match(/class="faq-item"/g) || []).length;
    const indexedCount = (help.match(/data-faq-item=/g) || []).length;
    expect(itemCount).toBeGreaterThanOrEqual(30);
    expect(indexedCount).toBe(itemCount);
  });
});

describe('versión visible de la actualización de Ayuda', () => {
  it('mantiene sincronizados HTML, aplicación y paquete', () => {
    const visibleVersion = packageJson.version.replace(/\.0$/, '');
    expect(main).toContain(`const APP_VERSION='${visibleVersion}'`);
    expect(html).toContain(`id="obVersion">v${visibleVersion}</div>`);
    expect(html).toContain(`id="settingsVersion">v${visibleVersion}</span>`);
  });
});
