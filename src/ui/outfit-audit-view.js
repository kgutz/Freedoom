import {
  OUTFIT_DEFINITIONS,
  heroFaceSource,
  heroSpriteSource,
  outfitDisplayStyle,
  outfitUsesTransparentPortrait,
} from '../data/outfit-data.js';
import { heroBackgroundSource } from '../data/frame-data.js';
import { heroVisualMarkup } from './hero-view.js';

const AUDIT_CLASSES = Object.freeze([
  Object.freeze({ id: 'knight', name: 'Caballero', eyeLine: 52 }),
  Object.freeze({ id: 'paladin', name: 'Paladín', eyeLine: 44 }),
  Object.freeze({ id: 'sorcerer', name: 'Hechicero', eyeLine: 47 }),
  Object.freeze({ id: 'druid', name: 'Druida', eyeLine: 43 }),
]);

function displayAttributes(classId, outfitId) {
  const style = outfitDisplayStyle(classId, outfitId);
  return style ? ` data-outfit-display style="${style}"` : '';
}

function sprite(classId, outfitId) {
  const outfitClass = outfitId === 'original'
    ? ''
    : ` sprite-svg--outfit-${outfitId} sprite-svg--${classId}`;
  return `<img class="sprite-svg${outfitClass}"${displayAttributes(classId, outfitId)} src="${heroSpriteSource(classId, 'happy', outfitId)}" alt="">`;
}

function sheetPreview(classId, outfitId) {
  return `<div class="character-hero-art outfit-audit-sheet-stage">
    <div class="sprite-box" aria-hidden="true">
      <img class="sprite-bg" src="${heroBackgroundSource('original', classId, 'hero')}" alt="">
      ${sprite(classId, outfitId)}
    </div>
    <span class="outfit-audit-guide outfit-audit-guide--head"></span>
    <span class="outfit-audit-guide outfit-audit-guide--feet"></span>
  </div>`;
}

function cardPreview(classId, outfit) {
  return `<div class="outfit-option outfit-audit-card-stage" aria-hidden="true">
    <span class="outfit-full-body outfit-full-body--${classId} outfit-full-body--outfit-${outfit.id}">
      <img${displayAttributes(classId, outfit.id)} src="${heroSpriteSource(classId, 'happy', outfit.id)}" alt="">
    </span>
    <span class="outfit-audit-guide outfit-audit-guide--head"></span>
    <span class="outfit-audit-guide outfit-audit-guide--feet"></span>
  </div>`;
}

function portraitPreview(classId, outfit, surfaceClass) {
  const transparentClass = outfitUsesTransparentPortrait(outfit.id)
    ? ' outfit-transparent-portrait'
    : '';
  return `<span class="${surfaceClass} outfit-id-${outfit.id}${transparentClass}" aria-hidden="true">
    <img${displayAttributes(classId, outfit.id)} src="${heroFaceSource(classId, outfit.id)}" alt="">
    <span class="outfit-audit-portrait-guide outfit-audit-portrait-guide--center"></span>
    <span class="outfit-audit-portrait-guide outfit-audit-portrait-guide--eyes"></span>
  </span>`;
}

function todayPreview(classId, outfit) {
  return `<div class="hoy-hero outfit-audit-today-card" aria-hidden="true">
    <img class="hoy-hero-bg" src="${heroBackgroundSource('original', classId, 'today')}" alt="">
    <div class="hoy-hero-top">
      <div class="hoy-hero-id">
        ${portraitPreview(classId, outfit, 'hoy-face')}
        <div class="hoy-hero-txt"><div class="hoy-hero-name">Héroe</div><div class="hoy-hero-cls">${classId}</div></div>
      </div>
    </div>
    <div class="hoy-hp"><div class="hoy-hp-lbl"><span>Salud</span><b>210 / 210</b></div><div class="habit-xp-track"><i style="width:72%"></i></div></div>
  </div>`;
}

function habitsPreview(classId, outfit) {
  return `<div class="habit-hero-card outfit-audit-habits-card" aria-hidden="true">
    <img class="habit-hero-bg" src="${heroBackgroundSource('original', classId, 'habits')}" alt="">
    ${portraitPreview(classId, outfit, 'habit-hero-sprite')}
    <div class="habit-hero-info"><div class="habit-hero-line"><span>Héroe · Nivel 50</span></div><div class="habit-xp-track"><i style="width:64%"></i></div><div class="habit-xp-label"><span>Progreso</span><b>64%</b></div></div>
  </div>`;
}

function outfitColumn(classId, outfit) {
  return `<article class="outfit-audit-outfit">
    <header><b>${outfit.name}</b><small>${outfit.id}</small></header>
    <div class="outfit-audit-surface outfit-audit-surface--hero">
      <span class="outfit-audit-surface-label">HÉROE · 120 × 120</span>
      <div class="hero-visual-column outfit-audit-hero-stage">
        ${heroVisualMarkup({ classId, outfitId: outfit.id, interactive: false })}
        <span class="outfit-audit-guide outfit-audit-guide--head"></span>
        <span class="outfit-audit-guide outfit-audit-guide--feet"></span>
      </div>
    </div>
    <div class="outfit-audit-surface outfit-audit-surface--sheet">
      <span class="outfit-audit-surface-label">FICHA · CUADRADO</span>
      ${sheetPreview(classId, outfit.id)}
    </div>
    <div class="outfit-audit-surface outfit-audit-surface--card">
      <span class="outfit-audit-surface-label">TIENDA / COLECCIÓN · 4:5</span>
      ${cardPreview(classId, outfit)}
    </div>
    <div class="outfit-audit-surface outfit-audit-surface--today">
      <span class="outfit-audit-surface-label">HOY · 56 × 56 + FONDO</span>
      ${todayPreview(classId, outfit)}
    </div>
    <div class="outfit-audit-surface outfit-audit-surface--habits">
      <span class="outfit-audit-surface-label">HÁBITOS · 58 × 58 + FONDO</span>
      ${habitsPreview(classId, outfit)}
    </div>
  </article>`;
}

export function outfitAuditMarkup() {
  const outfits = OUTFIT_DEFINITIONS.filter((outfit) => outfit.released !== false);
  const navigation = AUDIT_CLASSES.map((heroClass) => (
    `<a href="#audit-${heroClass.id}">${heroClass.name}</a>`
  )).join('');
  const sections = AUDIT_CLASSES.map((heroClass) => `<section class="outfit-audit-class" id="audit-${heroClass.id}" style="--audit-eye-line:${heroClass.eyeLine}%">
    <div class="outfit-audit-class-heading">
      <div><span>CONTROL DE ESCALA</span><h2>${heroClass.name}</h2></div>
      <small>${outfits.length} outfits · 5 contextos reales</small>
    </div>
    <div class="outfit-audit-grid">
      ${outfits.map((outfit) => outfitColumn(heroClass.id, outfit)).join('')}
    </div>
  </section>`).join('');

  return `<div class="outfit-audit-page">
    <header class="outfit-audit-topbar">
      <div><span>FREEDOM · HERRAMIENTA INTERNA</span><h1>Auditoría visual de outfits</h1><p>Compara cabeza, pies, márgenes y peso visual usando los contenedores reales de la app.</p></div>
      <a class="outfit-audit-close" href="?demoProfile=control&demoLevel=50&demoAllOutfits=1&demoQuiet=1&demoClass=paladin">VOLVER A LA APP</a>
    </header>
    <nav class="outfit-audit-nav" aria-label="Héroes">${navigation}</nav>
    <aside class="outfit-audit-legend"><i></i> Ojos del original de cada vocación <i></i> Pies / base <i class="outfit-audit-legend-center"></i> Centro del retrato</aside>
    ${sections}
  </div>`;
}

export function mountOutfitAudit(document) {
  const root = document.createElement('div');
  root.id = 'outfitAuditRoot';
  root.innerHTML = outfitAuditMarkup();
  document.body.append(root);
  document.documentElement.classList.add('outfit-audit-active');
  return root;
}
