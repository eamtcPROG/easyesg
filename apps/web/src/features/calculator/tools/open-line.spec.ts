import { describe, expect, it } from 'vitest';
import { openLine } from './open-line';

describe('openLine (task 39.2)', () => {
  it('opens the line the address names by its id', () => {
    expect(openLine('0193a3c8-1b2e-7c4d-9e8f-0a1b2c3d4e5f')).toBe('0193a3c8-1b2e-7c4d-9e8f-0a1b2c3d4e5f');
    expect(openLine(['0193a3c8-1b2e-7c4d-9e8f-0a1b2c3d4e5f', 'x'])).toBe('0193a3c8-1b2e-7c4d-9e8f-0a1b2c3d4e5f');
  });

  it('opens nothing for an address that names no line id', () => {
    expect(openLine(undefined)).toBeNull();
    expect(openLine('gas')).toBeNull();
    expect(openLine('<script>')).toBeNull();
  });
});
