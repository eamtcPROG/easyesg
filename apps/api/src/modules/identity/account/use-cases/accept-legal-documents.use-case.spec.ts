import { LEGAL_VERSIONS_IN_FORCE } from '@easyesg/i18n';
import { LegalVersionChangedError } from '../errors/account.errors';
import type { LegalAcceptanceStore } from '../interfaces/legal-acceptance-store.interface';
import type { AcceptedLegalVersions, NewLegalAcceptance } from '../models/legal-acceptance.model';
import { AcceptLegalDocuments } from './accept-legal-documents.use-case';
import { ReadLegalAcceptance } from './read-legal-acceptance.use-case';

const NOW = new Date('2026-10-23T09:00:00.000Z');

/** The store as the adapter behaves: the latest row per document is what an account stands on. */
const storeHolding = (accepted: AcceptedLegalVersions) => {
  const recorded: NewLegalAcceptance[] = [];
  const store: LegalAcceptanceStore = {
    acceptedVersions: () => Promise.resolve(accepted),
    record: (acceptance) => {
      recorded.push(acceptance);
      return Promise.resolve();
    },
  };
  return { store, recorded };
};

describe('AcceptLegalDocuments (task 195, S-43)', () => {
  it('records each document owed at the version in force, and nothing for one already accepted at it', async () => {
    const { store, recorded } = storeHolding({ terms: '0.9', privacy: LEGAL_VERSIONS_IN_FORCE.privacy });
    await new AcceptLegalDocuments(store, () => NOW).execute({
      accountId: 'account-1',
      legalVersions: LEGAL_VERSIONS_IN_FORCE,
    });
    expect(recorded).toEqual([
      { accountId: 'account-1', accepted: [{ document: 'terms', version: LEGAL_VERSIONS_IN_FORCE.terms }], at: NOW },
    ]);
  });

  it('records both for an account that accepted neither — a provider sign-up, an account older than the record', async () => {
    const { store, recorded } = storeHolding({});
    await new AcceptLegalDocuments(store, () => NOW).execute({
      accountId: 'account-1',
      legalVersions: LEGAL_VERSIONS_IN_FORCE,
    });
    expect(recorded[0]?.accepted.map((entry) => entry.document)).toEqual(['terms', 'privacy']);
  });

  it('refuses a page read before a release replaced a text, recording nothing', async () => {
    const { store, recorded } = storeHolding({});
    await expect(
      new AcceptLegalDocuments(store, () => NOW).execute({
        accountId: 'account-1',
        legalVersions: { ...LEGAL_VERSIONS_IN_FORCE, privacy: '0.9' },
      }),
    ).rejects.toBeInstanceOf(LegalVersionChangedError);
    expect(recorded).toEqual([]);
  });
});

describe('ReadLegalAcceptance (task 195, S-43)', () => {
  it('names each document owed with the version in force and the one last accepted', async () => {
    const { store } = storeHolding({ terms: '0.9' });
    await expect(new ReadLegalAcceptance(store).execute({ accountId: 'account-1' })).resolves.toEqual([
      { document: 'terms', version: LEGAL_VERSIONS_IN_FORCE.terms, acceptedVersion: '0.9' },
      { document: 'privacy', version: LEGAL_VERSIONS_IN_FORCE.privacy, acceptedVersion: null },
    ]);
  });

  it('answers nothing owed once the versions in force are accepted', async () => {
    const { store } = storeHolding(LEGAL_VERSIONS_IN_FORCE);
    await expect(new ReadLegalAcceptance(store).execute({ accountId: 'account-1' })).resolves.toEqual([]);
  });
});
