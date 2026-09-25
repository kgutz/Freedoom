import { describe, expect, it } from 'vitest';
import { readCloudConfig } from './cloud-config.js';

describe('readCloudConfig', () => {
  it('mantiene la nube desactivada sin configuración explícita', () => {
    expect(readCloudConfig({})).toEqual({ enabled: false });
  });

  it('acepta únicamente una configuración pública válida', () => {
    expect(readCloudConfig({ FREEDOM_CLOUD_CONFIG: {
      enabled: true,
      url: 'https://example.supabase.co/',
      publishableKey: 'sb_publishable_example',
    } })).toEqual({
      enabled: true,
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    });
  });
});

