import type { Locale } from '@easyesg/i18n';

/**
 * What a request is about — the help centre prototype's six, which decide only who at support reads it first (task 77;
 * `architecture.md` §12.5.6's task-77 row (3)). Mirrored by `support_request_topic_known`, the database's own copy, and
 * by `@easyesg/contracts`' `SUPPORT_TOPIC`, held to the wire.
 */
export const SUPPORT_TOPIC = {
  /** A figure, or a question about a module. */
  REPORTING: 'reporting',
  /** A finding that will not clear. */
  FINDINGS: 'findings',
  EXPORTS: 'exports',
  /** Users and access. */
  ACCESS: 'access',
  /** Invoices and the plan. */
  BILLING: 'billing',
  OTHER: 'other',
} as const;

export type SupportTopic = (typeof SUPPORT_TOPIC)[keyof typeof SUPPORT_TOPIC];

const TOPICS: readonly string[] = Object.values(SUPPORT_TOPIC);

/** Whether an unvalidated value — a stored column — is one of the six. Beside the vocabulary it narrows to. */
export const isSupportTopic = (value: unknown): value is SupportTopic => typeof value === 'string' && TOPICS.includes(value);

/** Who sent a request: the signed-in account's name and address, or what a visitor gave. */
export interface SupportSender {
  readonly accountId: string | null;
  readonly name: string;
  readonly email: string;
  /** The active organization's name as it was called when the request was sent — a visitor has none. */
  readonly organizationName: string | null;
}

/** A request as the worker mails it. */
export interface SupportRequest {
  readonly id: string;
  readonly reference: string;
  readonly sender: SupportSender;
  readonly topic: SupportTopic;
  readonly question: string;
  readonly replyLocale: Locale;
}
