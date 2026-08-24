import { Button } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * The interim signed-in strip — the operator's email and sign-out, and nothing else: the
 * console twin of `apps/web`'s `SessionStrip`, interim for the same recorded reason. §4.2's
 * real console chrome (navigation, exception-queue badges) lands with the first functional
 * screens (task 67, whose row in docs/task.md owns replacing this). Inventory components only
 * (UX-89); dumb by design — the realm layout wires the mutation, so this renders anywhere.
 */
export function SessionStrip({
  email,
  busy,
  onSignOut,
}: {
  email: string;
  busy: boolean;
  onSignOut: () => void;
}) {
  const t = useTranslations('realm.strip');

  // Tailwind over the token cascade — the console's styling system (globals.css), tier
  // discipline intact: every value below is a token variable, none is a raw pixel.
  return (
    <header className="flex items-center justify-between gap-[var(--space-4)] border-b border-[var(--border-default)] px-[var(--space-6)] py-[var(--space-3)]">
      <span className="t-body">
        {t('signedInAs')} <strong>{email}</strong>
      </span>
      <Button type="button" variant="subtle" busy={busy} onClick={onSignOut}>
        {t('signOut')}
      </Button>
    </header>
  );
}
