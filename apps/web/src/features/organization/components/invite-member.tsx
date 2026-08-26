'use client';

import { Button, Callout, Panel } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { InvitedRole } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { inviteMemberAction } from '../actions';
import { INVITABLE_ROLES } from '../access';
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

/**
 * What the last attempt did — **one value, because the two cannot both be true.**
 *
 * They were `sent: string | null` and `failure: {…} | null`, written in pairs at both branches, and
 * the pair made an impossible state representable: sent AND failed. As a union nobody has to
 * remember to clear the other one, which is the whole of what those paired setters were doing
 * (root `CLAUDE.md`, "Values that change together"). A reducer would be ceremony here — there is
 * one transition and it has no name worth giving it.
 */
const INVITE_OUTCOME = { SENT: 'sent', FAILED: 'failed' } as const;

type InviteOutcome =
  | { readonly kind: typeof INVITE_OUTCOME.SENT; readonly email: string }
  | {
      readonly kind: typeof INVITE_OUTCOME.FAILED;
      readonly title: string;
      readonly body: string;
    };

export function InviteMember({ id }: { id: string }) {
  const t = useTranslations('organization.access.invite');
  const tRoles = useTranslations('organization.access.roles');
  const tRoleHelp = useTranslations('organization.access.roleDescriptions');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<InviteOutcome | null>(null);

  const { control, handleSubmit, reset } = useForm<InviteFields>({
    defaultValues: { email: '' },
  });

  const submit = handleSubmit((fields) => {
    startTransition(async () => {
      const result = await inviteMemberAction(fields);

      if (result.status === API_OUTCOME.Ok) {
        setOutcome({ kind: INVITE_OUTCOME.SENT, email: fields.email });
        reset();
        return;
      }
      setOutcome({
        kind: INVITE_OUTCOME.FAILED,
        // The API's own three-part text, as received — this screen keeps no second copy of
        // "they already have access" or "an invitation is outstanding".
        title:
          result.status === API_OUTCOME.Problem
            ? (result.problem.title ?? tCommon('unreachable.title'))
            : tCommon('unreachable.title'),
        body:
          result.status === API_OUTCOME.Problem
            ? (result.problem.detail ?? tCommon('unreachable.body'))
            : tCommon('unreachable.body'),
      });
    });
  });

  return (
    <Panel className={styles.invitePanel}>
      <h2 className="t-heading-3" id={id}>
        {t('heading')}
      </h2>
      <p className={`t-body ${styles.lede}`}>{t('intro')}</p>

      {outcome?.kind === INVITE_OUTCOME.SENT ? (
        <Callout
          intent="success"
          title={t('sent', { email: outcome.email })}
          action={t('sentAction')}
        >
          {t('sentBody')}
        </Callout>
      ) : null}
      {outcome?.kind === INVITE_OUTCOME.FAILED ? (
        <Callout intent="error" title={outcome.title} action={t('failedAction')}>
          {outcome.body}
        </Callout>
      ) : null}

      <form onSubmit={(event) => void submit(event)} noValidate className={styles.inviteForm}>
        <FormSummary control={control} title={t('heading')} />
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
