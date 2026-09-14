/**
 * What A-19 announces on arrival (task 151) — only a recovery sign-in today, which A-01 sends here
 * whatever `?redirect=` carried. **In the address as a word and nothing else**, `sign-in-notice.ts`'s
 * rule: the count of codes left is A-19's own read, never a number of spare credentials written into
 * a history entry.
 */
export const CREDENTIALS_ARRIVAL = {
  RECOVERED: 'recovered',
} as const;

export type CredentialsArrival = (typeof CREDENTIALS_ARRIVAL)[keyof typeof CREDENTIALS_ARRIVAL];

const isCredentialsArrival = (value: unknown): value is CredentialsArrival =>
  typeof value === 'string' &&
  (Object.values(CREDENTIALS_ARRIVAL) as readonly string[]).includes(value);

export const readCredentialsArrival = (value: unknown): CredentialsArrival | undefined =>
  isCredentialsArrival(value) ? value : undefined;
