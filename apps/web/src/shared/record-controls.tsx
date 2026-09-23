'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import styles from './record-controls.module.css';

/**
 * A Record's Controls row — *edit; save; cancel* — and the sentence that says why the pair is inert. S-15's and, since
 * task 52.3, S-27's.
 *
 * **In `src/shared/` because two features read it** (`shared-how-many-siblings`): it was S-15's `ProfileControls` until
 * S-27 became its second reader, and a copy per Record screen is the drift `RecordNotice` was extracted to end. **It
 * reads its own words**, from `forms.record` — the namespace for what every form says alike — rather than taking them as
 * a prop: the two screens' copies were identical in two languages and had already drifted in the third, which is the
 * shape `apps/web/CLAUDE.md`'s *a Client Component reads its own words* exists to catch (task 52's close review).
 *
 * **Save is inert until a field differs, and the line beside it says so in words** — S-15's artboard's *"Nothing
 * changed yet"*. A greyed control with no sentence leaves the reader to infer the reason, which UX-102 refuses for the
 * same reason it refuses colour as a sole carrier.
 *
 * **It takes `dirty` and `busy` rather than `formState`**, which keeps it out of react-hook-form entirely: two
 * booleans, nothing to subscribe to. Adjacent same-typed values, so named fields — `(true, false)` is a swap that
 * compiles and renders a button busy when it should be inert.
 */
export function RecordControls({
  dirty,
  busy,
  onDiscardAction,
}: {
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly onDiscardAction: () => void;
}) {
  const t = useTranslations('forms.record');

  return (
    <div className={styles.actions}>
      <Button type="submit" busy={busy} disabled={!dirty}>
        {t('save')}
      </Button>
      <Button type="button" variant={BUTTON_VARIANT.SUBTLE} disabled={!dirty || busy} onClick={onDiscardAction}>
        {t('discard')}
      </Button>
      <p className={`t-caption ${styles.dirtyHint}`}>{dirty ? t('unsaved') : t('pristine')}</p>
    </div>
  );
}
