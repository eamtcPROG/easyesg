import 'server-only';
import type { ReactNode } from 'react';
import { mayWrite, readActiveMembership } from '@/server/data/memberships';
import { readSession } from '@/server/session/session';
import { HistoryProvider } from './history-context';

/**
 * Where a screen offers S-12 (task 84.2): its region inside the history's provider **for an editor or the Organization
 * Administrator**, and as it is for anyone else (182/22; FR-54's actors). The one place the decision is made, on the
 * server where the membership is, so S-07, S-13 and S-15 wrap their region and decide nothing.
 *
 * **Presentation only, as S-07's read-only cause is**: the api's 403 on the trail is the authority, and this decides
 * only whether a way in is drawn. The membership is the global tier's `cache()`d read, so this asks nothing new.
 */
export async function HistoryScope({ children }: { readonly children: ReactNode }) {
  const [membership, session] = await Promise.all([readActiveMembership(), readSession()]);
  if (membership === null || session === null || !mayWrite(membership)) return <>{children}</>;

  return (
    <HistoryProvider organizationId={membership.organizationId} readerAccountId={session.account.id}>
      {children}
    </HistoryProvider>
  );
}
