import { EXPORT_STATUS, type ExportStatus } from '@easyesg/contracts';
import { STATUS_TONE, StatusChip, type StatusTone } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';

/** A status's tone: in flight, settled and good, or settled and not. */
const TONE = {
  [EXPORT_STATUS.REQUESTED]: STATUS_TONE.PENDING,
  [EXPORT_STATUS.COMPLETED]: STATUS_TONE.POSITIVE,
  [EXPORT_STATUS.FAILED]: STATUS_TONE.ATTENTION,
} as const satisfies Record<ExportStatus, StatusTone>;

/** A status's words, by literal key, so a status the catalogue does not word fails `pnpm typecheck`. */
const WORDS_KEY = {
  [EXPORT_STATUS.REQUESTED]: 'history.status.requested',
  [EXPORT_STATUS.COMPLETED]: 'history.status.completed',
  [EXPORT_STATUS.FAILED]: 'history.status.failed',
} as const satisfies Record<ExportStatus, string>;

/**
 * An export's standing in the history (task 47.3; UX-49) — in flight, ready or failed, a chip whose words are the
 * catalogue's. No directive: drawn inside the history, a client boundary already.
 */
export function ExportStatusChip({ status }: { readonly status: ExportStatus }) {
  const t = useTranslations(EXPORTS_MESSAGES);
  return <StatusChip tone={TONE[status]}>{t(WORDS_KEY[status])}</StatusChip>;
}
