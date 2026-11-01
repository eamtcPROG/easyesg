'use client';

import { BUTTON_VARIANT, Button, STATUS_TONE, StatusChip } from '@easyesg/ui';
import type { SocialProvider } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { providerGlyph } from '@/features/identity/social/components/provider-glyph';
import { providerLabel } from '@/features/identity/social/tools/social';
import { linkProviderAction, unlinkProviderAction } from '../../actions/actions';
import type { LinkedProvider } from '../../tools/credentials';
import { CREDENTIALS_SECTION, CREDENTIALS_STAGE } from '../../tools/credentials-state';
import { offersUnlink, type LastWayIn } from '../../tools/last-way-in';
import { PROVIDERS_MESSAGES } from '../shared/credentials-messages';
import { useCredentials } from '../shared/credentials-context';
import { ReauthForm } from '../shared/reauth-form';
import { RowNotice } from '../shared/row-notice';
import styles from '../styles/credentials.module.css';

/**
 * One provider in the linked identities: its mark and name, the address it asserted or *Not linked*, and the one
 * action it offers.
 *
 * **Linking leaves by navigation**, because it begins an OAuth round trip: *Link* is an anchor to
 * `/auth/social/{provider}/start?intent=link` — a plain `a`, since that Route Handler sits outside `[locale]` and a
 * locale-aware link would prefix it. **The password is asked on the way back** (§12.5.6's task-27.7 row), so the
 * confirmation is this row born open, and a reader who abandons it has attached nothing.
 *
 * **Unlink is withheld on the account's last way in** (`last-way-in.ts`), which the closing note explains below; the
 * api's refusal (BR-ID-4) still stands behind every other press. Both buttons carry the provider in their accessible
 * name — two rows each offering a bare *Unlink* would read as one control twice — while the visible word stays the
 * artboard's, which the name contains (WCAG 2.5.3).
 */
export function ProviderRow({
  provider,
  identity,
  way,
}: {
  readonly provider: SocialProvider;
  /** The linked identity, or undefined where this provider is not linked. */
  readonly identity: LinkedProvider | undefined;
  readonly way: LastWayIn | null;
}) {
  const t = useTranslations(PROVIDERS_MESSAGES);
  const { stage, open, dismiss, perform, succeeded } = useCredentials();
  const section = CREDENTIALS_SECTION.PROVIDERS;
  const name = providerLabel(provider);
  const bodyId = `${section}-${provider}-body`;

  const unlinking = stage.kind === CREDENTIALS_STAGE.UNLINKING && stage.provider === provider;
  const confirmingLink = stage.kind === CREDENTIALS_STAGE.CONFIRMING_LINK && stage.provider === provider;

  return (
    <li className={styles.groupRow}>
      <div className={styles.rowSummary}>
        <div className={styles.provider}>
          {/* Sized here: the glyph is a bare `viewBox`, which `ProviderButton` sizes on S-01 and nothing did on this
              row — so the mark took its width from the text beside it, and *Not linked* wrapped at every width. */}
          <span className={styles.providerMark} aria-hidden="true">
            {providerGlyph(provider)}
          </span>
          <div className={styles.rowIdentity}>
            <span className={styles.providerName}>{name}</span>
            {identity ? (
              <span className={styles.providerAddress} translate="no">
                {identity.assertedEmail}
              </span>
            ) : (
              <span className={styles.rowDescription}>{t('notLinked')}</span>
            )}
          </div>
        </div>
        <div className={styles.rowTriggers}>
          {identity ? (
            <>
              <StatusChip tone={STATUS_TONE.POSITIVE}>{t('linked')}</StatusChip>
              {offersUnlink(way, provider) ? (
                <Button
                  type="button"
                  variant={BUTTON_VARIANT.SUBTLE}
                  aria-label={t('unlinkLabel', { provider: name })}
                  aria-expanded={unlinking}
                  aria-controls={bodyId}
                  onClick={() => (unlinking ? dismiss() : open({ kind: CREDENTIALS_STAGE.UNLINKING, provider }))}
                >
                  {t('unlink')}
                </Button>
              ) : null}
            </>
          ) : (
            <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
              <a href={`/auth/social/${provider}/start?intent=link`} aria-label={t('linkLabel', { provider: name })}>
                {t('link')}
              </a>
            </Button>
          )}
        </div>
      </div>

      {unlinking || confirmingLink ? (
        <div id={bodyId} className={styles.rowBody}>
          <RowNotice section={section} />
          {unlinking ? (
            <ReauthForm
              section={section}
              help={t('unlinkHelp', { provider: name })}
              submitLabel={t('unlinkSubmit', { provider: name })}
              variant={BUTTON_VARIANT.DESTRUCTIVE}
              onConfirm={({ password, clear }) =>
                perform({
                  section,
                  action: () => unlinkProviderAction({ provider, password }),
                  onSuccess: () => succeeded({ title: t('unlinkedTitle'), body: t('unlinkedBody') }),
                  clear,
                })
              }
            />
          ) : (
            <ReauthForm
              section={section}
              help={t('confirmHelp', { provider: name })}
              submitLabel={t('confirm', { provider: name })}
              onConfirm={({ password, clear }) =>
                perform({
                  section,
                  action: () => linkProviderAction({ provider, password }),
                  onSuccess: () => succeeded({ title: t('linkedTitle'), body: t('linkedBody') }),
                  clear,
                })
              }
            />
          )}
        </div>
      ) : null}
    </li>
  );
}
