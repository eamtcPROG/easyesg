import { useQuery } from '@tanstack/react-query';
import { BUTTON_VARIANT, Button, DataTable } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { taxonomyExposureQuery } from '../../queries/taxonomy-console';
import { TaxonomyRegion } from '../shared/taxonomy-region';
import { TaxonomyReadArms } from '../states/taxonomy-read-arms';

/**
 * UC-77's exposure view on A-04 (task 67.6; FR-68; 182/49): every report still pinned to a version older than the newest
 * registered, by version and by organization — counts only, never a value. **Read on request**, because each read
 * crosses every organization through the logged door and leaves a row in the support access log.
 */
export function ExposureRegion() {
  const t = useTranslations('platform.taxonomy.exposure');
  const [asked, setAsked] = useState(false);
  const query = useQuery({ ...taxonomyExposureQuery(), enabled: asked });

  return (
    <TaxonomyRegion id="taxonomy-exposure" title={t('title')} lede={t('lede')}>
      {!asked ? (
        <div>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => setAsked(true)}>
            {t('read')}
          </Button>
        </div>
      ) : (
        <TaxonomyReadArms
          query={query}
          ready={(exposure) =>
            exposure.versions.length === 0 ? (
              <p className="t-body text-[var(--text-muted)]">{t('none', { newest: exposure.newest ?? '' })}</p>
            ) : (
              <>
                <DataTable
                  caption={t('byVersion', { newest: exposure.newest ?? '' })}
                  rows={exposure.versions}
                  rowKey={(row) => row.version}
                  columns={[
                    { key: 'version', header: t('columns.version'), cell: (row) => row.version },
                    { key: 'reports', header: t('columns.reports'), cell: (row) => row.reports },
                    { key: 'organizations', header: t('columns.organizations'), cell: (row) => row.organizations },
                  ]}
                />
                <DataTable
                  caption={t('byOrganization')}
                  rows={exposure.organizations}
                  rowKey={(row) => row.organizationId}
                  columns={[
                    { key: 'name', header: t('columns.organization'), cell: (row) => row.name },
                    {
                      key: 'versions',
                      header: t('columns.versions'),
                      cell: (row) => row.versions.map((version) => t('versionCount', version)).join(' · '),
                    },
                  ]}
                />
              </>
            )
          }
        />
      )}
    </TaxonomyRegion>
  );
}
