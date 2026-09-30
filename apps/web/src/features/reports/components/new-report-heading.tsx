import { Breadcrumb, PageHeading } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { REPORT_CREATION_MESSAGES, REPORTS_MESSAGES } from './reports-messages';

/**
 * The creation flow's heading with its way back (project owner, 30 Sep 2026): *Reports / New report* above the title,
 * and an arrow before it. This is the convention S-13 set and S-14 took, and the flow had neither: its only exits were
 * *cancel* at the foot of the last decision and the workspace tier. Each step of the trail is named as its page names
 * itself.
 *
 * **The arrow leads up to S-06, not back to wherever the reader came from.** The owner chose this the same day:
 * S-14's arrow does follow its origin (`periods-from.ts`), but here S-06 is where *cancel* already leads and where
 * the breadcrumb's one step leads, so all three ways out agree. A reader who came from S-05 still has the browser's
 * Back.
 *
 * **Nothing in it waits on a read**, unlike S-14's trail, which names its entity. So the section draws it over every
 * arm, and `loading.tsx` draws it before the read answers, and nothing moves when the content arrives. **No leave
 * question**: both choices live in the address, so leaving loses nothing. **Directive-free and not async**, so both
 * render it on the server.
 */
export function NewReportHeading() {
  const t = useTranslations(REPORT_CREATION_MESSAGES);
  const tReports = useTranslations(REPORTS_MESSAGES);
  const tChrome = useTranslations('chrome.breadcrumb');

  return (
    <PageHeading
      breadcrumb={
        <Breadcrumb
          label={tChrome('label')}
          trail={[{ href: ROUTES.REPORTS, label: tReports('title') }]}
          current={t('title')}
          linkComponent={Link}
        />
      }
      back={{ href: ROUTES.REPORTS, label: t('back') }}
      linkComponent={Link}
      title={t('title')}
      summary={t('lede')}
    />
  );
}
