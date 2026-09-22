import type { NotificationCategoryKey } from '@api/contracts/notification.port';

/**
 * S-26's read model — a recipient's own notices in the active organization (task 50.1.2; UC-165, UC-167; FR-161;
 * §12.5.6's task-50.1 rows (8) … (11)).
 *
 * **One entry is one in-app delivery**, the recipient's, joined to its notice: the delivery carries when it reached
 * them and whether they have read it, the notice carries what it is about. An email delivery is evidence and never
 * an entry, and a notice dismissed or cancelled has left the centre. Whose entries these are is not a field of any
 * query — the database answers only the bound recipient's (BR-NOT-5).
 */

/** The read-state facet (row (11)), as the compact list format spells its values. */
export const NOTIFICATION_READ_STATE = {
  UNREAD: 'unread',
  READ: 'read',
} as const;

export type NotificationReadState = (typeof NOTIFICATION_READ_STATE)[keyof typeof NOTIFICATION_READ_STATE];

const READ_STATES: readonly string[] = Object.values(NOTIFICATION_READ_STATE);

/** Whether an unvalidated facet value is a read state — beside the vocabulary it narrows to. */
export const isNotificationReadState = (value: unknown): value is NotificationReadState =>
  typeof value === 'string' && READ_STATES.includes(value);

/** The facets the centre understands, as the compact list format spells their fields. */
export const NOTIFICATION_CENTRE_FILTER = {
  READ_STATE: 'read',
  CATEGORY: 'category',
} as const;

/**
 * The centre's one ordering: when each notice reached this recipient. Newest first unless asked otherwise — a
 * centre is opened to see what arrived — and named for what the reader sees rather than for the column it reads.
 */
export const NOTIFICATION_CENTRE_SORT = {
  RECEIVED: 'received',
} as const;

export interface NotificationCentreQuery {
  /** `null` is both read states. */
  readonly readState: NotificationReadState | null;
  /** Empty is every category. */
  readonly categories: readonly NotificationCategoryKey[];
  readonly newestFirst: boolean;
  readonly skip: number;
  readonly take: number;
}

/** One entry as stored: the notice's subject and content, and this recipient's delivery of it. */
export interface NotificationCentreEntry {
  readonly notificationId: string;
  readonly categoryKey: NotificationCategoryKey;
  /** FR-162's path in `apps/web`, without a locale — the web prefixes its own. */
  readonly deepLink: string;
  /** What the notice's wording interpolates. Never on the wire: the words are (row (10)). */
  readonly params: Record<string, unknown>;
  /** When this recipient's in-app delivery was written, which is when the notice reached them. */
  readonly receivedAt: Date;
  readonly readAt: Date | null;
}

export interface NotificationCentrePage {
  readonly entries: readonly NotificationCentreEntry[];
  /** Entries the facets admit — what pages are counted from. */
  readonly matched: number;
  /** Entries before the facets, which tells an empty page *nothing yet* from *nothing matches*. */
  readonly total: number;
}

/** An entry in words: its wording resolved in the request's language, each part absent where none is written. */
export interface NotificationCentreItem extends Omit<NotificationCentreEntry, 'params'> {
  readonly title: string | undefined;
  readonly body: string | undefined;
}

/** A page of the centre in words, with the page's counts as the store answered them. */
export interface NotificationCentreItemPage {
  readonly items: readonly NotificationCentreItem[];
  readonly matched: number;
  readonly total: number;
}
