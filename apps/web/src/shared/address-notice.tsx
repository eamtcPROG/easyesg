import type { ReactNode } from 'react';
import { TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { RETURN_DESTINATION, returnDestination } from './return-destination';
import styles from './address-notice.module.css';

/**
 * The two §8.1 address states, drawn (task 103).
 *
 * **`error — not found`** — the address does not exist and never will. **`error — not yet
 * available`** — the route is real and its screen has not shipped. `design_spec.md` §4.5 records
 * why these are patterns rather than `S-nn` rows: UX-7 governs destinations serving a use case,
 * and these are the answer when no destination applies, so there is nothing to trace to.
 *
 * **Two exports rather than one component with a flag**, which is §4.5's decision and not a
 * styling choice: the reader's next step differs. A wrong address is corrected by going somewhere
 * real; a deferred one is corrected by waiting, and telling someone their bookmark is broken when
 * it is merely early would be the wrong sentence in the one place they are already lost.
 *
 * **Neither renders a landmark**, and that is what lets both sit in either chrome. `(workspace)`'s
 * layout already emits `<main>` — task 30.1 put it there so the global tier had something to skip
 * to — while `(public)` emits none, so a public caller wraps this in `FocusColumn`. A `<main>` in
 * here would be correct in exactly one of the two and duplicate the landmark in the other, which
 * is the collision task 30.1 had to unpick between `RecordShell` and the global bar.
 *
 * §8.2's three parts are the heading, the body and the link — not a `Callout`. The vehicle in
 * §11.5 is for a message *inside* a screen that has its own title; these two ARE the screen, and
 * borrowing the inline vehicle would leave the page with no `h1` at all.
 */
async function AddressNotice({
  title,
  body,
  actionHome,
  actionSignIn,
}: {
  readonly title: string;
  readonly body: string;
  readonly actionHome: string;
  readonly actionSignIn: string;
}): Promise<ReactNode> {
  const destination = await returnDestination();

  return (
    <div className={styles.stack}>
      <h1 className="t-heading-1">{title}</h1>
      <p className={`t-body ${styles.body}`}>{body}</p>
      <TextLink asChild>
        <Link href={destination.href}>
          {destination.kind === RETURN_DESTINATION.HOME ? actionHome : actionSignIn}
        </Link>
      </TextLink>
    </div>
  );
}

/** `error — not yet available` — a real route whose screen has not shipped. */
export async function NotYetAvailable() {
  const t = await getTranslations('chrome.notYetAvailable');
  return (
    <AddressNotice
      title={t('title')}
      body={t('body')}
      actionHome={t('actionHome')}
      actionSignIn={t('actionSignIn')}
    />
  );
}

/** `error — not found` — the address resolves to nothing. */
export async function AddressNotFound() {
  const t = await getTranslations('chrome.notFound');
  return (
    <AddressNotice
      title={t('title')}
      body={t('body')}
      actionHome={t('actionHome')}
      actionSignIn={t('actionSignIn')}
    />
  );
}
