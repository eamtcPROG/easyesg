'use client';

import type { SocialProvider } from '@easyesg/contracts';
import { RecordShell } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { ScriptingRequired } from '@/shared/scripting-required';
import type { CredentialsRead } from '../../tools/credentials';
import type { LocalizedPath } from '@/lib/locale-path';
import type { CredentialsArrival as Arrival } from '../../tools/credentials-arrival';
import { CredentialsArrival } from '../arrival/credentials-arrival';
import { LastWayInNote } from '../closing/last-way-in-note';
import { FactorRow } from '../factor/factor-row';
import { CredentialsNotice } from '../notice/credentials-notice';
import { PasswordRow } from '../password/password-row';
import { ProvidersGroup } from '../providers/providers-group';
import { CredentialsProvider } from '../shared/credentials-context';
import { CREDENTIALS_MESSAGES } from '../shared/credentials-messages';

/**
 * S-28's body — the Record archetype as `EasyESG Identity.dc.html` draws it (task 169; `design_spec.md` OQ-19, closed
 * 24 Sep 2026): a summary row per credential, each opening in place, and a closing note naming the last way in.
 *
 * **The file is a composition and nothing else** (28 Aug 2026): the state is `credentials-context.tsx`'s, and each
 * region takes what it needs from `useCredentials()`. The order is the artboard's reading order, and the imports
 * follow the folders, which are the same list.
 */
export interface CredentialsBoardProps {
  readonly read: CredentialsRead;
  /** Set when a provider round trip has just returned — the screen is born with that provider's row open. */
  readonly pendingLinkProvider: SocialProvider | null;
  /** Set when S-01 sent a recovery sign-in here (task 190) — the screen opens saying how many codes remain. */
  readonly arrival: Arrival | null;
  /** Where that sign-in was going — offered by the arrival as its way on, already sanitized (task 190). */
  readonly onward: LocalizedPath | null;
}

export function CredentialsBoard({ read, pendingLinkProvider, arrival, onward }: CredentialsBoardProps) {
  const t = useTranslations(CREDENTIALS_MESSAGES);

  return (
    <CredentialsProvider read={read} pendingLinkProvider={pendingLinkProvider}>
      <RecordShell title={t('title')} summary={t('lede')}>
        {/* Once for the record, at rest (task 153's rule, reaching the rows of task 169): every row acts only through
            scripting — a trigger opens its form, and the one form drawn on the server, the link confirmation, submits
            through `CredentialSubmit` — so a reader without it is told here, above everything that would not answer. */}
        <ScriptingRequired />
        <CredentialsArrival arrival={arrival} onward={onward} />
        <CredentialsNotice />
        <PasswordRow />
        <FactorRow />
        <ProvidersGroup />
        <LastWayInNote />
      </RecordShell>
    </CredentialsProvider>
  );
}
