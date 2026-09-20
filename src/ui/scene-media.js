export function sceneMediaMarkup(name, alt) {
  return `<img class="scene-poster" src="scenes/${name}-v2.webp" alt="${alt}" decoding="async">
    <video class="scene-video" data-scene-video muted loop playsinline preload="none" poster="scenes/${name}-v2.webp" aria-hidden="true" tabindex="-1"><source src="scenes/${name}-v2.mp4" type="video/mp4"></video>`;
}

// Only visible scenes play. The still underneath also covers loading/autoplay failures.
export function installSceneMedia(document, window) {
  const root = document.getElementById('sheetInventory');
  if (!root) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const known = new Set();
  const sync = () => {
    for (const video of known) {
      if (!video.isConnected) { video.pause(); known.delete(video); }
    }
    for (const video of root.querySelectorAll('[data-scene-video]')) {
      if (!known.has(video)) {
        known.add(video);
        video.muted = true;
        video.addEventListener('playing', () => { video.dataset.ready = 'true'; });
        video.addEventListener('error', () => { video.dataset.ready = 'false'; });
      }
      const visible = root.classList.contains('show') && !video.closest('[hidden]') && video.getClientRects().length > 0;
      if (reduced.matches) video.dataset.ready = 'false';
      if (!visible || document.hidden || reduced.matches) video.pause();
      else if (video.paused) video.play()?.catch(() => { video.dataset.ready = 'false'; });
    }
  };
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => { frame = 0; sync(); });
  };
  new window.MutationObserver(schedule).observe(root, {childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  window.addEventListener('pagehide', () => known.forEach(video => video.pause()));
  window.addEventListener('pageshow', sync);
  sync();
}
