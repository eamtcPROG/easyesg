'use client';

import type { ReactNode } from 'react';
import { useStepNavigation } from '../providers/step-navigation-context';
import styles from './step-body.module.css';

/**
 * The step's body while a step change is in flight (task 244): S-07's *loading — refresh*, the prior content kept
 * visible (`design_spec.md` S-07's states), marked busy for assistive technology at once and dimmed after a short delay,
 * so a change that lands quickly does not flash. The children stay the server's; this only frames them.
 */
export function StepBody({ children }: { readonly children: ReactNode }) {
  const { pending } = useStepNavigation();
  return (
    <div aria-busy={pending} className={pending ? styles.refreshing : undefined}>
      {children}
    </div>
  );
}
