'use client';

import type { ReviewedField } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { MIGRATION_MESSAGES } from './migration-messages';
import styles from './migration.module.css';

/**
 * The fields the new version touches (task 67.20; 182/40), each by its label and its kind of change — the api names
 * them in the reader's language and leaves off any it cannot name.
 */
export function MigrationFields({ fields }: { readonly fields: readonly ReviewedField[] }) {
  const t = useTranslations(MIGRATION_MESSAGES);
  if (fields.length === 0) return <p className={`t-body ${styles.hint}`}>{t('fields.none')}</p>;
  return (
    <ul className={styles.fields} aria-label={t('fields.title')}>
      {fields.map((field) => (
        <li key={`${field.change}/${field.label}`} className={`t-body ${styles.field}`}>
          <span>{field.label}</span>
          <span className={styles.change}>{t(`fields.change.${field.change}`)}</span>
        </li>
      ))}
    </ul>
  );
}
