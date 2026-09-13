import type { ReactNode } from 'react';
import styles from './entitlement-gate.module.css';

/**
 * Entitlement gate — §11.5's Domain row *"Limit, allowance, consumption, path"*, defined in §6.10, and
 * first built by task 142 for S-16's seat ceiling, following the specimen in
 * `EasyESG Components.dc.html`.
 *
 * **UX-50 fixes the order, so the anatomy is the order:** the limit reached (the title), current
 * consumption (the figure and its meter), what is allowed and what it means for the work in hand (the
 * body), and the path (the actions). A caller cannot rearrange them, which is the point of this being a
 * component rather than a paragraph each screen writes.
 *
 * **The path may be absent, and the type makes each caller say so.** `actions` is required and
 * nullable — `Callout`'s shape for its "what now" slot — because a missing path is a **deferral** of
 * FR-102's upgrade-path clause, recorded where it applies (S-16's seat block before task 53), and an
 * optional prop would let a screen that *has* a path forget it silently. `null` is a decision a
 * reader can see; UX-50 lists the path and does not itself permit its absence.
 *
 * **The meter is decoration and is hidden from assistive technology.** The figure beside it is the
 * value, in words the caller formats; a second, numeric reading of the same fact would be read out
 * twice. An SVG rather than a sized `div`, because an extent from data is an attribute here and this
 * package writes no inline styles.
 *
 * A polite `status`: after a refused action it is news; rendered with the page it is ordinary content,
 * which a status region does not announce.
 *
 * States (§8.1): **success** only — the gate is itself the settled answer to an action that was or
 * would be refused. Loading, empty, partial, error and offline belong to the screen around it, and a
 * gate is never read-only because it holds nothing editable.
 */
export interface EntitlementGateProps {
  /** The limit reached, as a sentence — "All 10 seats are taken". */
  title: ReactNode;
  /** What the figure counts — "Seats in use". */
  consumptionLabel: ReactNode;
  /** The figure, as the caller formats it — "10 of 10". */
  consumption: ReactNode;
  /** The meter's only inputs. It fills to `used / limit`, and no further. */
  used: number;
  limit: number;
  /** What the allowance is and what the block means for work in hand — and, with no path, the way out. */
  children: ReactNode;
  /** The path's controls, or `null` where there is no path to offer. */
  actions: ReactNode | null;
}

/** The meter's drawn width, out of 100. A limit of zero or less draws full: nothing is allowed. */
export const meterExtent = (input: { readonly used: number; readonly limit: number }): number =>
  input.limit > 0 ? Math.min(Math.max(input.used, 0) / input.limit, 1) * 100 : 100;

export function EntitlementGate({
  title,
  consumptionLabel,
  consumption,
  used,
  limit,
  children,
  actions,
}: EntitlementGateProps) {
  return (
    <div role="status" className={styles.gate}>
      <p className={`t-body-strong ${styles.title}`}>{title}</p>
      <div className={`t-caption ${styles.consumption}`}>
        <span>{consumptionLabel}</span>
        <span className={styles.figure}>{consumption}</span>
      </div>
      <svg
        className={styles.meter}
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <rect className={styles.track} width="100" height="8" rx="4" />
        <rect className={styles.fill} width={meterExtent({ used, limit })} height="8" rx="4" />
      </svg>
      <div className={`t-body ${styles.body}`}>{children}</div>
      {actions === null ? null : <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
