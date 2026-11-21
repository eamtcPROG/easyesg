import { TextLink } from '@easyesg/ui';
import type { Invitation } from '@easyesg/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import { DEFAULT_ACCESS_VIEW, accessViewQuery } from '@/features/organization/access/tools/access';
import { ATTENTION_CONCERN, ATTENTION_TONE_OF, type InvitationConcern } from '../../../tools/attention';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import { AttentionItem } from './attention-item';

/**
 * An invitation nobody has accepted, on an Organization Administrator's attention list (task 255) — the artboard's
 * *Mihai Ciobanu has not accepted his invitation*, told with what the invitation holds: the address, the role it
 * grants and its two dates. The person has no name until they accept, so the address is the name.
 *
 * **The way on is S-16, opened on that one address** — where resending and withdrawing already live (FR-57), so this
 * screen offers neither act itself. The address is S-16's own search, built by `accessViewQuery`, which owns that
 * screen's URL; spelling its parameter here would be a second copy of S-16's address to drift.
 *
 * **Both dates are instants** (OQ-50), not legal dates — when the link was sent and when it stops working — so they
 * are formatted as instants in the configured zone, which is what the `long` format does.
 */
export async function AttentionInvitation({
  concern,
  invitation,
}: {
  readonly concern: InvitationConcern;
  readonly invitation: Invitation;
}) {
  const [t, tRoles, format] = await Promise.all([
    getTranslations(`${OVERVIEW_MESSAGES}.attention.invitation`),
    getTranslations('organization.access.roles'),
    getFormatter(),
  ]);

  const email = invitation.email;
  const role = tRoles(invitation.role);
  const issued = format.dateTime(new Date(invitation.issuedAt), 'long');
  const expires = format.dateTime(new Date(invitation.expiresAt), 'long');

  const words =
    concern === ATTENTION_CONCERN.INVITATION_LAPSED
      ? { title: t('invitation_lapsed.title', { email }), body: t('invitation_lapsed.body', { role, expires }) }
      : { title: t('invitation_pending.title', { email }), body: t('invitation_pending.body', { role, issued, expires }) };

  return (
    <AttentionItem
      tone={ATTENTION_TONE_OF[concern]}
      title={words.title}
      action={
        <TextLink asChild>
          <Link href={withQuery(ROUTES.ORGANIZATION_USERS, accessViewQuery({ ...DEFAULT_ACCESS_VIEW, q: email }))}>
            {t('action')}
          </Link>
        </TextLink>
      }
    >
      {words.body}
    </AttentionItem>
  );
}
