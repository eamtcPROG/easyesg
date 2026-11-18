/**
 * A-03 — Publish a reviewed set · PA · UC-72 · Publish (task 67.5)
 *
 * **An address, not a screen**: since task 170 a form over a list opens in a dialogue at the list's own address
 * (`design_spec.md` §5.2's preamble), so the publication is `/content?panel=publish`, and this route sends a bookmark
 * of the scaffold's address there rather than showing nothing.
 */
import { createFileRoute, redirect } from '@tanstack/react-router';
import { CONTENT_PANEL } from '~/features/platform/localization/tools/content-console-search';

export const Route = createFileRoute('/_realm/content/publish')({
  beforeLoad: () => {
    throw redirect({ to: '/content', search: { panel: CONTENT_PANEL.PUBLISH } });
  },
});
