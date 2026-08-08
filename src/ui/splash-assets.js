export const SPLASH_MIN_VISIBLE_MS = 2000;
export const SPLASH_FADE_MS = 400;
export const SPLASH_ASSET_TIMEOUT_MS = 4000;

function timeoutResult(timeoutMs) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(false), timeoutMs);
  });
}

export async function waitForImageAsset(
  image,
  { timeoutMs = SPLASH_ASSET_TIMEOUT_MS } = {},
) {
  if (!image) return false;

  const loaded = image.complete
    ? image.naturalWidth > 0
    : await Promise.race([
        new Promise((resolve) => {
          const finish = (result) => {
            image.removeEventListener?.('load', onLoad);
            image.removeEventListener?.('error', onError);
            resolve(result);
          };
          const onLoad = () => finish(true);
          const onError = () => finish(false);
          image.addEventListener?.('load', onLoad, { once: true });
          image.addEventListener?.('error', onError, { once: true });
        }),
        timeoutResult(timeoutMs),
      ]);

  if (!loaded) return false;
  if (typeof image.decode !== 'function') return true;

  return Promise.race([
    image.decode().then(
      () => true,
      () => image.naturalWidth > 0,
    ),
    timeoutResult(timeoutMs),
  ]);
}

export function waitForSplashAssets(
  container,
  options,
) {
  if (!container) return Promise.resolve([]);
  const images = container.querySelectorAll(
    '.onboarding-scene, .load-logo, .ob-logo',
  );
  return Promise.all(
    Array.from(images, (image) => waitForImageAsset(image, options)),
  );
}
