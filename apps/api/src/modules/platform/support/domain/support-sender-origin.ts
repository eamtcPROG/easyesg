import type { SupportSender } from '../models/support-request.model';

/**
 * Where a request came from, as the mail to support words it (task 77): a member writing for an organization, an
 * account acting for none, or a visitor. **A closed vocabulary rather than an empty name the template tests**, because
 * a message's ICU can choose by a value but cannot ask whether one is blank.
 */
export const SUPPORT_SENDER_ORIGIN = {
  ORGANIZATION: 'organization',
  ACCOUNT: 'account',
  VISITOR: 'visitor',
} as const;

export type SupportSenderOrigin = (typeof SUPPORT_SENDER_ORIGIN)[keyof typeof SUPPORT_SENDER_ORIGIN];

export const supportSenderOrigin = (sender: SupportSender): SupportSenderOrigin => {
  if (sender.accountId === null) return SUPPORT_SENDER_ORIGIN.VISITOR;
  return sender.organizationName === null ? SUPPORT_SENDER_ORIGIN.ACCOUNT : SUPPORT_SENDER_ORIGIN.ORGANIZATION;
};
