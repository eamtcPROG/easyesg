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

export function InviteMember({ id }: { id: string }) {
  const t = useTranslations('organization.access.invite');
  const tRoles = useTranslations('organization.access.roles');
  const tRoleHelp = useTranslations('organization.access.roleDescriptions');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const [failure, setFailure] = useState<
    { readonly title: string; readonly body: string } | null
  >(null);

  const { control, handleSubmit, reset } = useForm<InviteFields>({
    defaultValues: { email: '' },
  });

  const submit = handleSubmit((fields) => {
    startTransition(async () => {
      const outcome = await inviteMemberAction(fields);

      if (outcome.status === API_OUTCOME.Ok) {
        setFailure(null);
        setSent(fields.email);
        reset();
        return;
      }
      setSent(null);
      setFailure(
        outcome.status === API_OUTCOME.Problem
          ? {
              title: outcome.problem.title ?? tCommon('unreachable.title'),
              body: outcome.problem.detail ?? tCommon('unreachable.body'),
            }
          : { title: tCommon('unreachable.title'), body: tCommon('unreachable.body') },
      );
    });
  });

  return (
    <Panel className={styles.invitePanel}>
      <h2 className="t-heading-3" id={id}>
        {t('heading')}
      </h2>
      <p className={`t-body ${styles.lede}`}>{t('intro')}</p>

      {sent ? (
        <Callout intent="success" title={t('sent', { email: sent })} action={t('sentAction')}>
          {t('sentBody')}
        </Callout>
      ) : null}
      {failure ? (
        <Callout intent="error" title={failure.title} action={t('failedAction')}>
          {failure.body}
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
