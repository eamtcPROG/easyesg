import { ADMIN_ROLE, isAdminRole } from './admin-session.model';

/**
 * The admin role narrowing, declared once beside `ADMIN_ROLE` (task 145). Four readers share it —
 * both cookie codecs, the store adapter and `admin:provision` — and one of them, the adapter, used to
 * answer an unknown role with Platform Administrator. So what this pins is the refusal: a value
 * outside the set is never mapped onto a member.
 *
 * Asserted with literals on purpose, per the root file's test exception: `'platform_administrator'`
 * is the wire and the `CHECK` constraint's value, and a renamed member must fail here.
 */
describe('isAdminRole', () => {
  it('pins the set it narrows to', () => {
    expect(Object.values(ADMIN_ROLE)).toEqual(['platform_administrator', 'billing_operator']);
  });

  it.each(['platform_administrator', 'billing_operator'])('admits %s', (value) => {
    expect(isAdminRole(value)).toBe(true);
  });

  it.each([
    'support',
    'Platform_Administrator',
    ' platform_administrator',
    '',
    null,
    undefined,
    42,
    { role: 'platform_administrator' },
  ])('refuses %p rather than mapping it to a member', (value) => {
    expect(isAdminRole(value)).toBe(false);
  });
});
