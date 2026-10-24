import type { CSSProperties } from 'react';
import { EMAIL_COLOUR, EMAIL_PALETTE } from '../email-palette';
import { EMAIL_TONE, type EmailTone } from '../email-vocabulary';

/**
 * What the email templates share: the type, the table every block is laid out in, and the colours a state is drawn in
 * (task 225). **Inline styles only, written on each element** — the one form every mail client keeps (UX-66: nothing
 * external) — so these are objects the templates spread, not a stylesheet.
 *
 * **The system's sans stack, no web font**: a font a message fetches is a remote resource most clients block, and the
 * words must read without it.
 */
export const TEXT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** A table that lays out and means nothing: announced as presentation, no spacing, no border, full width. */
export const LAYOUT_TABLE = {
  role: 'presentation',
  width: '100%',
  cellPadding: 0,
  cellSpacing: 0,
  border: 0,
} as const;

export const PARAGRAPH: CSSProperties = {
  margin: '0 0 16px',
  fontFamily: TEXT_STACK,
  fontSize: 16,
  lineHeight: '26px',
  color: EMAIL_COLOUR.body,
};

export const SMALL: CSSProperties = {
  margin: 0,
  fontFamily: TEXT_STACK,
  fontSize: 13,
  lineHeight: '20px',
  color: EMAIL_COLOUR.muted,
};

/** The text and the ground a chip and a badge are drawn in, per state — the cascade's state hues. */
export const TONE_COLOURS: Readonly<Record<EmailTone, { readonly text: string; readonly ground: string }>> = {
  [EMAIL_TONE.ATTENTION]: { text: EMAIL_PALETTE['--amber-600'], ground: EMAIL_PALETTE['--amber-tint'] },
  [EMAIL_TONE.SUCCESS]: { text: EMAIL_PALETTE['--pine-700'], ground: EMAIL_PALETTE['--pine-50'] },
  [EMAIL_TONE.ERROR]: { text: EMAIL_PALETTE['--crimson-600'], ground: EMAIL_PALETTE['--crimson-tint'] },
};
