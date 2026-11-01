/**
 * Opening a notice records it read (task 50.2.1; §12.5.6's task-50.2 row (2)) — `POST
 * /api/v1/notifications/{id}/read` through the pass-through, sent as the reader follows the notice's link.
 *
 * **`keepalive`, and not awaited.** The link is a real link (UX-63), so the navigation it starts is the browser's
 * own and cannot wait on this; a `keepalive` request outlives the page that sent it, which a Server Action's
 * response does not — that one would be abandoned mid-stream by the very navigation it rode on. The mark is the
 * API's to refuse or keep once (a second mark keeps the first time), so nothing here reads the answer.
 *
 * The request is a same-origin write, so the pass-through's proof holds: the browser sends `Sec-Fetch-Site` with it.
 */
export function markNoticeOpened(input: {
  readonly notificationId: string;
  /** Run once the mark has landed — the band's count refreshing, where this page is still there to hear it. */
  readonly onSent?: () => void;
  readonly fetch?: typeof fetch;
}): void {
  const send = input.fetch ?? fetch;
  void send(`/api/v1/notifications/${encodeURIComponent(input.notificationId)}/read`, {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
  }).then(
    () => input.onSent?.(),
    () => undefined,
  );
}
