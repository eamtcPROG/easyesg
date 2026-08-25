import { MEMBERSHIP_ROLE } from '../models/membership.model';
import { wouldLeaveNoAdministrator } from './last-administrator';

const { ORGANIZATION_ADMINISTRATOR, EDITOR, VIEWER } = MEMBERSHIP_ROLE;

describe('wouldLeaveNoAdministrator (FR-60)', () => {
  it('refuses demoting the sole administrator — UC-62 reaching the lockout', () => {
    expect(
      wouldLeaveNoAdministrator({
        subjectRole: ORGANIZATION_ADMINISTRATOR,
        resultingRole: EDITOR,
        activeAdministrators: 1,
      }),
    ).toBe(true);
  });

  it('refuses removing the sole administrator — UC-63 reaching the same lockout', () => {
    expect(
      wouldLeaveNoAdministrator({
        subjectRole: ORGANIZATION_ADMINISTRATOR,
        resultingRole: null,
        activeAdministrators: 1,
      }),
    ).toBe(true);
  });

  it('permits it once a second administrator exists, which is what UC-64 is for', () => {
    expect(
      wouldLeaveNoAdministrator({
        subjectRole: ORGANIZATION_ADMINISTRATOR,
        resultingRole: null,
        activeAdministrators: 2,
      }),
    ).toBe(false);
  });

  // The rule is about the organization keeping an administrator, not about administrators being
  // unchangeable. Promotion and lateral moves are untouched.
  it('permits promoting the sole administrator’s colleague', () => {
    expect(
      wouldLeaveNoAdministrator({
        subjectRole: VIEWER,
        resultingRole: ORGANIZATION_ADMINISTRATOR,
        activeAdministrators: 1,
      }),
    ).toBe(false);
  });

  it('permits removing anyone who is not an administrator, however few there are', () => {
    expect(
      wouldLeaveNoAdministrator({
        subjectRole: EDITOR,
        resultingRole: null,
        activeAdministrators: 1,
      }),
    ).toBe(false);
  });

  it('permits an administrator being re-set to administrator, which changes nothing', () => {
    expect(
      wouldLeaveNoAdministrator({
        subjectRole: ORGANIZATION_ADMINISTRATOR,
        resultingRole: ORGANIZATION_ADMINISTRATOR,
        activeAdministrators: 1,
      }),
    ).toBe(false);
  });

  // Unreachable through the API, and asserted for that reason: a rule that only refuses `=== 1`
  // would permit the one state that actually needs intervention.
  it('refuses when the count has somehow already reached zero', () => {
    expect(
      wouldLeaveNoAdministrator({
        subjectRole: ORGANIZATION_ADMINISTRATOR,
        resultingRole: VIEWER,
        activeAdministrators: 0,
      }),
    ).toBe(true);
  });
});
