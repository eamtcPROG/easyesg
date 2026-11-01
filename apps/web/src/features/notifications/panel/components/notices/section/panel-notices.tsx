'use client';

import type { NoticeShow } from '../../../../shared/tools/notice-list-query';
import { NOTICE_ARM, noticeArm } from '../../../../shared/tools/notice-arm';
import { PanelList } from '../list/panel-list';
import { PanelFirstUse } from '../states/panel-first-use';
import { PanelLoading } from '../states/panel-loading';
import { PanelNothingUnread } from '../states/panel-nothing-unread';
import { PanelUnreachable } from '../states/panel-unreachable';
import { usePanelNotices } from './use-panel-notices';

/**
 * The panel's notices: the read for the view shown, and which arm it is in (task 50.2.2; UC-165).
 *
 * **Mounted only while the panel is open** — Radix renders the content on opening — so the read happens then and not
 * on every navigation. **The empty state is the Index archetype's choice** (`shared/tools/notice-arm.ts`), exactly
 * as S-26's is: *nothing has arrived yet* and *nothing unread* stay two states.
 */
export function PanelNotices({
  organizationId,
  show,
  onShowAll,
}: {
  readonly organizationId: string;
  readonly show: NoticeShow;
  readonly onShowAll: () => void;
}) {
  const { data, refetch } = usePanelNotices({ organizationId, show });

  if (data === undefined) return <PanelLoading />;
  if (data === null) return <PanelUnreachable onRetry={() => void refetch()} />;

  const arm = noticeArm(data);
  if (arm === NOTICE_ARM.FIRST_USE) return <PanelFirstUse />;
  if (arm === NOTICE_ARM.NOTHING_UNREAD) return <PanelNothingUnread onShowAll={onShowAll} />;
  return <PanelList notices={data.items} />;
}
