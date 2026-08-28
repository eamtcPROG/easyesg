'use client';

import type { SocialProvider } from '@easyesg/contracts';
import { RecordShell } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { CredentialsRead } from '../credentials';
import { CredentialsNotice } from './credentials-notice';
import { CredentialsProvider } from './credentials-context';
import { FactorSection } from './factor-section';
import { PasswordSection } from './password-section';
import { ProvidersSection } from './providers-section';
import { ReauthGate } from './reauth-gate';

/**
 * S-28's body — the Record archetype with three sections and one re-authentication gate.
 *
 * **The file is a composition and nothing else** (28 Aug 2026). It used to hold the reducer, the
 * form, the outcome-to-notice translation and every section's callbacks, and thread nine props
 * downward; `credentials-context.tsx` holds the state now and each region takes what it needs from
 * `useCredentials()`. That is the move `access-board.tsx` made on S-16, for the same reason: the
 * props were not data the sections needed, they were the state's own API restated at every child.
 *
 * The order is the reading order, and the gate is last on purpose: it authorises the actions above
 * it, so it reads as the record's rather than any one section's.
 */
export interface CredentialsBoardProps {
  readonly read: CredentialsRead;
  /** Set when a provider round trip has just returned — the screen is born mid-flow. Typed as the
   *  contract's enum, since `readPendingLink` validates the cookie against it (27 Aug 2026). */
  readonly pendingLinkProvider: SocialProvider | null;
}

export function CredentialsBoard({ read, pendingLinkProvider }: CredentialsBoardProps) {
  const t = useTranslations('identity.credentials');

  return (
    <CredentialsProvider read={read} pendingLinkProvider={pendingLinkProvider}>
      <RecordShell title={t('title')} summary={t('lede')}>
        <CredentialsNotice />
        <PasswordSection />
        <FactorSection />
        <ProvidersSection />
        <ReauthGate />
      </RecordShell>
    </CredentialsProvider>
  );
}
