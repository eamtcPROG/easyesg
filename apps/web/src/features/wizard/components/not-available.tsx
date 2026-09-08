'use client';

import { Button, BUTTON_VARIANT, TextField } from '@easyesg/ui';
import { useState } from 'react';
import styles from './step.module.css';

const DECLARING = { CLOSED: 'closed', DRAFTING: 'drafting' } as const;

type Declaring = { readonly kind: typeof DECLARING.CLOSED } | { readonly kind: typeof DECLARING.DRAFTING; readonly reason: string };

/**
 * UX-15's declaration: *"not available, with reason"*, on every field (UC-31, FR-32, D-4; task 36.5).
 *
 * **A first-class action rather than an alternative discovered after failing to answer**, which is
 * what UX-15 requires in those words — so it is the anatomy's own required slot, filled here for
 * every field of every module rather than per screen. §6.2 draws it as `[Mark not available ▾]`
 * beneath the value.
 *
 * **It stands on UX-15 and D-4, which bind every field of every module**, and is built once for all
 * eleven because every one needs it — task 36.13's own argument applied to the half that can be
 * built. UC-30's **section** exclusion is a different act with different storage (FR-31's rationale
 * is section-scoped and has no column; `architecture.md` §12.5.6 names its owner), and this is not
 * it — which is also why **UC-22's alternate flow is not the warrant here** (spec review, 8 Sep
 * 2026): that flow names UC-30 in its own words, so it describes the deferred half rather than this
 * one.
 *
 * **A discriminated union rather than two `useState`s** (the root rule's first remedy): closed and
 * drafting cannot both hold, so the impossible pair is made unrepresentable instead of every reader
 * having to know not to write it. There are no named events worth a reducer here — the two
 * transitions are *open* and *close*.
 *
 * **Presentational strings arrive as props**, as everywhere else in this feature: the control owns
 * the flow, the caller owns the words.
 */
export function NotAvailableDeclaration({
  declared,
  onDeclare,
  onResume,
  labels,
}: {
  /** Whether this field already carries FR-32's state. Its reason is rendered by the anatomy. */
  readonly declared: boolean;
  readonly onDeclare: (reason: string) => void;
  readonly onResume: () => void;
  readonly labels: {
    readonly declare: string;
    readonly reason: string;
    readonly reasonHelp: string;
    readonly confirm: string;
    readonly cancel: string;
    readonly resume: string;
  };
}) {
  const [state, setState] = useState<Declaring>({ kind: DECLARING.CLOSED });

  if (declared) {
    return (
      <Button variant={BUTTON_VARIANT.SUBTLE} type="button" onClick={onResume}>
        {labels.resume}
      </Button>
    );
  }

  if (state.kind === DECLARING.CLOSED) {
    return (
      <Button
        variant={BUTTON_VARIANT.SUBTLE}
        type="button"
        onClick={() => setState({ kind: DECLARING.DRAFTING, reason: '' })}
      >
        {labels.declare}
      </Button>
    );
  }

  const { reason } = state;
  return (
    <div className={styles.declaration}>
      <TextField
        label={labels.reason}
        // §7.4's own promise, said where the reason is typed: *"the stated reason is carried into
        // both export formats"*. **Not UX-30** (spec review, 8 Sep 2026) — that rule sits in §6.5
        // beneath UX-29 and governs the *section* rationale, which is task 36.13's.
        help={labels.reasonHelp}
        value={reason}
        onChange={(event) => setState({ kind: DECLARING.DRAFTING, reason: event.currentTarget.value })}
      />
      <div className={styles.declarationActions}>
        {/* **Disabled on an empty reason rather than refusing one afterwards.** FR-32's whole point
            is that the gap is *explained*; a blank reason would be a gap wearing the word. The
            store's `CHECK` refuses it too, and a refusal a reporter meets after typing is worse
            than an action that was never offered. */}
        <Button
          type="button"
          onClick={() => {
            onDeclare(reason.trim());
            setState({ kind: DECLARING.CLOSED });
          }}
          disabled={reason.trim() === ''}
        >
          {labels.confirm}
        </Button>
        <Button
          variant={BUTTON_VARIANT.SUBTLE}
          type="button"
          onClick={() => setState({ kind: DECLARING.CLOSED })}
        >
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}
