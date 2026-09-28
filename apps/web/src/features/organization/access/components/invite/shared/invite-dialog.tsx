'use client';

import { Callout, Dialog } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { NOTICE_REGION } from '../../../tools/access-state';
import { useAccess } from '../../shared/access-context';
import { ACCESS_MESSAGES } from '../../shared/access-messages';

/**
 * S-16's invitation dialogue (28 Sep 2026, project owner): the form opens over the list, from the
 * button at the end of the filter row, and is open while the address says `?panel=invite`.
 *
 * **What every arm shares, and nothing an arm decides**: the title, the close control, and the screen's
 * notice where it is this dialogue's — a refusal, said above the form that was refused. The arm fills
 * the body; only the form has a closing row, because only the form has something to press.
 *
 * **In `invite/shared/` on one test: is it read by more than one sibling?** `section/` frames the two
 * states in it, and `form/` frames itself, because its closing row carries the submit and the submit's
 * pending state is the form's.
 *
 * **Not an inventory addition.** §11.5's `Dialog` is the component; this is one screen's composition of
 * it with a title and a notice, with no props but its two slots.
 */
export function InviteDialog({
  footer,
  children,
}: {
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}) {
  const t = useTranslations(`${ACCESS_MESSAGES}.invite`);
  const tDialog = useTranslations('chrome.dialog');
  const { inviting, closeInvite, notice } = useAccess();

  return (
    <Dialog
      open={inviting}
      onClose={closeInvite}
      title={t('heading')}
      closeLabel={tDialog('close')}
      footer={footer}
    >
      {notice?.region === NOTICE_REGION.INVITE ? (
        <Callout intent={notice.intent} title={notice.title} action={notice.action}>
          {notice.body}
        </Callout>
      ) : null}
      {children}
    </Dialog>
  );
}
