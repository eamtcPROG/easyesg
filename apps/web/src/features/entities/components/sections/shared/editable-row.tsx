'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useId, type MouseEvent, type ReactNode } from 'react';
import { ENTITY_RECORD_MESSAGES } from '../../shared/entity-messages';
import styles from '../../styles/entities.module.css';

/**
 * One row of a collection, open for editing (28 Sep 2026): a header line holding the row's name and its removal, and
 * the row's fields beneath it in columns — one line of a table where the card has room, a small form where it has not.
 * In `shared/` because the sites and the boundary both draw it.
 *
 * **This app's rather than `packages/ui`'s `Fieldset`**, which S-07's repeating rows use, because the anatomy differs
 * (UX-89 as amended): the Fieldset's name sits on its border and its action is laid over the corner of its first line,
 * which a row of fields side by side fills — so the removal sat on a label. Here the header is a line of its own.
 * **A group named by its header**, which is what a `fieldset` and its legend are to assistive technology.
 *
 * **The removal is on the header line, and a press on it takes no focus** (29 Sep 2026, project owner: *"if the field
 * is not filled it does not remove it"*). The press used to take focus from a blank name, which then showed its
 * *required* message; the row grew, and the removal — at the row's foot — moved out from under the pointer before the
 * click completed. On the header line nothing above it changes, and keeping focus where it was means a row about to go
 * is never validated. A keyboard reader tabbing to it still moves focus, and the button is where focus lands.
 *
 * **The removal's visible word is short and its accessible name is whole** — *Remove* on screen, *Remove the site Depot
 * Strășeni* to a screen reader, which begins with the visible word as WCAG's *label in name* asks.
 */
const keepFocus = (event: MouseEvent<HTMLButtonElement>): void => event.preventDefault();

export function EditableRow({
  name,
  removeLabel,
  readOnly,
  onRemoveAction,
  children,
}: {
  /** The row's name as typed, or its position until it has one. */
  readonly name: string;
  /** The removal's accessible name, naming the row. */
  readonly removeLabel: string;
  readonly readOnly: boolean;
  readonly onRemoveAction: () => void;
  /** The row's fields. */
  readonly children: ReactNode;
}) {
  const t = useTranslations(`${ENTITY_RECORD_MESSAGES}.rows`);
  const nameId = useId();

  return (
    <li className={styles.row}>
      <div role="group" aria-labelledby={nameId} className={styles.rowGroup}>
        <div className={styles.rowHead}>
          <span id={nameId} className={styles.rowName}>
            {name}
          </span>
          {readOnly ? null : (
            <Button
              type="button"
              variant={BUTTON_VARIANT.SUBTLE}
              aria-label={removeLabel}
              onMouseDown={keepFocus}
              onClick={onRemoveAction}
            >
              {t('remove')}
            </Button>
          )}
        </div>
        <div className={styles.rowFields}>{children}</div>
      </div>
    </li>
  );
}
