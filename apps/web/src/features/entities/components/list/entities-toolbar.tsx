'use client';

import { Button, Select } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { ENTITY_STANDING_FILTERS, type EntityView } from '../../tools/entities';
import { ENTITIES_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/**
 * The Index's filter row (§4.6): the standing facet, and *add an entity* at the row's end (project owner, 28 Sep 2026)
 * — where S-16's invitation stands, and where the artboard drew it in the heading instead. The action sits with the
 * list it adds to, and only once the list has been read: a refused or failed read draws neither.
 *
 * **A link, not a button**: the create form is an address of its own (UX-4), so the action is a navigation.
 */
export function EntitiesToolbar({
  standing,
  onStandingChangeAction,
}: {
  readonly standing: EntityView['standing'];
  readonly onStandingChangeAction: (standing: EntityView['standing']) => void;
}) {
  const t = useTranslations(ENTITIES_MESSAGES);

  return (
    <div className={styles.toolbar}>
      <div className={styles.filters}>
        <Select
          label={t('filter.standing')}
          value={standing}
          onValueChange={(next) => onStandingChangeAction(next as EntityView['standing'])}
          options={ENTITY_STANDING_FILTERS.map((option) => ({
            value: option,
            label: t(`filter.options.${option}`),
          }))}
        />
      </div>
      <Button asChild className={styles.toolbarButton}>
        <Link href={ROUTES.ENTITY_NEW}>{t('add')}</Link>
      </Button>
    </div>
  );
}
