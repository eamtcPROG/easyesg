import type { ReactNode } from 'react';
import styles from '../styles/legal.module.css';

/**
 * The tags a legal document's text is written with (task 75.4) — a paragraph, a list and its items, and emphasis. **The
 * text keeps its own shape**: a section is one message with its paragraphs and lists inside it, so counsel's next
 * revision can add a paragraph without a release changing code, only words. A tag the text uses must be one of these.
 */
export const LEGAL_RICH_TAGS = {
  p: (chunks: ReactNode) => <p>{chunks}</p>,
  ul: (chunks: ReactNode) => <ul className={styles.list}>{chunks}</ul>,
  li: (chunks: ReactNode) => <li>{chunks}</li>,
  strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
};
