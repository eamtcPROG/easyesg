import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { PROBE_SHAPE, switchLanding } from './switch-landing';

/**
 * UX-3's equivalent screen, address by address (task 83.2). The probe is part of each answer, because a
 * section whose landing is right and whose probe is missing sends a viewer to a screen it cannot open —
 * the failure the owner's decision exists to avoid.
 */
describe('switchLanding (UX-3)', () => {
  it('keeps the account’s own screen, in any locale form', () => {
    expect(switchLanding('/account/credentials')).toEqual({ href: '/account/credentials', probe: null });
    expect(switchLanding('/en/account/credentials')).toEqual({ href: '/account/credentials', probe: null });
  });

  it('lands home from home, asking nothing', () => {
    expect(switchLanding('/home')).toEqual({ href: ROUTES.HOME, probe: null });
  });

  it.each(['/reports', '/reports?filters=state,draft', '/reports/new', '/reports/42/B1'])(
    'lands %s on the reports screen, asking for its list',
    (from) => {
      expect(switchLanding(from)).toEqual({
        href: ROUTES.REPORTS,
        probe: { path: '/reports', shape: PROBE_SHAPE.LIST },
      });
    },
  );

  it.each(['/entities', '/entities/new', '/entities/7', '/entities/7/periods/9'])(
    'lands %s on the entities screen, asking for its list',
    (from) => {
      expect(switchLanding(from)).toEqual({
        href: ROUTES.ENTITIES,
        probe: { path: '/entities', shape: PROBE_SHAPE.LIST },
      });
    },
  );

  it('lands the organization profile on itself, asking for the profile', () => {
    expect(switchLanding('/organization')).toEqual({
      href: ROUTES.ORGANIZATION,
      probe: { path: '/organization', shape: PROBE_SHAPE.OBJECT },
    });
  });

  it('lands users and access on itself, asking for its seats', () => {
    expect(switchLanding('/organization/users')).toEqual({
      href: ROUTES.ORGANIZATION_USERS,
      probe: { path: '/access/seats', shape: PROBE_SHAPE.OBJECT },
    });
  });

  it.each(['/organization/somewhere', '/create-organization', '/choose-organization', '/billing', '/'])(
    'lands %s home',
    (from) => {
      expect(switchLanding(from)).toEqual({ href: ROUTES.HOME, probe: null });
    },
  );
});
