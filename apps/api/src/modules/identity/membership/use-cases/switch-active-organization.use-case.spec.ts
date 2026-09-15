import { MembershipNotHeldError } from '../errors/membership.errors';
import type { SessionOrganizationStore } from '../interfaces/session-organization-store.interface';
import { SwitchActiveOrganization } from './switch-active-organization.use-case';

/**
 * The use case's two outcomes and what it hands the store. Whether a membership is held is the
 * store's one statement, which `test/memberships.e2e-spec.ts` drives against the database — this
 * spec holds only what the use case adds to it.
 */
const storeAnswering = (pointed: boolean) => {
  const asked: Parameters<SessionOrganizationStore['pointSessionAt']>[0][] = [];
  const store: SessionOrganizationStore = {
    pointSessionAt: (input) => {
      asked.push(input);
      return Promise.resolve(pointed);
    },
  };
  return { store, asked };
};

const COMMAND = {
  accountId: 'account-1',
  sessionId: 'session-1',
  organizationId: 'org-b',
} as const;

describe('SwitchActiveOrganization (FR-12, UC-16 switch half)', () => {
  // Three adjacent strings: the swap this asserts against compiles, so only the values can show it.
  it('asks the store to point this session of this account at the organization chosen', async () => {
    const { store, asked } = storeAnswering(true);

    await new SwitchActiveOrganization(store).execute(COMMAND);

    expect(asked).toEqual([
      { sessionId: 'session-1', accountId: 'account-1', organizationId: 'org-b' },
    ]);
  });

  it('refuses when the store pointed nothing, as a not-found', async () => {
    const { store } = storeAnswering(false);

    const refusal = new SwitchActiveOrganization(store).execute(COMMAND);

    await expect(refusal).rejects.toBeInstanceOf(MembershipNotHeldError);
    await expect(refusal).rejects.toMatchObject({ status: 404, problemType: 'not-found' });
  });
});
