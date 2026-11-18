/**
 * A-03 — Content and translation console · PA · UC-71 … UC-74 · Editor + Publish (task 67.5)
 *
 * FR-61's content — help topics, articles, plan copy — drafted per locale, sent to review, and published as a reviewed
 * set with each locale's sign-off, under UX-123; FR-64's queue; and which built locales are offered (FR-63). All three
 * locales are separately authored — machine translation is prohibited, and Romanian is the source. The screen is
 * `features/platform/localization/`; this route owns only its addressable state.
 *
 * **Every part of the view is in the URL** (UX-4): the open item, a new item's kind, the publication dialogue.
 *
 * **The realm guard admits any operator; the api decides who reads** — an operator whose roles hold no content
 * permission sees §5.2's permission state, drawn from the api's 403.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ContentConsoleScreen } from '~/features/platform/localization/components/section/content-console';
import { readContentConsoleSearch } from '~/features/platform/localization/tools/content-console-search';

export const Route = createFileRoute('/_realm/content/')({
  validateSearch: readContentConsoleSearch,
  component: ContentConsoleRoute,
});

function ContentConsoleRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return <ContentConsoleScreen search={search} onSearchChange={(next) => void navigate({ search: next, resetScroll: false })} />;
}
