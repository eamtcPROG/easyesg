import { COOKIE_CHOICE_KEPT_MONTHS, COOKIE_POLICY_VERSION_IN_FORCE } from '@easyesg/i18n';
import { CookiePolicyVersionChangedError } from '../errors/legal.errors';
import type { CookieChoiceStore } from '../interfaces/cookie-choice-store.interface';
import { PurgeCookieChoices } from './purge-cookie-choices.use-case';
import { RecordCookieChoice } from './record-cookie-choice.use-case';

/** Remembers what it was asked, so a case can say what reached the database and what never did. */
const recordingStore = () => {
  const recorded: Parameters<CookieChoiceStore['record']>[0][] = [];
  const purged: Parameters<CookieChoiceStore['purgeOlderThan']>[0][] = [];
  const store: CookieChoiceStore = {
    record: (input) => {
      recorded.push(input);
      return Promise.resolve({ id: 'choice-1', policyVersion: input.policyVersion, chosenAt: new Date(0) });
    },
    purgeOlderThan: (input) => {
      purged.push(input);
      return Promise.resolve(3);
    },
  };
  return { store, recorded, purged };
};

describe('RecordCookieChoice (task 223)', () => {
  it('records an answer to the version in force, with the account that gave it', async () => {
    const { store, recorded } = recordingStore();
    await new RecordCookieChoice(store).execute({ policyVersion: COOKIE_POLICY_VERSION_IN_FORCE, accountId: 'account-1' });
    expect(recorded).toEqual([{ policyVersion: COOKIE_POLICY_VERSION_IN_FORCE, accountId: 'account-1' }]);
  });

  it('records a visitor’s answer with no account', async () => {
    const { store, recorded } = recordingStore();
    await new RecordCookieChoice(store).execute({ policyVersion: COOKIE_POLICY_VERSION_IN_FORCE, accountId: null });
    expect(recorded).toEqual([{ policyVersion: COOKIE_POLICY_VERSION_IN_FORCE, accountId: null }]);
  });

  it('refuses an answer to a version that is not in force, and records nothing', async () => {
    const { store, recorded } = recordingStore();
    await expect(
      new RecordCookieChoice(store).execute({ policyVersion: `${COOKIE_POLICY_VERSION_IN_FORCE}-replaced`, accountId: null }),
    ).rejects.toBeInstanceOf(CookiePolicyVersionChangedError);
    expect(recorded).toEqual([]);
  });
});

describe('PurgeCookieChoices (task 223)', () => {
  it('deletes what is older than the months an answer is kept, counted from the slot’s moment', async () => {
    const { store, purged } = recordingStore();
    const asOf = new Date('2026-10-24T00:00:00Z');
    await expect(new PurgeCookieChoices(store).execute({ asOf })).resolves.toBe(3);
    expect(purged).toEqual([{ asOf, months: COOKIE_CHOICE_KEPT_MONTHS }]);
  });
});
