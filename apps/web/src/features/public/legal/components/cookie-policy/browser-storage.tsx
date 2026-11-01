import { getTranslations } from 'next-intl/server';
import { BROWSER_STORAGE } from '@/lib/cookie-inventory';
import styles from '../styles/legal.module.css';

/**
 * The browser storage the site keeps that is not a cookie (FR-206 AC-1; 182/122: the inventory names it) — what each
 * store holds and how long, from task 75.2's inventory.
 */
export async function BrowserStorage() {
  const t = await getTranslations('legal.cookies');
  return (
    <ul className={styles.storage}>
      {BROWSER_STORAGE.map((store) => (
        <li key={store.purpose} className={styles.store}>
          <span>{t(`storagePurpose.${store.purpose}`)}</span>
          <span className={styles.storeKind}>{t(`storageKind.${store.kind}`)}</span>
        </li>
      ))}
    </ul>
  );
}
