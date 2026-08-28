'use client';

import { Button, Callout, Panel } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { InvitedRole } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice, successNotice } from '@/lib/notice';
import { inviteMemberAction } from '../actions';
import { INVITABLE_ROLES } from '../access';
import { NOTICE_REGION } from '../access-state';
import { useAccess } from './access-context';
import styles from './access.module.css';

/**
 * UC-60 — invite by email at an edit or view-only role.
 *
 * Organization Administrator is not offered, and that is FR-57 rather than an omission: a
 * promotion is UC-64, taken about someone the organization already knows, on the row that already
 * shows them. `INVITABLE_ROLES` is derived from the vocabulary so the two cannot disagree.
 *
 * **Both collisions are the API's to refuse** — an address that already has access, and one that
 * already holds a pending invitation — and each refusal names the action that resolves it
 * (§12.5.6). This renders that text as received rather than restating it: a second copy here would
 * be a second place for "resend it or revoke it" to be true, and the API's copy is the one that
 * knows which of the two happened.
 */
/**
 * What a *submitted* invitation holds. `role` is not optional and carries no empty member: "not yet
 * chosen" is an absence, and `useBoundField` already normalises an absent value to the empty string
 * — which is precisely what Radix reserves for "show the placeholder". So the unchosen state needs
 * no type of its own, and the `required` rule is what guarantees this one is set by the time the
 * action sees it.
 */
interface InviteFields {
  email: string;
  role: InvitedRole;
}

export function InviteMember({ id }: { id: string }) {
  const t = useTranslations('organization.access.invite');
  const tRoles = useTranslations('organization.access.roles');
  const tRoleHelp = useTranslations('organization.access.roleDescriptions');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  // What the last attempt did — **the screen's one notice, not this panel's own** (28 Aug 2026).
  //
  // It was a `useState` here, set only by this form's submit and cleared by nothing else. That is
  // the defect `access-state.ts`'s ACTION_STARTED branch was written for, described there in the
  // exact words this panel produces: a stale "the invitation has been sent" sitting above a
  // removal still in flight. The fix reached the list's notice and not this one, because this
  // component sat outside the provider — so the two surfaces could also show two settled outcomes
  // at once, which `users-access.spec.ts` had been tolerating with `getByRole('alert').first()`.
  //
  // It still renders here rather than at the list's head: its refusal points at "the list above",
  // a sentence only true below the list — see `NOTICE_REGION`.
  const { notice, starting, report } = useAccess();

  const { control, handleSubmit, reset } = useForm<InviteFields>({
    defaultValues: { email: '' },
  });

  const submit = handleSubmit((fields) => {
    // Clears whatever the screen was showing, the list's notice included — one outcome on screen
    // at a time, whichever region produced it.
    starting();
    startTransition(async () => {
      const result = await inviteMemberAction(fields);

      if (result.status === API_OUTCOME.Ok) {
        report({
          region: NOTICE_REGION.INVITE,
          ...successNotice({
            copy: { title: t('sent', { email: fields.email }), body: t('sentBody') },
            action: t('sentAction'),
          }),
        });
        reset();
        return;
      }
      report({
        region: NOTICE_REGION.INVITE,
        ...failureNotice({
          outcome: result,
          // The API's own three-part text, as received — this screen keeps no second copy of
          // "they already have access" or "an invitation is outstanding".
          unreachable: { title: tCommon('unreachable.title'), body: tCommon('unreachable.body') },
          // Non-null on purpose, and one of the few places that is right: "find the person in the
          // list above" is a step this screen owns and the API's `detail` cannot state, because it
          // points at something rendered beside this panel.
          action: t('failedAction'),
        }),
      });
    });
  });

  return (
    <Panel className={styles.invitePanel}>
      <h2 className="t-heading-3" id={id}>
        {t('heading')}
      </h2>
      <p className={`t-body ${styles.lede}`}>{t('intro')}</p>

      {notice?.region === NOTICE_REGION.INVITE ? (
        <Callout intent={notice.intent} title={notice.title} action={notice.action}>
          {notice.body}
        </Callout>
      ) : null}

      <form onSubmit={(event) => void submit(event)} noValidate className={styles.inviteForm}>
        <FormSummary control={control} title={t('summaryTitle')} />
        <FormTextField
          control={control}
          name="email"
          type="email"
          label={t('email')}
          autoComplete="email"
          rules={{ required: t('emailRequired') }}
        />
        <FormSelect
          control={control}
          name="role"
          label={t('role')}
          placeholder={t('rolePlaceholder')}
          options={INVITABLE_ROLES.map((role) => ({
            value: role,
            label: tRoles(role),
            description: tRoleHelp(role),
          }))}
          rules={{ required: t('roleRequired') }}
        />
        <Button type="submit" busy={pending}>
          {t('submit')}
        </Button>
      </form>
    </Panel>
  );
}
