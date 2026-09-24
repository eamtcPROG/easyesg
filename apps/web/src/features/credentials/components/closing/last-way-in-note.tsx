'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { providerLabel } from '@/features/identity/social/tools/social';
import { LAST_WAY_IN, lastWayIn, type LastWayIn } from '../../tools/last-way-in';
import { LAST_WAY_IN_MESSAGES } from '../shared/credentials-messages';
import { useCredentials } from '../shared/credentials-context';
import styles from '../styles/credentials.module.css';

/**
 * S-28's closing note (task 169; OQ-19 closed): which of the account's ways in cannot be removed, and why — said
 * **before** the reader tries, where the screen used to say it only as the api's refusal afterwards (UC-12, UX-70).
 *
 * **A note and not a `Callout`**, as the artboard draws it: a quiet aside on the reasoned tint with no title and no
 * action. A `Callout` carries three parts and announces itself as a status, and this is neither news nor a state a
 * reader changed. Nothing is drawn when either read failed: a note from half the facts would state what the screen
 * does not know (`last-way-in.ts`).
 */
export function LastWayInNote() {
  const { read } = useCredentials();
  const way = lastWayIn(read);
  if (way === null) return null;

  return (
    <p className={styles.note}>
      <NoteText way={way} />
    </p>
  );
}

function NoteText({ way }: { readonly way: LastWayIn }) {
  const t = useTranslations(LAST_WAY_IN_MESSAGES);
  const format = useFormatter();

  switch (way.kind) {
    case LAST_WAY_IN.PASSWORD_ONLY:
      return t('passwordOnly');
    case LAST_WAY_IN.PASSWORD_AND_PROVIDERS:
      return t('passwordAndProviders', {
        providers: format.list(way.providers.map(providerLabel), 'enumeration'),
      });
    case LAST_WAY_IN.LAST_PROVIDER:
      return t('lastProvider', { provider: providerLabel(way.provider) });
    case LAST_WAY_IN.PROVIDERS_ONLY:
      return t('providersOnly');
  }
}
