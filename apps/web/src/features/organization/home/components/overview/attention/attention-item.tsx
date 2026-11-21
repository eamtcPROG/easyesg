import type { ReactNode } from 'react';
import { ATTENTION_TONE, type AttentionTone } from '../../../tools/attention';
import styles from '../../styles/home.module.css';

/**
 * The artboard's glyphs. Text rather than icons because this app draws none (§12.1 places the icon set in
 * `packages/ui`), and because the artboard draws them as text. **Decoration, never the message** (UX-102): each is
 * hidden from assistive technology, and the sentence beside it says everything its tone does.
 */
const GLYPH: Readonly<Record<AttentionTone, string>> = {
  [ATTENTION_TONE.ERROR]: '×',
  [ATTENTION_TONE.ATTENTION]: '!',
  [ATTENTION_TONE.NEUTRAL]: '→',
  [ATTENTION_TONE.OK]: '✓',
};

/**
 * One item of *Needs your attention* as the artboard draws it (task 255): the round mark, a bold sentence saying what
 * is waiting, and beneath it why it matters with the one way on at its end.
 *
 * **The anatomy only — the words are the caller's.** A filing and an invitation say different things and lead to
 * different places, so `attention-filing.tsx` and `attention-invitation.tsx` each word their own and wear this; a
 * third kind of item is a third caller, never a flag here.
 */
export function AttentionItem({
  tone,
  title,
  action,
  children,
}: {
  readonly tone: AttentionTone;
  readonly title: string;
  /** The one way on, after the sentence — or nothing, where the reader can do nothing here. */
  readonly action: ReactNode;
  /** Why it matters. */
  readonly children: ReactNode;
}) {
  return (
    <li className={styles.item}>
      <span className={styles.mark} data-tone={tone} aria-hidden="true">
        {GLYPH[tone]}
      </span>
      <div className={styles.itemBody}>
        <p className={styles.itemTitle}>{title}</p>
        <p className={`t-caption ${styles.itemText}`}>
          {children}
          {action === null ? null : <span className={styles.itemAction}>{action}</span>}
        </p>
      </div>
    </li>
  );
}
