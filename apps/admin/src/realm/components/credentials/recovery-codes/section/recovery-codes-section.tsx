import { useQuery } from '@tanstack/react-query';
import { RecordSection } from '@easyesg/ui';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import { adminCredentialsQuery } from '../../../../queries/credentials';
import { readCredentialsOutcome } from '../../../../tools/credentials-read';
import { CREDENTIALS_SECTION } from '../../../../tools/credentials-state';
import { REALM_READ } from '../../../../tools/realm-read';
import { SessionEnded } from '../../../shared/session-ended';
import { useCredentials } from '../../shared/credentials-context';
import { SectionNotice } from '../../shared/section-notice';
import { RecoveryCodesIssued } from '../issued/recovery-codes-issued';
import { RecoveryCodesStanding } from '../standing/recovery-codes-standing';
import { RecoveryCodesLoading } from '../states/recovery-codes-loading';
import { RecoveryCodesUnavailable } from '../states/recovery-codes-unavailable';

/**
 * A-19's recovery-code region (task 151). **The section reads and picks the arm** — and it is the only
 * region on the screen that reads, so its failure is the screen's *partial* state: the password and
 * the second factor above stay usable while this region offers a retry of its own.
 *
 * **Codes just issued take the region over, whatever the read says**, because they are shown once:
 * nothing a refetch answers may replace them before the reader acknowledges them.
 *
 * **A 401 is a session that ended**, and goes to A-01 with this address. **A 403 draws the retry**:
 * both privilege levels hold credentials, so a refusal of this read is not a boundary the screen has a
 * design for — `design_spec.md` §5.2 A-19 marks *error — permission* not applicable.
 */
export function RecoveryCodesSection() {
  const t = useTranslations('realm.credentials.recoveryCodes');
  const { codes } = useCredentials();
  const query = useQuery(adminCredentialsQuery());

  const retry = () => void query.refetch();

  const atRest = (): ReactNode => {
    if (query.data === undefined) {
      return query.isError ? <RecoveryCodesUnavailable onRetry={retry} /> : <RecoveryCodesLoading />;
    }
    const read = readCredentialsOutcome(query.data);
    switch (read.kind) {
      case REALM_READ.SIGNED_OUT:
        return <SessionEnded />;
      case REALM_READ.FORBIDDEN:
      case REALM_READ.UNAVAILABLE:
        return <RecoveryCodesUnavailable onRetry={retry} />;
      case REALM_READ.READY:
        return <RecoveryCodesStanding credentials={read.credentials} />;
    }
  };

  return (
    <RecordSection
      id={CREDENTIALS_SECTION.RECOVERY_CODES}
      heading={t('heading')}
      description={t('description')}
    >
      <SectionNotice section={CREDENTIALS_SECTION.RECOVERY_CODES} />
      {codes === null ? atRest() : <RecoveryCodesIssued codes={codes} />}
    </RecordSection>
  );
}
