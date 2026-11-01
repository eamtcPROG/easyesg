import { QRCodeSVG } from 'qrcode.react';
import type { ReactNode } from 'react';
import styles from './enrolment-code.module.css';

/**
 * Enrolment code — a **§11.5 inventory addition** under Data display (UX-89, task 143): an
 * `otpauth://` Key Uri drawn as a QR symbol **beside** the base32 secret it encodes. Its consumers
 * are credential screens — S-28's enrolment, and A-19's re-enrolment — and a one-off in any of them
 * is the defect UX-89 names.
 *
 * ## Beside, never instead of
 *
 * The scan is the fast path for a phone. The typed secret is the path for a desktop authenticator, a
 * screen reader, and a person entering the key on a device that cannot see this screen — so the
 * secret renders in every arm and the symbol only adds to it. Neither is the other's fallback, which
 * is why there is no "show the key instead" control to design.
 *
 * ## States (§8.1 subset, UX-90 — designed before the first instance)
 *
 * - **ready** — the symbol, then the heading, the secret and the help.
 * - **the URI absent** — `uri: null`: the secret and its instructions stand alone. The contract
 *   makes `enrolmentUri` required, so a consumer arrives here only by passing `null` on purpose. It
 *   is an arm rather than a stray `null` check because the words beside the secret are the caller's,
 *   and a heading saying *scan* above no symbol is exactly the false copy this component was added
 *   to end.
 * - **loading** — `EnrolmentCodeLoading`, its own file over this stylesheet.
 *
 * Not applicable: **empty**, since an offer without a secret is not an offer; **error**, since an
 * encoder that cannot encode a URI this product minted is a defect rather than a state (§11.5); and
 * read-only, offline, pending and success, which describe a region that writes where this one shows
 * a value.
 *
 * ## Dark modules on a light ground, in both schemes
 *
 * The symbol paints `currentColor` over a transparent ground, and the stylesheet sets both from
 * `--enrolment-code-module` and `--enrolment-code-ground` — a pair that does **not** follow the
 * scheme, on purpose (project owner, 13 Sep 2026). A camera reads this, not a person, and ISO/IEC
 * 18004 makes decoding a reflectance-reversed symbol an optional capability: light modules on a dark
 * ground are unreadable to every scanner that omits it. `tokens.css` carries that reason beside the
 * pair. The library's own defaults are `#000000` on `#FFFFFF` — colour literals, which
 * `packages/ui/CLAUDE.md` keeps out of every file but `tokens.css`.
 *
 * ## No `'use client'`
 *
 * `QRCodeSVG` calls `useMemo` and `forwardRef` and no other React API, and React 19.2.8's server
 * build exports both — read from both packages' source on 13 Sep 2026, not assumed. So a Server
 * Component can render this, and a directive would repeat `Button`'s defect: a client boundary with
 * no hook, browser API or handler of its own to justify it. Re-read `qrcode.react` when its pin moves.
 */
export interface EnrolmentCodeProps {
  /** The Key Uri the symbol encodes, or `null` for the arm where there is none. */
  readonly uri: string | null;
  /** The base32 secret. Rendered in every arm: typing it is a path of its own, not a fallback. */
  readonly secret: string;
  /** What the reader is asked to do, in the caller's words — which must be true of the arm. */
  readonly heading: ReactNode;
  /** One or two sentences after the secret (UX-17). */
  readonly help: ReactNode;
  /**
   * The symbol's accessible name, heard in place of the squares. A `string` rather than a node
   * because it becomes an attribute, and a screen reader cannot navigate inside one.
   */
  readonly symbolLabel: string;
}

/**
 * **`M`, not the library's default `L`.** A symbol photographed off a screen meets glare, moiré and a
 * refresh line; `M` recovers 15% of its codewords where `L` recovers 7%. `boostLevel`, on by default,
 * raises it further whenever that costs no extra version.
 */
const ERROR_CORRECTION = 'M';

/**
 * ISO/IEC 18004's quiet zone — four modules of ground on every side, which is how a scanner finds
 * the finder patterns at all. The library draws none by default, so without this the plate's edge
 * would be the symbol's edge.
 */
const QUIET_ZONE_MODULES = 4;

export function EnrolmentCode({ uri, secret, heading, help, symbolLabel }: EnrolmentCodeProps) {
  return (
    <div className={styles.code}>
      {uri === null ? null : (
        <QRCodeSVG
          value={uri}
          level={ERROR_CORRECTION}
          marginSize={QUIET_ZONE_MODULES}
          fgColor="currentColor"
          bgColor="transparent"
          aria-label={symbolLabel}
          className={styles.symbol}
        />
      )}
      <div className={styles.manual}>
        <p className="t-label">{heading}</p>
        {/* `translate="no"`: a translating browser would otherwise rewrite a key made of letters. */}
        <p className={`t-code ${styles.secret}`} translate="no">
          {secret}
        </p>
        <p className="t-caption">{help}</p>
      </div>
    </div>
  );
}
