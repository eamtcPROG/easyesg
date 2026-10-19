import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveExport } from './save-export';

describe('saveExport (S-06’s row ⋯)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('presses a download link at the file’s pass-through address, never fetching it', () => {
    const pressed: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      pressed.push(this);
    });
    const fetched = vi.spyOn(globalThis, 'fetch');

    saveExport('x2');

    expect(pressed).toHaveLength(1);
    expect(pressed[0].getAttribute('href')).toBe('/api/v1/exports/x2/file');
    expect(pressed[0].hasAttribute('download')).toBe(true);
    expect(fetched).not.toHaveBeenCalled();
  });
});
