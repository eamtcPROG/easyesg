import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * What a request to support is about, consumer side (task 77; FR-212; S-34) — the mirror of `apps/api`'s
 * `SUPPORT_TOPIC`, which the api derives its contract enum from and may not import from here (`membership.ts`'s
 * reason). **What it adds over the generated union is the runtime value**: S-34 draws one choice per member and words
 * each by it. Held to the generated enum at compile time, so a topic the api gains and this file lacks fails
 * `pnpm typecheck` here.
 */
export const SUPPORT_TOPIC = {
  REPORTING: 'reporting',
  FINDINGS: 'findings',
  EXPORTS: 'exports',
  ACCESS: 'access',
  BILLING: 'billing',
  OTHER: 'other',
} as const;

export type SupportTopic = (typeof SUPPORT_TOPIC)[keyof typeof SUPPORT_TOPIC];

const TOPICS: readonly string[] = Object.values(SUPPORT_TOPIC);

/** Whether an unvalidated value — a form's field, say — is one of the six. Beside the vocabulary it narrows to. */
export const isSupportTopic = (value: unknown): value is SupportTopic => typeof value === 'string' && TOPICS.includes(value);

export const SUPPORT_TOPIC_MIRRORS_WIRE: SameSet<
  SupportTopic,
  components['schemas']['SubmitSupportRequestDto']['topic']
> = true;
