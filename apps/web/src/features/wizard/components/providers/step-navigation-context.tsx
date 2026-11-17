'use client';

import { createContext, use, useCallback, useMemo, useTransition, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';

type StepHref = Parameters<ReturnType<typeof useRouter>['push']>[0];

/**
 * A step change in flight (task 244): S-07's *loading — refresh*, the step on screen kept visible and marked busy from
 * the press until the next step commits.
 *
 * **Why the press has to answer at once.** The step's read gates its own shell — a module the report does not carry is
 * a 404, which a route-level boundary would flush past as a 200 (`[module]/page.tsx` says why it has no `loading.tsx`) —
 * so nothing of the next step can be drawn early, and a step change left the old step looking idle throughout. A
 * transition around the navigation gives the press its answer without a boundary: `isPending` holds from the push until
 * the new step commits.
 *
 * Every link that changes the step goes through `StepLink`, so one provider per step screen — S-07's and S-09's — is
 * where the flag lives, and `StepBody` is the one region that shows it.
 */
export interface StepNavigation {
  /** A step change is in flight, from the press until the next step commits. */
  readonly pending: boolean;
  readonly go: (href: StepHref) => void;
}

const StepNavigationContext = createContext<StepNavigation | null>(null);

export function StepNavigationProvider({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = useCallback((href: StepHref) => startTransition(() => router.push(href)), [router]);
  const value = useMemo<StepNavigation>(() => ({ pending, go }), [pending, go]);
  return <StepNavigationContext.Provider value={value}>{children}</StepNavigationContext.Provider>;
}

/** The step change in flight — and, outside a step screen, a plain push with nothing pending. */
export function useStepNavigation(): StepNavigation {
  const value = use(StepNavigationContext);
  const router = useRouter();
  return value ?? { pending: false, go: (href) => router.push(href) };
}
