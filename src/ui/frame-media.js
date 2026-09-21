import { FRAME_DEFINITIONS } from '../data/frame-data.js';

export function frameVideoForPoster(source = '') {
  if (typeof source !== 'string' || !source) return null;
  for (const frame of FRAME_DEFINITIONS) {
    if (frame.video && source.endsWith(frame.image)) return frame.video;
    if (frame.wideVideo && source.endsWith(frame.wideImage)) return frame.wideVideo;
  }
  return null;
}

// Animate only the character sheet. Every other surface keeps its static WebP.
export function installFrameMedia(document, window) {
  const selector = '#characterSheetBody img.sprite-bg';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const entries = new Map();
  const visible = new Set();
  let frame = 0;
  const update = (image, entry) => {
    const canPlay = !reduced.matches && !document.hidden && visible.has(image)
      && image.isConnected && !image.closest('[hidden]') && image.getClientRects().length > 0;
    if (!canPlay) {
      entry.video.pause();
      if (reduced.matches) entry.video.dataset.ready = 'false';
      return;
    }
    if (!entry.video.getAttribute('src')) entry.video.src = entry.source;
    if (entry.video.paused) entry.video.play()?.catch(() => { entry.video.dataset.ready = 'false'; });
  };
  const intersection = new window.IntersectionObserver(records => {
    for (const record of records) {
      if (record.isIntersecting) visible.add(record.target);
      else visible.delete(record.target);
      const entry = entries.get(record.target);
      if (entry) update(record.target, entry);
    }
  });
  const sync = () => {
    frame = 0;
    for (const [image, entry] of entries) {
      if (!image.isConnected || !image.matches(selector) || frameVideoForPoster(image.getAttribute('src')) !== entry.source) {
        entry.video.pause();
        entry.video.removeAttribute('src');
        entry.video.load();
        entry.video.remove();
        intersection.unobserve(image);
        visible.delete(image);
        entries.delete(image);
      }
    }
    for (const image of document.querySelectorAll(selector)) {
      const source = frameVideoForPoster(image.getAttribute('src'));
      if (!source) continue;
      if (!entries.has(image)) {
        const video = document.createElement('video');
        video.className = `${image.className} frame-video`;
        video.muted = true;
        video.defaultMuted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'none';
        video.poster = image.getAttribute('src');
        video.setAttribute('aria-hidden', 'true');
        video.tabIndex = -1;
        video.addEventListener('playing', () => { video.dataset.ready = 'true'; });
        video.addEventListener('error', () => { video.dataset.ready = 'false'; });
        image.after(video);
        entries.set(image, {video, source});
        intersection.observe(image);
      }
      update(image, entries.get(image));
    }
  };
  const schedule = () => { if (!frame) frame = window.requestAnimationFrame(sync); };
  const observer = new window.MutationObserver(schedule);
  observer.observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['src','class','hidden']});
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', schedule);
  const pauseAll = () => entries.forEach(entry => entry.video.pause());
  window.addEventListener('pagehide', pauseAll);
  window.addEventListener('pageshow', schedule);
  sync();
  return () => {
    observer.disconnect(); intersection.disconnect(); pauseAll();
    window.cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', schedule);
    reduced.removeEventListener('change', schedule);
    window.removeEventListener('pagehide', pauseAll);
    window.removeEventListener('pageshow', schedule);
    entries.forEach(entry => entry.video.remove()); entries.clear();
  };
}
