/**
 * A-04's migration run — progress, result, one step back (task 67.7; UC-78; UX-123). Addressable by the run's id, so the
 * page a start lands on is the page an operator returns to.
 */
import { createFileRoute } from '@tanstack/react-router';
import { RunScreen } from '~/features/platform/taxonomy/components/run/run-screen';

export const Route = createFileRoute('/_realm/taxonomy/runs/$runId')({
  component: MigrationRunRoute,
});

function MigrationRunRoute() {
  const { runId } = Route.useParams();
  return (
    <div className="p-[var(--space-6)]">
      <RunScreen runId={runId} />
    </div>
  );
}
