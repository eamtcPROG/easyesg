import { describe, expect, it } from 'vitest';
import { heldAccountOtherThan } from './held-account';

/** S-02's switch-or-stay (task 160) is offered only for a different address than the one just confirmed. */
describe('heldAccountOtherThan (task 160)', () => {
  const held = { email: 'Ana.Popa@example.md', home: '/home' };

  it('is the held account when its address differs', () => {
    expect(heldAccountOtherThan({ held, email: 'ion.rusu@example.md' })).toBe(held);
  });

  it('is nothing when the held account is the one confirmed, compared as the api compares', () => {
    expect(heldAccountOtherThan({ held, email: 'ana.popa@EXAMPLE.md' })).toBeNull();
  });

  it('is nothing when this browser holds no session', () => {
    expect(heldAccountOtherThan({ held: null, email: 'ion.rusu@example.md' })).toBeNull();
  });
});
