import type { NotificationCategoryKey } from '@api/contracts/notification.port';

/**
 * What a followed unsubscribe link can do (task 52.2.2; FR-169; §12.5.6's task-52.2 row) — S-38's three arms, told
 * apart by value because a screen cannot branch on wording. Mirrored in `@easyesg/contracts` for the front end, held
 * to this copy by the generated enum.
 */
export const UNSUBSCRIBE_STANDING = {
  /** The category still reaches the person by email, and the link can switch it off. */
  AVAILABLE: 'available',
  /** Already switched off — from this link before, or from S-27. Pressing again changes nothing and is no error. */
  SWITCHED_OFF: 'switched_off',
  /**
   * The link cannot switch anything off: it was not signed by this platform, or its category may no longer be
   * switched off. One standing rather than two, because the reader's way out is the same — S-27 — and telling a
   * holder which of the two applies would describe the signature check to whoever is probing it.
   */
  UNUSABLE: 'unusable',
} as const;

export type UnsubscribeStanding = (typeof UNSUBSCRIBE_STANDING)[keyof typeof UNSUBSCRIBE_STANDING];

/**
 * S-38's read: the standing, and — wherever the link can be trusted to name them — the category it is about and whose
 * emails it stops, as `maskedAddress` names them (task 52's close), since the reader may not be the recipient.
 */
export type UnsubscribePreview =
  | {
      readonly standing: typeof UNSUBSCRIBE_STANDING.AVAILABLE | typeof UNSUBSCRIBE_STANDING.SWITCHED_OFF;
      readonly categoryKey: NotificationCategoryKey;
      readonly recipient: string;
    }
  | { readonly standing: typeof UNSUBSCRIBE_STANDING.UNUSABLE };
