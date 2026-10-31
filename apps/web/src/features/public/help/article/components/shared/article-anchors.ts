/**
 * S-33's anchors (tasks 77, 227) — where *On this page* lands. **Directive-free and in `shared/`**: the card, a client
 * contents list and the section all read them, and a value exported from a `'use client'` module reaches a Server
 * Component as `undefined` (the root `CLAUDE.md`'s vocabulary rule).
 */

/** The anchor of *the short answer*, which leads every article and the list. */
export const SHORT_ANSWER_ID = 'short-answer';

/** A section's anchor, by its place — the headings an editor writes are prose, not ids. */
export const sectionId = (index: number): string => `section-${index + 1}`;
