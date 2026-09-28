import type { WorkspaceNavItem } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { WorkspaceSection } from './workspace-sections';

/**
 * The sections as `packages/ui`'s band and drawer take them — each named, and a locked one carrying what a screen
 * reader hears after its name (task 173).
 *
 * **One mapping for the two surfaces that draw the inventory's items**, because each had its own `.map` resolving the
 * label, and the lock would have been the second thing the two copies had to agree on. The account rail draws its
 * own rows and resolves its words beside them.
 */
export function useWorkspaceItems(sections: readonly WorkspaceSection[]): WorkspaceNavItem[] {
  const t = useTranslations('chrome.workspaceNav');

  return sections.map(({ key, href, locked }) =>
    locked ? { key, href, label: t(key), lockedNote: t('lockedNote') } : { key, href, label: t(key) },
  );
}
