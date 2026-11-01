import { SUPPORT_TOPIC } from '../models/support-request.model';
import type { SupportRequestStore, SupportRequestSubmission } from '../interfaces/support-request-store.interface';
import {
  SupportChannelUnavailableError,
  SupportRequestThrottledError,
  SupportSenderRequiredError,
} from '../errors/support.errors';
import { SubmitSupportRequest, type SubmitSupportRequestCommand } from './submit-support-request.use-case';

const ACCOUNT = '0192f000-0000-7000-8000-000000000001';
const NOW = new Date('2026-10-30T12:00:00Z');

/** The store's request-tier half, recording what it was asked and answering a window of `admitted`. */
const storeAdmitting = (admitted = true) => {
  const submitted: SupportRequestSubmission[] = [];
  const store: Pick<SupportRequestStore, 'senderOf' | 'submit'> = {
    senderOf: ({ accountId, organizationId }) =>
      Promise.resolve(
        accountId === ACCOUNT
          ? { accountId, name: 'Ana Ceban', email: 'ana@lina.md', organizationName: organizationId ? 'Grupul Lina' : null }
          : null,
      ),
    submit: (submission) => {
      if (!admitted) return Promise.resolve(null);
      submitted.push(submission);
      return Promise.resolve({ reference: 'SR-000042' });
    },
  };
  return { store: store as SupportRequestStore, submitted };
};

const channelAt = (address: string | null) => ({ inForce: () => (address === null ? null : { address }) });

const command = (change: Partial<SubmitSupportRequestCommand> = {}): SubmitSupportRequestCommand => ({
  accountId: null,
  organizationId: null,
  visitor: { name: 'Ion Rusu', email: 'Ion@Rusu.md' },
  topic: SUPPORT_TOPIC.EXPORTS,
  question: 'Raportul nu se descarcă.',
  replyLocale: 'ro',
  ...change,
});

describe('SubmitSupportRequest (UC-182, FR-212; task 77)', () => {
  it('records a visitor’s request under the name and address they gave, its window keyed by the address', async () => {
    const { store, submitted } = storeAdmitting();
    const use = new SubmitSupportRequest(store, channelAt('ajutor@easyesg.md'), () => NOW);

    await expect(use.execute(command())).resolves.toEqual({ reference: 'SR-000042' });
    expect(submitted).toEqual([
      {
        throttleKey: 'support-request:address/ion@rusu.md',
        now: NOW,
        sender: { accountId: null, name: 'Ion Rusu', email: 'Ion@Rusu.md', organizationName: null },
        topic: SUPPORT_TOPIC.EXPORTS,
        question: 'Raportul nu se descarcă.',
        replyLocale: 'ro',
      },
    ]);
  });

  it('names a signed-in reader by the account and its organization, whatever the body says (UX-109)', async () => {
    const { store, submitted } = storeAdmitting();
    const use = new SubmitSupportRequest(store, channelAt('ajutor@easyesg.md'), () => NOW);

    await use.execute(command({ accountId: ACCOUNT, organizationId: 'org', visitor: { name: 'Someone else' } }));
    expect(submitted[0]).toMatchObject({
      throttleKey: `support-request:account/${ACCOUNT}`,
      sender: { accountId: ACCOUNT, name: 'Ana Ceban', email: 'ana@lina.md', organizationName: 'Grupul Lina' },
    });
  });

  it.each([[{}], [{ name: 'Ion Rusu' }], [{ email: 'ion@rusu.md' }], [{ name: '', email: 'ion@rusu.md' }]])(
    'refuses a visitor who gave %j',
    async (visitor) => {
      const { store, submitted } = storeAdmitting();
      const use = new SubmitSupportRequest(store, channelAt('ajutor@easyesg.md'), () => NOW);
      await expect(use.execute(command({ visitor }))).rejects.toThrow(SupportSenderRequiredError);
      expect(submitted).toEqual([]);
    },
  );

  it('refuses before recording anything when no support address is readable', async () => {
    const { store, submitted } = storeAdmitting();
    const use = new SubmitSupportRequest(store, channelAt(null), () => NOW);
    await expect(use.execute(command())).rejects.toThrow(SupportChannelUnavailableError);
    expect(submitted).toEqual([]);
  });

  it('refuses a request the sender’s window does not admit', async () => {
    const { store } = storeAdmitting(false);
    const use = new SubmitSupportRequest(store, channelAt('ajutor@easyesg.md'), () => NOW);
    await expect(use.execute(command())).rejects.toThrow(SupportRequestThrottledError);
  });
});
