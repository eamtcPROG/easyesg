import { useQuery } from '@tanstack/react-query';
import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { adminCredentialsQuery } from '../../../queries/credentials';
import { readCredentialsOutcome } from '../../../tools/credentials-read';
import { CREDENTIALS_NOTICE } from '../../../tools/credentials-state';
import { REALM_READ } from '../../../tools/realm-read';
import { useCredentials } from '../shared/credentials-context';

/**
 * A-19's *arrival after a recovery sign-in* (task 151) — above the sections, because it speaks about
 * two of them: how many codes are left, and that a lost authenticator is set up again here.
 *
 * **The count is this screen's own read** — the same query the recovery-code region makes, so one
 * request serves both — rather than a number A-01 wrote into the address. While that read has no
 * answer, the sentence stands without it. **`action={null}`**: the next steps are the sections below,
 * which the body names, and the notice goes when the first write begins.
 */
export function CredentialsArrivalNotice() {
  const t = useTranslations('realm.credentials.arrival');
  const { notice } = useCredentials();
  const query = useQuery(adminCredentialsQuery());

  if (notice?.kind !== CREDENTIALS_NOTICE.RECOVERED) return null;

  const read = query.data === undefined ? null : readCredentialsOutcome(query.data);
  const remaining = read?.kind === REALM_READ.READY ? read.credentials.recoveryCodesRemaining : null;

  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {remaining === null ? t('bodyUncounted') : t('body', { remaining })}
    </Callout>
  );
}
