'use client';

import type { AccountMembership } from '@easyesg/contracts';
import { OrganizationSwitcher, type SwitcherTone } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { useOrganizationSwitch } from './organization-switch-provider';
import { SWITCH_MESSAGES } from './switch-messages';

/**
 * The global tier's organization control (task 83.2) — `OrganizationSwitcher`, given the reader's
 * memberships and the provider's flow. Drawn in the band, and in the compact drawer where UX-2's amendment
 * moves it; `tone` is the only thing that differs.
 *
 * **A Client Component for three reasons, and each is load-bearing.** It reads the provider's context; its
 * note counts unsent answers the server never sees, which needs the catalogue's plural at render; and
 * `closingItem` is slotted into a Radix menu item, which a Server Component's element cannot survive
 * (`account-menu.tsx`'s recorded hazard, and the switcher's docblock repeats it).
 *
 * **It renders nothing without an active organization** — the caller renders it only with one, and S-37 is
 * where a reader without one chooses. The role is the only detail per row, task 30.1's decision, and
 * `organization.access.roles` stays a literal here, as at its other readers, until someone decides the
 * namespace's feature-level home (`shared-namespace-declared-once`).
 */
export function OrganizationCorner({
  memberships,
  tone,
}: {
  readonly memberships: readonly AccountMembership[];
  readonly tone: SwitcherTone;
}) {
  const t = useTranslations(SWITCH_MESSAGES);
  const roles = useTranslations('organization.access.roles');
  const { choose, pendingOrganizationId, unsynced } = useOrganizationSwitch();

  const current = memberships.find((membership) => membership.active);
  if (current === undefined) return null;

  return (
    <OrganizationSwitcher
      label={t('label')}
      organizations={memberships.map((membership) => ({
        key: membership.organizationId,
        name: membership.organizationName,
        detail: roles(membership.role),
      }))}
      currentKey={current.organizationId}
      onChoose={choose}
      pendingKey={pendingOrganizationId}
      note={unsynced > 0 ? t('unsent', { count: unsynced }) : null}
      closingItem={<Link href={ROUTES.CREATE_ORGANIZATION}>{t('create')}</Link>}
      tone={tone}
    />
  );
}
