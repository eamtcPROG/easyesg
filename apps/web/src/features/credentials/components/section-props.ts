import type { ApiOutcome } from '@/lib/api-outcome';

/**
 * What every S-28 section receives (task 27.7).
 *
 * The screen owns the state — which section is acting, what the last one said — and each section
 * owns its own form. `onSettled` takes the outcome **and the success text**, because only the
 * section knows what its own success means: "your password was changed" is not something the
 * screen can compose, and passing the localized sentence up is what keeps `packages/ui`'s rule
 * (no text) and this app's rule (one place decides what is shown) both true.
 */
export interface CredentialsSectionProps {
  /** True while THIS section is acting — never while another is (S-16's per-row lesson). */
  readonly busy: boolean;
  readonly onStart: () => void;
  readonly onSettled: (
    outcome: ApiOutcome<unknown>,
    success: { readonly title: string; readonly body: string },
  ) => void;
}
