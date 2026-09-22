'use client';

import { useState } from 'react';
import { NOTICE_SHOW, type NoticeShow } from '../../../shared/tools/notice-list-query';
import { PanelFooter } from '../footer/panel-footer';
import { PanelHeader } from '../header/panel-header';
import { PanelNotices } from '../notices/section/panel-notices';
import { PanelTabs } from '../tabs/panel-tabs';

/**
 * What the open panel holds (task 50.2.2): the header, the views, the notices and the foot — and **the view shown,
 * held here so that every opening starts on *Unread***, as both artboards draw it. Radix unmounts the content when
 * the panel closes, so a state kept here ends with it; kept beside `open`, it would outlive the close and reopen the
 * panel on whatever view was left, which the reader did not ask to keep.
 */
export function PanelContent({
  organizationId,
  titleId,
  unread,
}: {
  readonly organizationId: string;
  readonly titleId: string;
  readonly unread: number | null;
}) {
  const [show, setShow] = useState<NoticeShow>(NOTICE_SHOW.UNREAD);

  return (
    <>
      <PanelHeader titleId={titleId} unread={unread} />
      <PanelTabs show={show} unread={unread} onShow={setShow} />
      <PanelNotices organizationId={organizationId} show={show} onShowAll={() => setShow(NOTICE_SHOW.ALL)} />
      <PanelFooter />
    </>
  );
}
