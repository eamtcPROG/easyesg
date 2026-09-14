import { describe, expect, it } from 'vitest';
import { realmPowersOf } from './realm-powers';

const holdings = (role: 'platform_administrator' | 'billing_operator') =>
  Object.fromEntries(realmPowersOf(role).map(({ power, holding }) => [power, holding]));

describe('what a realm may do (task 67.4, actors.md §5)', () => {
  it('gives the platform realm content, publication, support and accounts — and no billing power', () => {
    expect(holdings('platform_administrator')).toEqual({
      content: 'held',
      publication: 'held',
      support: 'held',
      accounts: 'held',
      plans: 'not_held',
      invoices: 'not_held',
      tenantData: 'nobody',
    });
  });

  it('gives the billing realm plans and invoices — and no platform power', () => {
    expect(holdings('billing_operator')).toEqual({
      content: 'not_held',
      publication: 'not_held',
      support: 'not_held',
      accounts: 'not_held',
      plans: 'held',
      invoices: 'held',
      tenantData: 'nobody',
    });
  });
});
