import type { IdentityProvidersSearch } from '../../tools/identity-providers-search';
import { ProvidersSection } from '../providers/section/providers-section';

/**
 * A-18 — Identity provider configuration (task 67.11; UC-70; `design_spec.md` §5.2 A-18). **The shell composes the
 * screen's regions** (`shell-composes-only`): the providers with the chosen one's record, which reads its own data
 * and draws its own states.
 */
export function IdentityProviders({
  search,
  onSearchChange,
}: {
  readonly search: IdentityProvidersSearch;
  readonly onSearchChange: (next: IdentityProvidersSearch) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-7)] p-[var(--space-6)]">
      <ProvidersSection search={search} onSearchChange={onSearchChange} />
    </div>
  );
}
