/**
 * The window a support request spends (task 77; FR-212 behaviour 4; `architecture.md` §12.5.6's task-77 row (6)) —
 * five in fifteen minutes, `admitAuthAttempt`'s values, **per sender**: the account for a signed-in reader, the
 * lower-cased address for a visitor. **Never the address of origin**, which is the proxy's until task 71 sets
 * `trust proxy`, so a key carrying it would hold every visitor to one budget.
 *
 * Its own path segment, so a sender's requests and their sign-in attempts never spend each other's window.
 */
export const supportRequestThrottleKey = (
  sender: { readonly accountId: string } | { readonly email: string },
): string => ('accountId' in sender ? `support-request:account/${sender.accountId}` : `support-request:address/${sender.email.toLowerCase()}`);
