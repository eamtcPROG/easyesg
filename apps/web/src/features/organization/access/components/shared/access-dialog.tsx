'use client';

import { Callout, Dialog } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { AccessPanel } from '../../tools/access-panel';
import { PANEL_NOTICE_REGION } from '../../tools/access-state';
import { useAccess } from './access-context';

/**
 * S-16's two form dialogues (28 Sep 2026, project owner): the invitation and the reminder open over the
 * list, each while the address names it (`access-panel.ts`).
 *
 * **What every arm of either shares, and nothing an arm decides**: open when the address says so, the
 * close control, and the screen's notice where it is this dialogue's — a refusal, said above the form
 * that was refused. The caller gives the title and fills the body; only a form has a closing row,
 * because only a form has something to press.
 *
 * **In `components/shared/` on one test: is it read by more than one sibling?** `invite/` frames its
 * form and both seat states in it, and `remind/` its form, its three states and its loading state. It
 * sat in `invite/shared/` until the reminder became a dialogue and was its second reader.
 *
 * **Not an inventory addition.** §11.5's `Dialog` is the component; this is one screen's composition of
 * it with the screen's address and notice, with no props but which dialogue it is and its slots.
 */
export function AccessDialog({
  panel,
  title,
  footer,
  children,
}: {
  readonly panel: AccessPanel;
  readonly title: string;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}) {
  const tDialog = useTranslations('chrome.dialog');
  const { panel: open, closePanel, notice } = useAccess();

  return (
    <Dialog
      open={open === panel}
      onClose={closePanel}
      title={title}
      closeLabel={tDialog('close')}
      footer={footer}
    >
      {notice?.region === PANEL_NOTICE_REGION[panel] ? (
        <Callout intent={notice.intent} title={notice.title} action={notice.action}>
          {notice.body}
        </Callout>
      ) : null}
      {children}
    </Dialog>
  );
}
