import { useQuery } from '@tanstack/react-query';
import { REPORT_MIGRATION_STATUS, type TaxonomyConsole } from '@easyesg/contracts';
import { Button, DataTable, TextLink } from '@easyesg/ui';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { migrationRunsQuery } from '../../queries/migration-runs';
import { reportsIn, runIsMoving } from '../../tools/run-progress';
import { TaxonomyRegion } from '../shared/taxonomy-region';
import { TaxonomyReadArms } from '../states/taxonomy-read-arms';
import { StartRunDialog } from './start-run-dialog';

/**
 * UC-78's batch half on A-04 (task 67.7; FR-69; 182/42, 182/43): the latest runs, each with what it moved, and the start
 * of a run over the open pair — through UX-123's blast radius in `StartRunDialog`. A run's progress, result and revert
 * are its own page.
 */
export function RunsRegion({
  console,
  pair,
}: {
  readonly console: TaxonomyConsole;
  readonly pair: { readonly from: string; readonly to: string } | null;
}) {
  const t = useTranslations('platform.taxonomy.runs');
  const format = useFormatter();
  const [starting, setStarting] = useState(false);
  const query = useQuery(migrationRunsQuery());
  const templates = pair === null ? [] : (console.versions.find((version) => version.version === pair.to)?.templateVersions ?? []);

  return (
    <TaxonomyRegion id="taxonomy-runs" title={t('title')} lede={t('lede')}>
      {pair === null ? null : (
        <div>
          <Button type="button" onClick={() => setStarting(true)}>
            {t('start', pair)}
          </Button>
        </div>
      )}
      <TaxonomyReadArms
        query={query}
        ready={({ runs }) =>
          runs.length === 0 ? (
            <p className="t-body text-[var(--text-muted)]">{t('empty')}</p>
          ) : (
            <DataTable
              caption={t('caption')}
              rows={runs}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: 'pair',
                  header: t('columns.pair'),
                  cell: (row) => (
                    <TextLink asChild>
                      <Link to="/taxonomy/runs/$runId" params={{ runId: row.id }}>
                        {t('pair', { from: row.from, to: row.to })}
                      </Link>
                    </TextLink>
                  ),
                },
                { key: 'started', header: t('columns.started'), cell: (row) => format.dateTime(new Date(row.requestedAt), 'stamp') },
                { key: 'determination', header: t('columns.determination'), cell: (row) => t(`determinations.${row.determination}`) },
                { key: 'selected', header: t('columns.selected'), cell: (row) => row.selected },
                {
                  key: 'state',
                  header: t('columns.state'),
                  cell: (row) =>
                    row.revertedAt !== null
                      ? t('state.reverted')
                      : runIsMoving(row)
                        ? t('state.moving', { pending: row.pending })
                        : t('state.done', { failed: reportsIn(row.tally, REPORT_MIGRATION_STATUS.FAILED) }),
                },
              ]}
            />
          )
        }
      />
      {pair === null || !starting ? null : (
        <StartRunDialog pair={pair} templates={templates} onClose={() => setStarting(false)} />
      )}
    </TaxonomyRegion>
  );
}
