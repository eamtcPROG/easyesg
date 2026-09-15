'use client';

import type { AccountMembership, MembershipRole } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT, Callout } from '@easyesg/ui';
import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { failureNotice, type Notice, type NoticeCopy } from '@/lib/notice';
import { chooseOrganizationAction } from '../actions/actions';
import styles from './choice.module.css';

/**
 * S-37's list, each organization's row the choice itself (task 83.3; `design_spec.md` S-37).
 *
 * **A Client Component for the pending state and the refusal, and for nothing else.** Choosing is a
 * Server Action that redirects when it succeeds, so the one outcome this component ever holds is a
 * failure: the organization no longer counts the reader among its members, or no answer arrived. It is
 * shown in the API's own words (NFR-79), and the list is read again, so an organization that has just
 * removed the reader is no longer offered.
 *
 * **Every row waits on any choice**, because a second choice sent while the first is on its way would race
 * it to the session, and the reader could not tell which one won.
 *
 * It takes the memberships as read, not a projection of them (`section-pass-what-was-read`); what it adds
 * is the words, which arrive resolved.
 */
export function OrganizationChoices({
  memberships,
  returnTo,
  labels,
}: {
  readonly memberships: readonly AccountMembership[];
  /** The address S-37 was reached with, for the action to judge — never followed here. */
  readonly returnTo?: string;
  readonly labels: {
    readonly list: string;
    readonly roles: Readonly<Record<MembershipRole, string>>;
    readonly unreachable: NoticeCopy;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<Notice | null>(null);

  const choose = (organizationId: string) => {
    setRefusal(null);
    startTransition(async () => {
      const failure = await chooseOrganizationAction({ organizationId, returnTo });
      // A success does not reach this line: Next hands a redirecting action's caller a rejected promise for
      // its `RedirectBoundary`, which remounts this screen away. The check is for the type alone — and it is
      // safe here only because S-37 unmounts on the way out, where the switch's provider does not (task 83.2).
      if (failure === undefined) return;
      setRefusal(failureNotice({ outcome: failure, unreachable: labels.unreachable }));
      router.refresh();
    });
  };

  return (
    <>
      {refusal === null ? null : (
        <Callout intent={refusal.intent} title={refusal.title} action={refusal.action}>
          {refusal.body}
        </Callout>
      )}
      <ul className={styles.choices} aria-label={labels.list}>
        {memberships.map((membership) => (
          <li key={membership.id}>
            <Button
              type="button"
              variant={BUTTON_VARIANT.SECONDARY}
              className={styles.choice}
              disabled={pending}
              onClick={() => choose(membership.organizationId)}
            >
              <span className={styles.name}>{membership.organizationName}</span>
              <span className={`t-caption ${styles.role}`}>{labels.roles[membership.role]}</span>
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
