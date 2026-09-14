import type { AccountsSearch } from '../../tools/accounts-search';
import { LogSection } from '../log/section/log-section';
import { RosterSection } from '../roster/section/roster-section';

/**
 * A-08 — Admin accounts and system audit log (task 67.4; UC-87, UC-88; `design_spec.md` §5.2 A-08).
 * **The shell composes the two regions the artboard draws** (`shell-composes-only`): the account table
 * with its record or invitation form, then the log — each reading its own data and drawing its own
 * states, so a slow log never holds the accounts back.
 */
export function AdminAccounts({
  search,
  operatorId,
  onSearchChange,
}: {
  readonly search: AccountsSearch;
  /** The signed-in operator — whose own account the record offers no suspension or removal. */
  readonly operatorId: string;
  readonly onSearchChange: (next: AccountsSearch) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-7)] p-[var(--space-6)]">
      <RosterSection search={search} operatorId={operatorId} onSearchChange={onSearchChange} />
      <LogSection search={search} onSearchChange={onSearchChange} />
    </div>
  );
}
