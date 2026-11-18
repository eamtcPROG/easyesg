/**
 * A-04 — Taxonomy versions, mappings, migration runs · PA · UC-75 … UC-79 · Editor + Batch (tasks 67.6, 67.7)
 *
 * A version registered from what the release commits, the adoption schedule, a pair's mapping and its determination,
 * EFRAG's label diff, the exposure view, and the migration runs — UX-123's blast radius before a run starts. The screen
 * is `features/platform/taxonomy/`; this route owns only its addressable state, the open pair and the diff's locale
 * (UX-4). **The realm guard admits any operator; the api decides who reads**, as A-03's does.
 */
import { createFileRoute } from '@tanstack/react-router';
import { TaxonomyConsoleSection } from '~/features/platform/taxonomy/components/section/taxonomy-console-section';
import { readTaxonomySearch } from '~/features/platform/taxonomy/tools/taxonomy-search';

export const Route = createFileRoute('/_realm/taxonomy/')({
  validateSearch: readTaxonomySearch,
  component: TaxonomyRoute,
});

function TaxonomyRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div className="flex flex-col gap-[var(--space-7)] p-[var(--space-6)]">
      <TaxonomyConsoleSection search={search} onSearchChange={(next) => void navigate({ search: next, resetScroll: false })} />
    </div>
  );
}
