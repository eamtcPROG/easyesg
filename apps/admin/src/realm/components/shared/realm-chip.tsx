/**
 * The realm's chip — `ADMIN`, beside the wordmark — saying *a separate realm* before anything else
 * on the surface does.
 *
 * **In `components/shared/` on one test: is it read by more than one surface?** The Focus layout
 * (`app/routes/_focus.tsx`, A-01's dark header) and the console chrome (`chrome/console-chrome.tsx`)
 * both draw it, so it sits where both can reach it. It moved here from `_focus.tsx` with task 67.1,
 * when the chrome became its second reader.
 *
 * **Not an inventory addition**: it has no states, no variants and no props but its colours. **The
 * colours are the caller's** because the two surfaces read two token families — `--focus-header-*`
 * and `--consolebar-*` — and a tone prop here would be this app growing a vocabulary for a picture of
 * a word.
 *
 * "ADMIN" is the realm's proper name, like the wordmark: identity rather than copy, so no catalogue
 * owns it (`BrandMark`'s precedent for the untranslated wordmark).
 */
const REALM_CHIP = 'ADMIN';

export function RealmChip({ className }: { readonly className: string }) {
  return (
    <span
      className={`t-code rounded-[2px] border px-[6px] py-[2px] text-[9.5px] uppercase tracking-[0.16em] ${className}`}
    >
      {REALM_CHIP}
    </span>
  );
}
