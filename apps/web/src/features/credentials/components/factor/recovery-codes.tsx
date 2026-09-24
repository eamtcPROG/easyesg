'use client';

import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { recoveryCodesFile } from '../../tools/recovery-codes-file';
import { FACTOR_MESSAGES } from '../shared/credentials-messages';
import { useCredentials } from '../shared/credentials-context';
import styles from '../styles/credentials.module.css';
import { CopyButton } from './copy-button';

/**
 * The recovery codes, shown exactly once (UC-193) — the last step of turning the factor on and of issuing new codes.
 * **"We show these once" is said before them, not after**: a reader who has scrolled past them has no way back (P5).
 * The row stays open until they are put away, and no other trigger can close it meanwhile (`credentials-state.ts`).
 *
 * **Three ways to keep them** (task 169, the owner's review): copy them, download them as a text file, or write them
 * down from the screen. The file is built in the browser from what is already on it — the codes exist outside the
 * reader's keeping only here, so nothing is fetched and nothing is stored.
 */
export function RecoveryCodes({ codes }: { readonly codes: readonly string[] }) {
  const t = useTranslations(FACTOR_MESSAGES);
  const { dismiss } = useCredentials();

  const download = () => {
    const file = recoveryCodesFile({ heading: t('codesFileHeading'), note: t('codesFileNote'), codes });
    const url = URL.createObjectURL(new Blob([file], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = t('codesFileName');
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.form}>
      <p className="t-body">{t('codesHelp')}</p>
      <ul className={styles.codes}>
        {codes.map((code) => (
          <li key={code} className="t-code" translate="no">
            {code}
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <CopyButton value={codes.join('\n')} label={t('copyCodes')} />
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={download}>
          {t('downloadCodes')}
        </Button>
      </div>
      <div className={styles.actions}>
        <Button type="button" onClick={dismiss}>
          {t('codesDone')}
        </Button>
      </div>
    </div>
  );
}
