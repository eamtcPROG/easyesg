import { useQuery } from '@tanstack/react-query';
import { taxonomyConsoleQuery } from '../../queries/taxonomy-console';
import type { TaxonomySearch } from '../../tools/taxonomy-search';
import { TaxonomyBoard } from '../board/taxonomy-board';
import { TaxonomyReadArms } from '../states/taxonomy-read-arms';

/**
 * A-04 — taxonomy versions, mappings, migration runs (tasks 67.6, 67.7; UC-75 … UC-79; `design_spec.md` §5.2 A-04).
 * **The section reads and picks the arm**; the board composes the regions over the console's read.
 */
export function TaxonomyConsoleSection({
  search,
  onSearchChange,
}: {
  readonly search: TaxonomySearch;
  readonly onSearchChange: (next: TaxonomySearch) => void;
}) {
  const query = useQuery(taxonomyConsoleQuery());
  return (
    <TaxonomyReadArms
      query={query}
      ready={(console) => <TaxonomyBoard console={console} search={search} onSearchChange={onSearchChange} />}
    />
  );
}
