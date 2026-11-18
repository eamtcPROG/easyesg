import { useQuery } from '@tanstack/react-query';
import { TextLink } from '@easyesg/ui';
import { Link } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { migrationRunQuery } from '../../queries/migration-runs';
import { TaxonomyReadArms } from '../states/taxonomy-read-arms';
import { RunOrganizations } from './run-organizations';
import { RunSummary } from './run-summary';

/**
 * A-04's migration run, UX-123's batch page (task 67.7; UC-78; FR-69; 182/42, 182/43): progress per organization, then
 * the result, then one step back. **Its read polls while the worker moves it** (`migrationRunQuery`) and stops once the
 * run is settled or reverted. Counts and outcomes only — never a report's value (D-5).
 */
export function RunScreen({ runId }: { readonly runId: string }) {
  const t = useTranslations('platform.taxonomy.run');
  const query = useQuery(migrationRunQuery(runId));

  return (
    <div className="flex flex-col gap-[var(--space-7)]">
      <TextLink asChild>
        <Link to="/taxonomy">{t('back')}</Link>
      </TextLink>
      <TaxonomyReadArms
        query={query}
        ready={(run) => (
          <>
            <RunSummary run={run} />
            <RunOrganizations organizations={run.organizations} />
          </>
        )}
      />
    </div>
  );
}
