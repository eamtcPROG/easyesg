import type { ContentConsoleSearch } from '../../tools/content-console-search';
import { ConsoleSection } from '../console/section/console-section';

/**
 * A-03 — the content and translation console (task 67.5; UC-71 … UC-74; `design_spec.md` §5.2 A-03). **The shell
 * composes the screen's regions** (`shell-composes-only`): the console's one section, which reads its own data and
 * draws its own states.
 */
export function ContentConsoleScreen({
  search,
  onSearchChange,
}: {
  readonly search: ContentConsoleSearch;
  readonly onSearchChange: (next: ContentConsoleSearch) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-7)] p-[var(--space-6)]">
      <ConsoleSection search={search} onSearchChange={onSearchChange} />
    </div>
  );
}
