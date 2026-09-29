'use client';

import { Breadcrumb } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { ROUTES } from '@/lib/routes';
import { ENTITIES_MESSAGES } from '../shared/entity-messages';
import { GuardedLink } from './leave-guard';

/**
 * The record's way back to the index it lies beneath — *Reporting entities / Brutăria Lina SRL*, as the S-13 artboard
 * draws it above the title (project owner, 28 Sep 2026: *"the page has no way back to /entities using the UI"*). In
 * both modes: an unsaved entity is a record too, and the create form was the address that had no exit but the band.
 *
 * **The step back is named as the index names itself**, its heading rather than the band's shorter tab, so the link
 * says where it lands. **It asks before leaving unsaved changes**, as the arrow does (`leave-guard.tsx`).
 */
export function EntityBreadcrumb({ current }: { readonly current: string }) {
  const t = useTranslations(ENTITIES_MESSAGES);
  const tChrome = useTranslations('chrome.breadcrumb');

  return (
    <Breadcrumb
      label={tChrome('label')}
      trail={[{ href: ROUTES.ENTITIES, label: t('title') }]}
      current={current}
      linkComponent={GuardedLink}
    />
  );
}
