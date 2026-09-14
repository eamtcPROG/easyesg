import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import {
  CREDENTIALS_NOTICE,
  noticeSection,
  type CredentialsSection,
} from '../../../tools/credentials-state';
import { RefusalCallout } from '../../shared/refusal-callout';
import { useCredentials } from './credentials-context';

/**
 * **Admission test** (`shared-admission-test`): read by more than one region folder of A-19's
 * `components/` — every section renders one.
 *
 * What the last write said, **inside the section that made it** (task 151): a refused confirming code
 * is read where the code was typed, not above a record the reader has scrolled down. The state names
 * the place (`noticeSection`), so two outcomes at once stay unrepresentable while each is drawn where
 * it belongs.
 *
 * A success stands until the next write begins and carries no action of its own — its body says what
 * comes next, and the sections are where that happens. A refusal is `RefusalCallout`: the api's
 * `detail` is its *what now*.
 */
export function SectionNotice({ section }: { readonly section: CredentialsSection }) {
  const t = useTranslations('realm.credentials.notice');
  const tRealm = useTranslations('realm');
  const { notice } = useCredentials();

  if (notice === null || noticeSection(notice) !== section) return null;

  switch (notice.kind) {
    case CREDENTIALS_NOTICE.REFUSED:
      return (
        <RefusalCallout
          failure={notice.failure}
          title={t('refusedTitle')}
          fallback={tRealm('refusalFallback')}
        />
      );
    case CREDENTIALS_NOTICE.PASSWORD_CHANGED:
      return (
        <Callout intent={CALLOUT_INTENT.SUCCESS} title={t('passwordChangedTitle')} action={null}>
          {t('passwordChangedBody', { sessions: notice.otherSessionsTerminated })}
        </Callout>
      );
    case CREDENTIALS_NOTICE.FACTOR_REPLACED:
      return (
        <Callout intent={CALLOUT_INTENT.SUCCESS} title={t('factorReplacedTitle')} action={null}>
          {t('factorReplacedBody')}
        </Callout>
      );
    case CREDENTIALS_NOTICE.RECOVERED:
      // Above the sections rather than in one — `CredentialsArrivalNotice` draws it, and
      // `noticeSection` never places it here.
      return null;
  }
}
