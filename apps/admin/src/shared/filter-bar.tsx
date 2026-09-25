import type { ReactNode } from 'react';

/**
 * A console list's filter row (task 170; `design_spec.md` §5.2's preamble: *"a filter row is
 * symmetric"*). Its fields share one width — 14rem each at `wide`, half the row at `medium`, the whole
 * row at `compact` — and its buttons follow the last field on its baseline, **at the field's own
 * height** (`--field-block-size`), so a text field, a select, a date and the button beside them draw
 * one line.
 *
 * **A form with an `action`**, which is how both of today's filters submit: every submission is a
 * navigation (UX-4), and the React action owns the submit outright — task 96's rule that a `<form>`
 * carries `method="post"` or an `action`, taken the second way, since a POST to a static host that
 * beat hydration would answer 405 for nothing.
 *
 * **One width whatever the field count**, so one screen's search is as wide as another's first filter,
 * and the buttons stand beside the fields rather than at the far edge of the row: a single field
 * stretched across it, or a button a screen's width from its field, is the asymmetry this exists to
 * remove, between screens rather than within one.
 *
 * **In `shared/` on that folder's admission test**: both contexts filter lists — A-02 and A-08 now, the
 * billing queues next — and it imports nothing from `features/`.
 */
export function FilterBar({
  label,
  action,
  children,
  actions,
}: {
  /** The search landmark's name. */
  readonly label: string;
  readonly action: (data: FormData) => void;
  /** The fields, each one width. */
  readonly children: ReactNode;
  /** The buttons, at the row's end — below the fields, full width, at `compact`. */
  readonly actions: ReactNode;
}) {
  return (
    <form
      role="search"
      aria-label={label}
      action={action}
      className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end"
    >
      {/* `contents`, so each field is the form's own grid item or flex item — the width rule reaches it. */}
      <div className="contents lg:[&>*]:w-56">{children}</div>
      <div className="flex flex-col gap-[var(--space-3)] sm:col-span-2 sm:flex-row [&>*]:h-[var(--field-block-size)]">
        {actions}
      </div>
    </form>
  );
}
