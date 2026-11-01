import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The one image an email carries — the ring mark in the band — and how it travels (task 225; §12.5.6's task-225 row (5)):
 * **attached inline and named by a content id**, so a client shows it without the reader admitting remote images and
 * nothing is fetched from the platform when a message is opened. The HTML names `cid:<id>`; the adapter attaches the
 * bytes under the same id. It is decorative — the wordmark beside it is text — so a client that hides it loses nothing.
 *
 * The PNG is drawn by `tools/draw-email-mark.mjs` from the logo's geometry and copied beside the build by `nest-cli.json`'s
 * assets, as `document.css` is.
 */
export const EMAIL_MARK = {
  contentId: 'ring-mark@easyesg',
  filename: 'easyesg.png',
  contentType: 'image/png',
  /** The size it is drawn at, in CSS pixels; the file is twice that, for a dense screen. */
  size: 28,
} as const;

let bytes: Buffer | undefined;

/** The mark's bytes, read once. A missing file throws at the first send, which the adapter's own spec reaches. */
export function emailMarkBytes(): Buffer {
  bytes ??= readFileSync(join(__dirname, 'assets', 'ring-mark.png'));
  return bytes;
}
