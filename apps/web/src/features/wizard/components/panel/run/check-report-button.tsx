import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PANEL_MESSAGES } from '../shared/panel-messages';

/**
 * UX-24's primary control — *check my report*, never *submit* (task 42.2). **Busy while a check is in flight or
 * waiting on unsent answers**, so a second press cannot start a second run; the panel's own line says why it waits.
 * Offered only where the reader may run one (182/22) — the section decides that, and passes no control otherwise.
 *
 * No directive: drawn inside the panel's section, a client boundary already, and it reads its own words (task 158).
 */
export function CheckReportButton({ busy, onPress }: { readonly busy: boolean; readonly onPress: () => void }) {
  const t = useTranslations(PANEL_MESSAGES);
  return (
    <Button variant={BUTTON_VARIANT.PRIMARY} onClick={onPress} disabled={busy} aria-busy={busy || undefined}>
      {t('run')}
    </Button>
  );
}
