import { describe, expect, it } from 'vitest';
import { ADMIN_PERMISSION, ADMIN_ROLE } from '@easyesg/contracts';
import { consoleHomeFor } from './console-home';

const EVERY_PERMISSION = Object.values(ADMIN_PERMISSION);

/**
 * A-01's exit (task 67.1), with the addresses as literals: they are routes the router serves and the
 * browser journey waits for, so a renamed path must fail here rather than pass with the constant.
 * Since task 67.13 a Platform Administrator lands on the first destination their roles open.
 */
describe('consoleHomeFor (A-01’s exit)', () => {
  it('sends a Platform Administrator who may read the register to it', () => {
    expect(consoleHomeFor({ role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, permissions: EVERY_PERMISSION })).toBe(
      '/organizations',
    );
  });

  it('sends one whose roles open no register to the first destination they do open (task 67.13)', () => {
    expect(
      consoleHomeFor({ role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, permissions: [ADMIN_PERMISSION.IDENTITY_PROVIDERS_MANAGE] }),
    ).toBe('/identity-providers');
  });

  it('sends a content author to A-03, the one destination their roles open (tasks 67.5, 67.13)', () => {
    expect(consoleHomeFor({ role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, permissions: [ADMIN_PERMISSION.CONTENT_EDIT] })).toBe(
      '/content',
    );
  });

  it('sends one whose roles open no destination of the section to their own credentials (task 67.13)', () => {
    expect(consoleHomeFor({ role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, permissions: [] })).toBe('/credentials');
  });

  it('sends a Billing Operator to the reconciliation workspace', () => {
    expect(consoleHomeFor({ role: ADMIN_ROLE.BILLING_OPERATOR, permissions: [] })).toBe('/billing/reconciliation');
  });

  it('gives each privilege level a home of its own', () => {
    const homes = Object.values(ADMIN_ROLE).map((role) => consoleHomeFor({ role, permissions: EVERY_PERMISSION }));
    expect(new Set(homes).size).toBe(Object.values(ADMIN_ROLE).length);
  });
});
