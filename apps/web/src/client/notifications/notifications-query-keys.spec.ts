import { describe, expect, it } from 'vitest';
import { NOTICE_SHOW } from '@/features/notifications/shared/tools/notice-list-query';
import { NOTIFICATIONS_QUERY_SCOPE, panelQueryKey, unreadCountQueryKey } from './notifications-query-keys';

const FIRST = '0b8a1f3e-0000-4000-8000-000000000001';
const SECOND = '0b8a1f3e-0000-4000-8000-000000000002';

/** Whether a key sits under a prefix — TanStack Query's partial matching, which is what an invalidation by scope uses. */
const under = (key: readonly unknown[], prefix: readonly unknown[]) => prefix.every((part, index) => key[index] === part);

describe('the notification query keys', () => {
  it('give each organization its own count, so a switch never reads the one left', () => {
    expect(unreadCountQueryKey(FIRST)).not.toEqual(unreadCountQueryKey(SECOND));
  });

  it("give each organization's panel views their own lists, and each view its own", () => {
    expect(panelQueryKey({ organizationId: FIRST, show: NOTICE_SHOW.UNREAD })).not.toEqual(
      panelQueryKey({ organizationId: SECOND, show: NOTICE_SHOW.UNREAD }),
    );
    expect(panelQueryKey({ organizationId: FIRST, show: NOTICE_SHOW.UNREAD })).not.toEqual(
      panelQueryKey({ organizationId: FIRST, show: NOTICE_SHOW.ALL }),
    );
  });

  it('keep every key under the one scope a mark invalidates', () => {
    expect(under(unreadCountQueryKey(FIRST), NOTIFICATIONS_QUERY_SCOPE)).toBe(true);
    expect(under(panelQueryKey({ organizationId: SECOND, show: NOTICE_SHOW.ALL }), NOTIFICATIONS_QUERY_SCOPE)).toBe(true);
  });
});
