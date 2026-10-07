import type { AdminAccount } from '@easyesg/contracts';
import { RecordShell } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import type { CredentialsArrival } from '../../../tools/credentials-arrival';
import { CredentialsArrivalNotice } from '../arrival/credentials-arrival-notice';
import { ReauthGate } from '../confirm/reauth-gate';
import { FactorSection } from '../factor/section/factor-section';
import { PasswordSection } from '../password/password-section';
import { RecoveryCodesSection } from '../recovery-codes/section/recovery-codes-section';
import { CredentialsProvider } from '../shared/credentials-context';
import { consoleHomeFor } from '../../../tools/console-home';
import { ConsoleLink } from '../../chrome/console-link';

/**
 * A-19 · My credentials · PA, BO · UC-212 · Record (task 151) — the operator's own password, second
 * factor and recovery codes, changed without another operator acting (FR-80).
 *
 * **The file is a composition and nothing else**, S-28's `credentials-board.tsx` shape: the state is
 * `shared/credentials-context.tsx`'s, and each region takes what it needs from it. The order is the
 * reading order, and the current-password field every write asks for comes last, S-28's reason: it
 * authorises the three sections above it rather than belonging to any one of them.
 *
 * **A sibling of S-28, not a variant** (`design_spec.md` §5.2 A-19): NFR-65 keeps the realms'
 * credentials disjoint, so the two screens share a shape and no code. What differs is recorded where
 * it differs — the context says why the password is required and one write runs at a time, the state
 * module why a notice names its section and the password outlives one kind of write.
 *
 * The identity header names the account by its address, the only name an operator account holds
 * (UX-137). There is no change attribution, S-28's reason: a credential has none worth showing.
 */
export function CredentialsScreen({
  account,
  arrival,
  from,
}: {
  readonly account: AdminAccount;
  readonly arrival: CredentialsArrival | undefined;
  /** The page the account menu was opened from, already checked to be this console's (task 203.5). */
  readonly from: string | undefined;
}) {
  const t = useTranslations('realm.credentials');
  // §4.7's *↩ to origin, console home when none* (task 203.5) — one arrow, as S-14 draws its origin. A-01's recovery
  // lands here with no origin, so it leads to the operator's home.
  const back = {
    href: from ?? consoleHomeFor(account.role),
    label: from === undefined ? t('backToHome') : t('backToOrigin'),
  };

  return (
    <CredentialsProvider arrival={arrival}>
      <RecordShell
        title={t('title')}
        summary={t('summary', { email: account.email })}
        back={back}
        linkComponent={ConsoleLink}
      >
        <CredentialsArrivalNotice />
        <PasswordSection />
        <FactorSection />
        <RecoveryCodesSection />
        <ReauthGate />
      </RecordShell>
    </CredentialsProvider>
  );
}
