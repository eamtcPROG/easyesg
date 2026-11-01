import type { ReactNode } from 'react';
import styles from './address-notice.module.css';

/**
 * The two §8.1 address states, drawn (task 103).
 *
 * **`error — not found`** — the address does not exist and never will. **`error — not yet
 * available`** — the route is real and its screen has not shipped. `design_spec.md` §4.5 records
 * why these are patterns rather than `S-nn` rows: UX-7 governs destinations serving a use case,
 * and these are the answer when no destination applies, so there is nothing to trace to.
 *
 * **Two states rather than one component with a flag** — `not-yet-available.tsx` and
 * `address-not-found.tsx`, over this anatomy — which is §4.5's decision and not a
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
 *
 * **The way back is a slot since task 74.4, and the two states fill it differently.** *Not yet available* asks the
 * session on the server (`ReturnLink`), as both did from task 103. *Not found* asks it in the browser
 * (`ProbedReturnLink`): `[locale]/not-found.tsx` is handed to its layout as an element, which a Server Component
 * renders eagerly on every page beneath it, so a cookie read there made every page under `[locale]` dynamic and the
 * marketing home could not be prerendered (`architecture.md` §12.5.6's task-74 row (4)).
 */
export function AddressNotice({
  title,
  body,
  action,
}: {
  readonly title: string;
  readonly body: string;
  /** The way back — `ReturnLink` or `ProbedReturnLink`. */
  readonly action: ReactNode;
}) {
  return (
    <div className={styles.stack}>
      <h1 className="t-heading-1">{title}</h1>
      <p className={`t-body ${styles.body}`}>{body}</p>
      {action}
    </div>
  );
}
