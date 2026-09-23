/**
 * A-17 — Notification categories and templates · PA · UC-176 · Editor + Publish (task 67.10)
 *
 * A category's behaviour — where it travels, and whether recipients may switch it off — as configuration rather than a
 * release (FR-173), published under UX-123: preview, a disclosure naming whose choice stops counting, confirm, result,
 * one-step revert. **Its wording is shown, never edited** (OQ-43): it ships in the committed catalogues with the code
 * that raises the category, and appears here rendered with example values. The screen is
 * `features/platform/notification/`; this route owns only its addressable state.
 *
 * **Every part of the view is in the URL** (UX-4): the category whose record is open.
 *
 * **The realm guard admits any operator; the api decides who reads.** A Billing Operator who follows a link here sees
 * §5.2's permission state, drawn from the api's 403.
 */
import { createFileRoute } from '@tanstack/react-router';
import { NotificationCategories } from '~/features/platform/notification/components/section/notification-categories';
import { readNotificationCategoriesSearch } from '~/features/platform/notification/tools/notification-categories-search';

export const Route = createFileRoute('/_realm/notification-templates')({
  validateSearch: readNotificationCategoriesSearch,
  component: NotificationTemplatesRoute,
});

function NotificationTemplatesRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return <NotificationCategories search={search} onSearchChange={(next) => void navigate({ search: next })} />;
}
