import { describe, expect, it, vi } from 'vitest';
import { waitForImageAsset, waitForSplashAssets } from './splash-assets.js';

describe('recursos de la pantalla de entrada', () => {
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
