import { Logger } from '@nestjs/common';
import type { DeliverNoticeCommand } from '@api/contracts/notification-delivery.port';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import type { SupportRequestStore } from '../interfaces/support-request-store.interface';
import { SUPPORT_TOPIC, type SupportRequest } from '../models/support-request.model';
import { SupportRequestEmailHandler } from './support-request-email.handler';

const REQUEST: SupportRequest = {
  id: '0192f000-0000-7000-8000-000000000042',
  reference: 'SR-000042',
  sender: { accountId: 'account-1', name: 'Ana Ceban', email: 'ana@lina.md', organizationName: 'Grupul Lina' },
  topic: SUPPORT_TOPIC.REPORTING,
  question: 'Ce cifră introduc în B3?',
  replyLocale: 'ru',
};

const JOB = { jobId: 'support-request/0192f000', jobName: 'support.request_received' };
const PAYLOAD = { requestId: REQUEST.id, occurredAtMicros: 1_793_577_600_000_000 };

const handlerOver = (input: { readonly request: SupportRequest | null; readonly address: string | null }) => {
  const delivered: DeliverNoticeCommand[] = [];
  const store = { read: () => Promise.resolve(input.request) } as unknown as SupportRequestStore;
  const channel = { inForce: () => (input.address === null ? null : { address: input.address }) };
  const delivery = {
    deliver: (command: DeliverNoticeCommand) => {
      delivered.push(command);
      return Promise.resolve();
    },
  };
  return { handler: new SupportRequestEmailHandler(store, channel, delivery), delivered };
};

describe('SupportRequestEmailHandler (FR-212 behaviour 3; task 77)', () => {
  it('delivers the request to the support address in Romanian, its Reply-To the reader’s address', async () => {
    const { handler, delivered } = handlerOver({ request: REQUEST, address: 'ajutor@easyesg.md' });
    await handler.handle(PAYLOAD, JOB as never);

    expect(delivered).toEqual([
      expect.objectContaining({
        issuanceKey: JOB.jobId,
        categoryKey: NOTIFICATION_CATEGORY.SUPPORT_REQUEST,
        recipient: { address: 'ajutor@easyesg.md', locale: 'ro' },
        replyTo: 'ana@lina.md',
        params: {
          reference: 'SR-000042',
          senderName: 'Ana Ceban',
          senderEmail: 'ana@lina.md',
          senderOrigin: 'organization',
          organizationName: 'Grupul Lina',
          topic: 'reporting',
          replyLocale: 'ru',
          question: 'Ce cifră introduc în B3?',
        },
      }),
    ]);
  });

  it('fails the job, to be retried, while no support address is readable', async () => {
    const { handler, delivered } = handlerOver({ request: REQUEST, address: null });
    await expect(handler.handle(PAYLOAD, JOB as never)).rejects.toThrow('No support address is in force');
    expect(delivered).toEqual([]);
  });

  it('skips a request purged before its mail went', async () => {
    const warned = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { handler, delivered } = handlerOver({ request: null, address: 'ajutor@easyesg.md' });
    await handler.handle(PAYLOAD, JOB as never);
    expect(delivered).toEqual([]);
    expect(warned).toHaveBeenCalledTimes(1);
    warned.mockRestore();
  });
});
