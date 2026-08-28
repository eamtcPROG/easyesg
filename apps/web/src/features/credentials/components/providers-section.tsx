'use client';

import { BUTTON_VARIANT, Button, ProviderButton, RecordSection } from '@easyesg/ui';
import { SOCIAL_PROVIDER, type SocialProvider } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { providerGlyph } from '@/features/identity/components/provider-glyphs';
import { providerLabel } from '@/features/identity/social';
import { linkProviderAction, unlinkProviderAction } from '../actions';
import { SECTION_READ, type LinkedProvider } from '../credentials';
import { CREDENTIALS_SECTION, CREDENTIALS_STAGE } from '../credentials-state';
import { useCredentials, useSectionBusy } from './credentials-context';
import { SectionUnavailable } from './section-unavailable';
import styles from './credentials.module.css';

/**
 * S-28's linked accounts — UC-11 and UC-12.
 *
 * **Linking leaves by navigation, not by an action**, because it begins an OAuth round trip: the
 * button is an anchor to `/auth/social/{provider}/start?intent=link`, exactly as S-01's provider
 * buttons are. `ProviderButton` is the inventory component task 24 added for that, and reusing it
 * here is the whole of UX-89 — a second provider button on a settings screen would have been the
 * one-off it names.
 *
 * **The password is asked for on the way back, not on the way out** (§12.5.6's task-27.7 row), so
 * the confirmation below is a *state of this screen* rather than a step of the button. A reader who
 * abandons it has attached nothing: the code is spent only when the password completes it.
 *
 * BR-ID-4 is not mirrored here. The screen offers unlink on every linked provider and renders the
 * API's refusal when removing one would leave no credential — between a render and a click, a
 * password may have been set or removed, so the server's answer is the only authoritative one.
 */
export function ProvidersSection() {
  const t = useTranslations('identity.credentials.providers');
  const { read } = useCredentials();

  return (
    <RecordSection
      id={CREDENTIALS_SECTION.PROVIDERS}
      heading={t('heading')}
      description={t('description')}
    >
      {read.providers.status === SECTION_READ.READY ? (
        <ProvidersBody linked={read.providers.value} />
      ) : (
        <SectionUnavailable />
      )}
    </RecordSection>
  );
}

/** Module-level for the reason `FactorBody` is; its one prop is the narrowed read. */
function ProvidersBody({ linked }: { readonly linked: readonly LinkedProvider[] }) {
  const t = useTranslations('identity.credentials.providers');
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
