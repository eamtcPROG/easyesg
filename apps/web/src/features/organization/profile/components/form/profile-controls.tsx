'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PROFILE_MESSAGES } from '../shared/profile-messages';
import styles from '../styles/organization-profile.module.css';

/**
 * §5's Controls row for the record — *edit; save; cancel* — and the sentence that says why the pair
 * is inert (UC-50, UC-51).
 *
 * **One save for four sections, which is the difference from S-28.** That screen's sections each
 * commit their own thing because each is a separate credential operation; here the artboard draws a
 * single Discard/Save pair at the foot, so `RecordShell`'s `actions` slot carries them and the
 * sections are grouping, not scope. Splitting the form into files (task 129) does not change that:
 * `sections/` holds four groups of fields over **one** `control`, and this is the only place that
 * commits.
 *
 * **Save is inert until a field differs, and the line beside it says so in words** — the artboard's
 * *"Nothing changed yet"*. A greyed control with no sentence leaves the reader to infer the reason,
 * which UX-102 refuses for the same reason it refuses colour as a sole carrier.
 *
 * **It takes `dirty` and `busy` rather than `formState`**, which keeps it out of react-hook-form
 * entirely: two booleans, no `control`, nothing to subscribe to. They are adjacent same-typed
 * values and therefore named fields, per the root file's rule — `(true, false)` is a swap that
 * compiles and renders a plausible wrong answer, a button that is busy when it should be inert.
 */
export function ProfileControls({
  dirty,
  busy,
  onDiscardAction,
}: {
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly onDiscardAction: () => void;
}) {
  const t = useTranslations(PROFILE_MESSAGES);

  return (
    <div className={styles.actions}>
      <Button type="submit" busy={busy} disabled={!dirty}>
        {t('save')}
      </Button>
      <Button
        type="button"
        variant={BUTTON_VARIANT.SUBTLE}
        disabled={!dirty || busy}
        onClick={onDiscardAction}
      >
        {t('discard')}
      </Button>
      <p className={`t-caption ${styles.dirtyHint}`}>{dirty ? t('unsaved') : t('pristine')}</p>
    </div>
  );
}
