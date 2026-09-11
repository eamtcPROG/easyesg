import { Button, EmptyState } from '@easyesg/ui';
import type { AccountMembership } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { mayWrite } from '@/server/memberships';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { HomeRegion } from '../../shared/home-region';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';

/**
 * §8.1's `empty — first use` for the whole overview: the organization has no reporting period at
 * all, so none of UX-6's three questions has anything to answer.
 *
 * **It teaches the object and offers the one action that creates it**, which is what the state model
 * requires of a first-use empty and what separates it from a bare "no data".
 *
 * **The offer is the entities screen, not a period form.** A period is opened against an entity
 * (FR-21), so an organization with no entity cannot be sent straight to one — the honest next step
 * is one level back.
 *
 * **It borrows the *everything* heading rather than inventing one**, because that is the question it
 * is answering: a reader with nothing yet is being told the state of everything, and everything is
 * empty. A fourth heading would name a region that does not exist once there is data.
 */
export async function OverviewEmpty({
  membership,
}: {
  readonly membership: AccountMembership | null;
}) {
  const t = await getTranslations(OVERVIEW_MESSAGES);
  const canWrite = mayWrite(membership);

  return (
    <HomeRegion heading={t('everything.heading')}>
      <EmptyState
        title={t('empty.title')}
        action={
          // FR-25: a view-only membership sees the same teaching and is offered no write.
          canWrite ? (
            <Button asChild>
              <Link href={ROUTES.ENTITIES}>{t('empty.action')}</Link>
            </Button>
          ) : null
        }
      >
        {t('empty.body')}
      </EmptyState>
    </HomeRegion>
  );
}
