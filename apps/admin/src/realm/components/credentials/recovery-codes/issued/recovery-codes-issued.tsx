import { Button } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { useCredentials } from '../../shared/credentials-context';

/**
 * A-19's *showing codes* (task 151) — a set just issued, shown this once. **"Shown once" is said before
 * the list**, S-28's reason: a reader who has scrolled past the codes has no way back to them, so the
 * warning is useful only in advance. The list goes on the reader's acknowledgement and on nothing else.
 */
export function RecoveryCodesIssued({ codes }: { readonly codes: readonly string[] }) {
  const t = useTranslations('realm.credentials.recoveryCodes');
  const { acknowledgeCodes } = useCredentials();

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <p className="t-label">{t('issuedHeading')}</p>
      <p className="t-caption">{t('issuedHelp')}</p>
      <ul aria-label={t('issuedListLabel')} className="grid grid-cols-2 gap-[var(--space-2)]">
        {codes.map((code) => (
          // `translate="no"`: a translating browser would otherwise rewrite a code made of letters.
          <li key={code} className="t-code" translate="no">
            {code}
          </li>
        ))}
      </ul>
      <div>
        <Button type="button" onClick={acknowledgeCodes}>
          {t('issuedDone')}
        </Button>
      </div>
    </div>
  );
}
