import { GrantSection } from '../grant/section/grant-section';
import { SupportAccessHeading } from '../heading/support-access-heading';
import { InProgressSection } from '../in-progress/section/in-progress-section';
import { LogSection } from '../log/section/log-section';
import { RequestSection } from '../request/section/request-section';
import type { SupportAccessSearch } from '../../tools/support-access-search';

/**
 * A-07 — Support access request and audit log (task 67.9; UC-85, UC-86; `design_spec.md` §5.2 A-07). **The shell
 * composes the regions the screen draws** (`shell-composes-only`), each reading its own data and drawing its own
 * states: the request being written, the grant being read, what is in progress, and the log.
 */
export function SupportAccess({
  search,
  operatorId,
  onSearchChange,
}: {
  readonly search: SupportAccessSearch;
  /** The signed-in operator — the only one who may read under the grants they asked for. */
  readonly operatorId: string;
  readonly onSearchChange: (next: SupportAccessSearch) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-7)] p-[var(--space-6)]">
      <SupportAccessHeading />
      <RequestSection search={search} onSearchChange={onSearchChange} />
      <GrantSection search={search} operatorId={operatorId} onSearchChange={onSearchChange} />
      <InProgressSection search={search} operatorId={operatorId} onSearchChange={onSearchChange} />
      <LogSection search={search} onSearchChange={onSearchChange} />
    </div>
  );
}
