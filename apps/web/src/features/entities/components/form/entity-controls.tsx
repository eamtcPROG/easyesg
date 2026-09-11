'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { ReportingEntity } from '@easyesg/contracts';
import { ENTITY_RECORD_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/**
 * §5's Controls row for the record — save, discard, and for a stored record the archive (UC-52 …
 * UC-55).
 *
 * **One save for three sections**: the artboard's own caption says the wizard autosaves and this
 * does not, because a change here rewrites what other people see inside an open report, so it
 * waits for an explicit act. `sections/` holds three groups of fields over **one** `control`, and
 * this is the only place that submits.
 *
 * It takes the record rather than a `creating` flag — the label and the archive control both
 * follow from whether one exists — and `dirty` and `busy` rather than `formState`, which keeps it
 * out of react-hook-form entirely; the two booleans are named fields, per the root file's rule.
 */
export function EntityControls({
  entity,
  dirty,
  busy,
  onDiscardAction,
  onArchiveRequestedAction,
}: {
  readonly entity: ReportingEntity | null;
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly onDiscardAction: () => void;
  readonly onArchiveRequestedAction: () => void;
}) {
  const t = useTranslations(ENTITY_RECORD_MESSAGES);

  return (
    <div className={styles.actions}>
      <Button type="submit" busy={busy} disabled={!dirty}>
        {entity ? t('save') : t('create')}
      </Button>
      <Button
        type="button"
        variant={BUTTON_VARIANT.SUBTLE}
        disabled={!dirty || busy}
        onClick={onDiscardAction}
      >
        {t('discard')}
      </Button>
      {entity ? (
        <Button type="button" variant={BUTTON_VARIANT.DESTRUCTIVE} onClick={onArchiveRequestedAction}>
          {t('archive.action')}
        </Button>
      ) : null}
    </div>
  );
}
