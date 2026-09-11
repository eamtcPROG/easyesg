'use client';

import { BUTTON_VARIANT, Button, ProviderButton } from '@easyesg/ui';
import { SOCIAL_PROVIDER, type SocialProvider } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { providerGlyph } from '@/features/identity/social/components/provider-glyph';
import { providerLabel } from '@/features/identity/social/tools/social';
import { linkProviderAction, unlinkProviderAction } from '../actions/actions';
import type { LinkedProvider } from '../tools/credentials';
import { CREDENTIALS_SECTION, CREDENTIALS_STAGE } from '../tools/credentials-state';
import { PROVIDERS_MESSAGES } from './credentials-messages';
import { useCredentials, useSectionBusy } from './credentials-context';
import styles from './credentials.module.css';

/** Module-level for the reason `FactorBody` is; its one prop is the narrowed read. */
export function ProvidersBody({ linked }: { readonly linked: readonly LinkedProvider[] }) {
  const t = useTranslations(PROVIDERS_MESSAGES);
  const { stage, perform, succeeded, password } = useCredentials();
  const busy = useSectionBusy(CREDENTIALS_SECTION.PROVIDERS);

  const held = new Set(linked.map((identity) => identity.provider));
  const linkable = Object.values(SOCIAL_PROVIDER).filter((provider) => !held.has(provider));

  const confirmLink = (provider: SocialProvider) =>
    perform({
      section: CREDENTIALS_SECTION.PROVIDERS,
      action: () => linkProviderAction({ provider, password: password() }),
      onSuccess: () => succeeded({ title: t('linkedTitle'), body: t('linkedBody') }),
    });

  const unlink = (provider: SocialProvider) =>
    perform({
      section: CREDENTIALS_SECTION.PROVIDERS,
      action: () => unlinkProviderAction({ provider, password: password() }),
      onSuccess: () => succeeded({ title: t('unlinkedTitle'), body: t('unlinkedBody') }),
    });

  if (stage.kind === CREDENTIALS_STAGE.CONFIRMING_LINK) {
    return (
      <div className={styles.form}>
        <p className="t-label">{t('confirmHeading', { provider: providerLabel(stage.provider) })}</p>
        <p className="t-caption">{t('confirmHelp')}</p>
        <Button type="button" busy={busy} onClick={() => confirmLink(stage.provider)}>
          {t('confirm')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      {linked.length === 0 ? <p className="t-body">{t('none')}</p> : null}

      <ul className={styles.linked}>
        {linked.map((identity) => (
          <li key={identity.provider} className={styles.linkedRow}>
            <span className={styles.linkedName}>
              {providerGlyph(identity.provider)}
              <span>
                <span className="t-label">{providerLabel(identity.provider)}</span>
                <span className="t-caption">{identity.assertedEmail}</span>
              </span>
            </span>
            <Button
              type="button"
              variant={BUTTON_VARIANT.SUBTLE}
              busy={busy}
              onClick={() => unlink(identity.provider)}
            >
              {t('unlink')}
            </Button>
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        {linkable.map((provider) => (
          <ProviderButton
            key={provider}
            href={`/auth/social/${provider}/start?intent=link`}
            glyph={providerGlyph(provider)}
          >
            {t('link', { provider: providerLabel(provider) })}
          </ProviderButton>
        ))}
      </div>
    </div>
  );
}
