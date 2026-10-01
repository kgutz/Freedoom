export function sceneMediaMarkup(name, alt, halloweenActive = false) {
  return `<img class="scene-poster" src="scenes/${name}-${halloweenActive ? 'halloween' : 'v2'}.webp" alt="${alt}" decoding="async">`;
}
