import type { HelpTopic } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Select, TextField } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { EVERY_TOPIC } from '../../tools/help-library';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from '../shared/help-centre.module.css';

/**
 * S-32's filter and search (§4.7; task 77; UX-4) — **a `GET` form**, so the narrowing is the address: it submits
 * `?topic=…&q=…` to this page, the section reads it on the server, and it works before the page hydrates and with no
 * script at all. A reader's search carries nothing personal, which is why this form, unlike a credential form, may.
 */
export async function HelpFilter({
  topics,
  topic,
  query,
}: {
  readonly topics: readonly HelpTopic[];
  readonly topic: string;
  readonly query: string;
}) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);
  const narrowed = topic !== EVERY_TOPIC || query !== '';

  return (
    <form method="get" role="search" aria-label={t('filter.label')} className={styles.filter}>
      <div className={styles.filterField}>
        <Select
          name="topic"
          label={t('filter.topic')}
          defaultValue={topic}
          options={[
            { value: EVERY_TOPIC, label: t('filter.everyTopic') },
            ...topics.map((entry) => ({ value: entry.key, label: entry.title })),
          ]}
        />
      </div>
      <div className={styles.filterField}>
        <TextField name="q" type="search" label={t('filter.search')} defaultValue={query} />
      </div>
      <Button type="submit" variant={BUTTON_VARIANT.SECONDARY}>
        {t('filter.submit')}
      </Button>
      {narrowed ? (
        <Button asChild variant={BUTTON_VARIANT.SUBTLE}>
          <Link href={ROUTES.HELP_CENTRE}>{t('filter.clear')}</Link>
        </Button>
      ) : null}
    </form>
  );
}
