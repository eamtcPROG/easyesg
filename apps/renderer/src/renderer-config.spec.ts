import { describe, expect, it } from 'vitest';
import { rendererConfig } from './renderer-config.js';

describe('rendererConfig', () => {
  it('runs at the platform’s values when nothing is set', () => {
    const config = rendererConfig({});
    expect(config).toMatchObject({ port: 3000, deadlineMs: 60_000, slots: 1 });
    expect(config.finisher.script).toMatch(/finisher\/finish_pdf\.py$/u);
    expect(config.finisher.profile).toBe('/usr/share/color/icc/sRGB.icc');
  });

  it('takes a setting from the environment, and refuses one that is not a positive whole number', () => {
    expect(rendererConfig({ RENDER_DEADLINE_MS: '5000' }).deadlineMs).toBe(5000);
    expect(() => rendererConfig({ RENDER_SLOTS: '0' })).toThrow('RENDER_SLOTS');
    expect(() => rendererConfig({ RENDERER_PORT: 'eighty' })).toThrow('RENDERER_PORT');
  });
});
