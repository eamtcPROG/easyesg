import { useQuery } from '@tanstack/react-query';
import { SUPPORT_ACCESS_STATE } from '@easyesg/contracts';
import { Panel } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { REALM_READ } from '~/realm/tools/realm-read';
import { supportAccessLogQuery } from '../../../queries/support-access';
import { readLogOutcome } from '../../../tools/support-access-read';
import {
  withGrant,
  withModule,
  withReport,
  type SupportAccessSearch,
} from '../../../tools/support-access-search';
import { GrantEnded } from '../states/grant-ended';
import { GrantGone } from '../states/grant-gone';
import { GrantHeading } from '../regions/grant-heading';
import { GrantModules } from '../regions/grant-modules';
import { GrantReports } from '../regions/grant-reports';
import { GrantStep } from '../regions/grant-step';

/**
 * The organization's reports under a running grant (task 67.9; UC-85; FR-77 … FR-79) — A-07's exit, *the
 * organization's reports, read-only, for the granted window*, with **its own countdown above them** (UX-124).
 *
 * **The grant is found on the log's first page, which the in-progress region already read**, so opening it costs no
 * logged read of its own; the reports, a report's modules and a module's values are then each one read, logged by
 * the api before it answers. **What this region checks is what it can show honestly**: a grant that is not running
 * says it ended, and one that is not on the page or not this operator's says it is not in progress — the api refuses
 * the reads in both cases whatever this region draws.
 *
 * Loading and the screen's refusals are the in-progress region's to draw; this draws nothing until that read has
 * answered.
 */
export function GrantSection({
  search,
  operatorId,
  onSearchChange,
}: {
  readonly search: SupportAccessSearch;
  readonly operatorId: string;
  readonly onSearchChange: (next: SupportAccessSearch) => void;
}) {
  const t = useTranslations('platform.supportAccess.grant');
  const query = useQuery(supportAccessLogQuery(1));

  if (search.request === undefined || query.data === undefined) return null;
  const read = readLogOutcome({ outcome: query.data, page: 1 });
  if (read.kind !== REALM_READ.READY) return null;

  const close = () => onSearchChange(withGrant(search, null));
  const entry = read.page.rows.find((row) => row.id === search.request);
  if (entry === undefined || entry.requesterId !== operatorId) return <GrantGone onClose={close} />;
  if (entry.state !== SUPPORT_ACCESS_STATE.ACTIVE || entry.expiresAt === null) return <GrantEnded onClose={close} />;

  const grant = { organizationId: entry.organizationId, requestId: entry.id };

  return (
    <section aria-label={t('region')}>
      <Panel className="flex flex-col gap-[var(--space-4)] p-[var(--space-5)]">
        <GrantHeading entry={entry} expiresAt={entry.expiresAt} onClose={close} />
        {search.report === undefined ? (
          <GrantReports grant={grant} onClose={close} onOpen={(reportId) => onSearchChange(withReport(search, reportId))} />
        ) : search.module === undefined ? (
          <GrantModules
            grant={grant}
            reportId={search.report}
            onClose={close}
            onOpen={(module) => onSearchChange(withModule(search, module))}
            onBack={() => onSearchChange(withReport(search, null))}
          />
        ) : (
          <GrantStep
            grant={grant}
            reportId={search.report}
            module={search.module}
            onClose={close}
            onBack={() => onSearchChange(withModule(search, null))}
          />
        )}
      </Panel>
    </section>
  );
}
