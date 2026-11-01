import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminCredentials } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout, EmptyState } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'use-intl';
import { ADMIN_CREDENTIALS_QUERY_KEY, issueAdminRecoveryCodes } from '../../../../queries/credentials';
import { CREDENTIALS_EVENT, CREDENTIALS_SECTION } from '../../../../tools/credentials-state';
import {
  RECOVERY_CODES_STANDING,
  recoveryCodesStandingOf,
} from '../../../../tools/recovery-codes-standing';
import { useCredentials, useSectionActivity } from '../../shared/credentials-context';

/**
 * A-19's recovery-code region at rest (task 151) — *empty, first use*; *attention, no codes left*; or
 * how many remain — each with the one action that issues a set, which asks for the current password
 * like every write here. Which arm applies is `tools/recovery-codes-standing.ts`'s, pure and specced.
 *
 * **One issue action per arm, never two.** Where no code is left the action lives inside the warning,
 * S-28's reason: §11.5 requires a Callout's third part, and a second copy beside it would ask the
 * reader which to trust.
 */
export function RecoveryCodesStanding({ credentials }: { readonly credentials: AdminCredentials }) {
  const t = useTranslations('realm.credentials.recoveryCodes');
  const format = useFormatter();
  const queryClient = useQueryClient();
  const { authorise, settle } = useCredentials();
  const { busy, inert } = useSectionActivity(CREDENTIALS_SECTION.RECOVERY_CODES);

  const issue = useMutation({
    mutationFn: issueAdminRecoveryCodes,
    onSuccess: (outcome) =>
      settle(outcome, (issued) => ({
        type: CREDENTIALS_EVENT.CODES_ISSUED,
        codes: issued.recoveryCodes,
      })),
    // The count and the date move with a new set. On the hook rather than per call: the codes on screen
    // replace this arm, and a per-call callback does not run once its component has unmounted.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ADMIN_CREDENTIALS_QUERY_KEY }),
  });

  const onIssue = () =>
    authorise(CREDENTIALS_SECTION.RECOVERY_CODES, (password) => issue.mutate({ password }));

  const standing = recoveryCodesStandingOf(credentials);

  switch (standing.kind) {
    case RECOVERY_CODES_STANDING.NONE_ISSUED:
      return (
        <EmptyState
          title={t('noneTitle')}
          action={
            <Button type="button" busy={busy} disabled={inert} onClick={onIssue}>
              {t('issue')}
            </Button>
          }
        >
          {t('none')}
        </EmptyState>
      );
    case RECOVERY_CODES_STANDING.EXHAUSTED:
      return (
        <Callout
          intent={CALLOUT_INTENT.ATTENTION}
          title={t('exhaustedTitle')}
          action={
            <Button type="button" busy={busy} disabled={inert} onClick={onIssue}>
              {t('reissue')}
            </Button>
          }
        >
          {t('exhaustedBody', { issuedAt: format.dateTime(standing.issuedAt, 'short') })}
        </Callout>
      );
    case RECOVERY_CODES_STANDING.REMAINING:
      return (
        <div className="flex flex-col gap-[var(--space-3)]">
          <p className="t-body">
            {t('remaining', {
              remaining: standing.remaining,
              issuedAt: format.dateTime(standing.issuedAt, 'short'),
            })}
          </p>
          <p className="t-caption">{t('reissueHelp')}</p>
          <div>
            <Button
              type="button"
              variant={BUTTON_VARIANT.SECONDARY}
              busy={busy}
              disabled={inert}
              onClick={onIssue}
            >
              {t('reissue')}
            </Button>
          </div>
        </div>
      );
  }
}
