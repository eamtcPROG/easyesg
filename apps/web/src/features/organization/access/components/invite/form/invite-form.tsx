'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useId, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { InvitedRole } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice, successNotice } from '@/lib/notice';
import { inviteMemberAction } from '../../../actions/actions';
import { INVITABLE_ROLES } from '../../../tools/access';
import { NOTICE_REGION } from '../../../tools/access-state';
import { useAccess } from '../../shared/access-context';
import { ACCESS_MESSAGES } from '../../shared/access-messages';
import { InviteDialog } from '../shared/invite-dialog';
import styles from '../../styles/access.module.css';

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
 * UC-60 — invite by email at an edit or view-only role.
 *
 * **Its own file since task 142**, which made the invitation choose its arm — this form, `SeatsFull`
 * or `InvitationsPaused` — and a file holding both the choice and one arm's form is two ideas
 * (`file-one-idea`). **In a dialogue since 28 Sep 2026**, and it frames itself: its submit stands in
 * the dialogue's closing row, as the artboard draws *Cancel* and *Send invitation*, and belongs to the
 * form by its `form` attribute — so it is still the button implicit submission from the address presses.
 *
 * **A sent invitation closes the dialogue and is reported at the list's head**, where its row now is;
 * a refusal stays in the dialogue, above the form it refused. The section keys this form on the
 * dialogue being open, so every opening starts from empty fields rather than the last attempt's.
 *
 * Organization Administrator is not offered, and that is FR-57 rather than an omission: a
 * promotion is UC-64, taken about someone the organization already knows, on the row that already
 * shows them. `INVITABLE_ROLES` is derived from the vocabulary so the two cannot disagree.
 *
 * **Every refusal is the API's** — an address that already has access, one that already holds a
 * pending invitation, and since task 142 an organization with no seat left — and each names the
 * action that resolves it (§12.5.6). This renders that text as received rather than restating it:
 * a second copy here would be a second place for "resend it or revoke it" to be true, and the API's
 * copy is the one that knows which happened. The panel not offering this form at the ceiling does
 * not make the ceiling this screen's: another tab can take the last seat between render and press.
 */
export function InviteForm() {
  const t = useTranslations(`${ACCESS_MESSAGES}.invite`);
  const tRoles = useTranslations(`${ACCESS_MESSAGES}.roles`);
  const tRoleHelp = useTranslations(`${ACCESS_MESSAGES}.roleDescriptions`);
  const tCommon = useTranslations('identity');
  // The form-level error summary's heading — `forms`, because it says what happened to a
  // FORM and no screen owns it. See `factor-form.tsx` for the one that is not shared.
  const tForms = useTranslations('forms');
  const [pending, startTransition] = useTransition();
  const formId = useId();
  // The screen's one notice, written here and rendered by the region it belongs to — see
  // `NOTICE_REGION` for why it is not this form's own state.
  const { starting, report, closeInvite } = useAccess();

  const { control, handleSubmit } = useForm<InviteFields>({
    defaultValues: { email: '' },
  });

  const submit = handleSubmit((fields) => {
    // Clears whatever the screen was showing, the list's notice included — one outcome on screen
    // at a time, whichever region produced it.
    starting();
    startTransition(async () => {
      const result = await inviteMemberAction(fields);

      if (result.status === API_OUTCOME.Ok) {
        // Reported first, then closed: the dialogue's closing clears only a notice of its own region,
        // so the success survives it and stands above the row it added.
        report({
          region: NOTICE_REGION.LIST,
          ...successNotice({
            copy: { title: t('sent', { email: fields.email }), body: t('sentBody') },
            action: t('sentAction'),
          }),
        });
        closeInvite();
        return;
      }
      report({
        region: NOTICE_REGION.INVITE,
        ...failureNotice({
          outcome: result,
          // The API's own three-part text, as received — this screen keeps no second copy of
          // "they already have access" or "an invitation is outstanding".
          unreachable: { title: tCommon('unreachable.title'), body: tCommon('unreachable.body') },
          // Non-null on purpose, and one of the few places that is right: "close this and find the
          // person in the list" is a step this screen owns and the API's `detail` cannot state,
          // because it points at the list this dialogue covers.
          action: t('failedAction'),
        }),
      });
    });
  });

  return (
    <InviteDialog
      footer={
        <>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={closeInvite}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} busy={pending}>
            {t('submit')}
          </Button>
        </>
      }
    >
      <p className={`t-body ${styles.lede}`}>{t('intro')}</p>
      <form
        id={formId}
        method="post"
        onSubmit={(event) => void submit(event)}
        noValidate
        className={styles.inviteForm}
      >
        <FormSummary control={control} title={tForms('summaryTitle')} />
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
      </form>
    </InviteDialog>
  );
}
