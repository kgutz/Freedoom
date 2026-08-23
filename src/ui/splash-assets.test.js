import { describe, expect, it, vi } from 'vitest';
import {
  SPLASH_ASSET_TIMEOUT_MS,
  SPLASH_FADE_MS,
  SPLASH_MIN_VISIBLE_MS,
  waitForImageAsset,
  waitForSplashAssets,
} from './splash-assets.js';

describe('recursos de la pantalla de entrada', () => {
  it('mantiene una entrada breve y limita la espera de imágenes', () => {
    expect(SPLASH_MIN_VISIBLE_MS).toBe(1_200);
    expect(SPLASH_FADE_MS).toBe(300);
    expect(SPLASH_ASSET_TIMEOUT_MS).toBe(2_000);
  });

  it('espera a que una imagen cargada termine de decodificarse', async () => {
    const decode = vi.fn().mockResolvedValue(undefined);
    const image = { complete: true, naturalWidth: 320, decode };

    await expect(waitForImageAsset(image)).resolves.toBe(true);
    expect(decode).toHaveBeenCalledOnce();
  });

  it('espera tanto el pueblo como el logo', async () => {
    const images = [
      { complete: true, naturalWidth: 1080, decode: vi.fn().mockResolvedValue() },
      { complete: true, naturalWidth: 320, decode: vi.fn().mockResolvedValue() },
    ];
    const container = { querySelectorAll: vi.fn().mockReturnValue(images) };

    await expect(waitForSplashAssets(container)).resolves.toEqual([true, true]);
    expect(container.querySelectorAll).toHaveBeenCalledOnce();
  });
});
