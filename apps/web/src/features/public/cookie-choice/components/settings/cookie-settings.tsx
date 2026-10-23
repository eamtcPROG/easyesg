'use client';

import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout, Dialog, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { COOKIE_CHOICE_MESSAGES } from '../shared/cookie-choice-messages';
import styles from './cookie-settings.module.css';

/**
 * S-31's settings (task 223; `design_spec.md` S-31, OQ-27) — the artboard's *preferences panel*, in the inventory's
 * dialogue: **one category, *Necessary*, always on**, naming the cookies it holds, and the statement that nothing else
 * is set. *Save* records the same answer the banner's *I understand* does; closing leaves the reader unanswered.
 *
 * **No switch**, where the artboard drew one beside each category: the one category cannot be switched, and a control
 * that cannot move is a control a reader tries anyway. *Always on* says what a stuck switch would have.
 */
export function CookieSettings({
  open,
  saving,
  failed,
  necessaryCookies,
  onSave,
  onClose,
}: {
  readonly open: boolean;
  readonly saving: boolean;
  readonly failed: boolean;
  readonly necessaryCookies: readonly string[];
  readonly onSave: () => Promise<void>;
  readonly onClose: () => void;
}) {
  const t = useTranslations(COOKIE_CHOICE_MESSAGES);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('settings.title')}
      description={t('settings.description')}
      closeLabel={t('settings.close')}
      footer={
        <>
          <Button variant={BUTTON_VARIANT.SECONDARY} disabled={saving} onClick={onClose}>
            {t('settings.cancel')}
          </Button>
          <Button variant={BUTTON_VARIANT.PRIMARY} busy={saving} onClick={() => void onSave()}>
            {t('settings.save')}
          </Button>
        </>
      }
    >
      <div className={styles.category}>
        <div className={styles.what}>
          <h3 className="t-body-strong">{t('settings.necessary.title')}</h3>
          <p className={styles.muted}>{t('settings.necessary.body')}</p>
          <ul className={styles.names} aria-label={t('settings.necessary.names')}>
            {necessaryCookies.map((name) => (
              <li key={name}>
                <code className="t-code">{name}</code>
              </li>
            ))}
          </ul>
        </div>
        <p className={`t-label ${styles.always}`}>{t('settings.necessary.always')}</p>
      </div>
      <p className={styles.muted}>
        {t.rich('settings.nothingElse', {
          policy: (chunks) => (
            <TextLink asChild>
              <Link href={ROUTES.LEGAL_COOKIES}>{chunks}</Link>
            </TextLink>
          ),
        })}
      </p>
      {failed ? (
        <Callout intent={CALLOUT_INTENT.ERROR} title={t('failed.title')} action={null}>
          {t('failed.body')}
        </Callout>
      ) : null}
    </Dialog>
  );
}
