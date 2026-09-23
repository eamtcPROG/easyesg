/**
 * The form an address is suppressed under (task 51.4; §12.5.6's task-51.4 row).
 *
 * **One function, because two spellings of one mailbox must not be two rows.** A mailbox is not
 * case-sensitive in practice, and `Ana@Example.md` bouncing while `ana@example.md` keeps being written
 * to is the failure FR-171 exists to prevent, arriving as a subtler version of itself. The database
 * carries the same rule as a `CHECK`, so a writer that skips this is refused rather than trusted.
 *
 * **Trimmed and lower-cased, and nothing else.** Not the local part's case-sensitivity that RFC 5321
 * technically permits — no mail system in practice relies on it, and honouring it here would mean
 * suppressing one spelling of a dead mailbox. Not dot-stripping or plus-tag removal either: those are
 * one provider's routing rules, and applying Gmail's to every domain would suppress addresses that
 * never bounced.
 */
export function suppressionKey(address: string): string {
  return address.trim().toLowerCase();
}
