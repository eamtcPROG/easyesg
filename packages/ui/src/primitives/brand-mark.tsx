import styles from './brand-mark.module.css';

/**
 * The easyESG wordmark with its ring mark, as drawn in `EasyESG Logo.dc.html` and repeated on
 * every identity header. Colours resolve from `currentColor`, so the same mark works on the
 * dark Focus header and any light surface without a variant prop.
 *
 * The mark is decorative beside the wordmark text, so it stays `aria-hidden`; the accessible
 * name is the visible text itself.
 */
export function BrandMark() {
  return (
    <span className={styles.brand}>
      <span aria-hidden="true" className={styles.ring}>
        <span className={styles.ringInner}>
          <span className={styles.ringDot} />
        </span>
      </span>
      {/* The wordmark is the product's proper name, identical in every locale — identity,
          not copy, and no catalogue owns it (§13.4 governs text a translator would touch).
          Hence the two narrowly-scoped disables rather than a catalogue key. */}
      <span className={styles.wordmark}>
        {/* eslint-disable no-restricted-syntax */}
        easy<span className={styles.suffix}>ESG</span>
        {/* eslint-enable no-restricted-syntax */}
      </span>
    </span>
  );
}
