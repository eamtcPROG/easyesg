import { CALLOUT_INTENT, ExpiringCallout, useDismissible } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import {
  CREDENTIALS_NOTICE,
  noticeSection,
  type CredentialsSection,
} from '../../../tools/credentials-state';
import { ExpiringRefusal } from '../../shared/expiring-refusal';
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
 * A success carries no action of its own — its body says what comes next, and the sections are where
 * that happens. A refusal is `ExpiringRefusal`: the api's `detail` is its *what now*. **Either leaves
 * after a while, or when closed** (`design_spec.md` §8.1, amended 28 Sep 2026 by the project owner), and
 * otherwise when the next write begins. `useDismissible` rather than a reducer event, because this
 * notice stays in its section: the reducer's notice is the same object until the next write, and the
 * next write's is a new one that shows again.
 */
export function SectionNotice({ section }: { readonly section: CredentialsSection }) {
  const t = useTranslations('realm.credentials.notice');
  const tRealm = useTranslations('realm');
  const tChrome = useTranslations('chrome');
  const { notice } = useCredentials();
  const [shown, dismiss] = useDismissible(
    notice !== null && noticeSection(notice) === section ? notice : null,
  );

  if (shown === null) return null;

  switch (shown.kind) {
    case CREDENTIALS_NOTICE.REFUSED:
      return (
        <ExpiringRefusal
          failure={shown.failure}
          title={t('refusedTitle')}
          fallback={tRealm('refusalFallback')}
          onDismiss={dismiss}
        />
      );
    case CREDENTIALS_NOTICE.PASSWORD_CHANGED:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.SUCCESS}
          title={t('passwordChangedTitle')}
          action={null}
          dismissLabel={tChrome('closeMessage')}
          onDismiss={dismiss}
        >
          {t('passwordChangedBody', { sessions: shown.otherSessionsTerminated })}
        </ExpiringCallout>
      );
    case CREDENTIALS_NOTICE.FACTOR_REPLACED:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.SUCCESS}
          title={t('factorReplacedTitle')}
          action={null}
          dismissLabel={tChrome('closeMessage')}
          onDismiss={dismiss}
        >
          {t('factorReplacedBody')}
        </ExpiringCallout>
      );
    case CREDENTIALS_NOTICE.RECOVERED:
      // Above the sections rather than in one — `CredentialsArrivalNotice` draws it, and
      // `noticeSection` never places it here.
      return null;
  }
}
