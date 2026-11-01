import { describe, expect, it } from 'vitest';
import { ADMIN_ROLE } from '@easyesg/contracts';
import { consoleHomeFor } from './console-home';

/**
 * A-01's exit (task 67.1), with the addresses as literals: they are routes the router serves and the
 * browser journey waits for, so a renamed path must fail here rather than pass with the constant.
 */
describe('consoleHomeFor (A-01’s exit)', () => {
  it('sends a Platform Administrator to the organization register', () => {
    expect(consoleHomeFor(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)).toBe('/organizations');
  });

  it('sends a Billing Operator to the reconciliation workspace', () => {
    expect(consoleHomeFor(ADMIN_ROLE.BILLING_OPERATOR)).toBe('/billing/reconciliation');
  });

  it('gives each privilege level a home of its own', () => {
    const homes = Object.values(ADMIN_ROLE).map(consoleHomeFor);
    expect(new Set(homes).size).toBe(Object.values(ADMIN_ROLE).length);
  });
});
