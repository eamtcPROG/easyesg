/**
 * Recoverable secrets at rest (NFR-61, NFR-69; §12.5.6's secrets-at-rest row, task 27.1).
 *
 * **What this is for, and what it is not.** Almost everything sensitive this platform stores is
 * a one-way hash — `password_hash`, every `token_hash` — and a hash needs no key: it is already
 * unreadable and encrypting it would protect nothing an attacker holding the row could not
 * already do. A handful of values cannot be hashed because the application must read them back:
 * a TOTP secret is the whole of that set today (`identity.admin_account.totp_secret`, task 23's
 * recorded debt), and task 27.2 adds the tenant's. Those are what this port covers.
 *
 * **It lives in the port surface rather than in a module** because its consumers sit in two
 * bounded contexts — `platform/admin` today, `identity` at 27.2 — and a mechanism owned by one
 * of them would be borrowed by the other, which is how a second mechanism eventually appears.
 * One mechanism was the point of scheduling this before 27.2 rather than after.
 *
 * **The seam is real, not decorative.** OQ-13 puts secrets in self-hosted OpenBao from Phase 8;
 * an adapter that fetches the key from the vault — or delegates the operation to it entirely —
 * replaces this one and no caller moves. That is P-7 applied to the one dependency the platform
 * has already decided to acquire.
 */

/**
 * **Both operations are synchronous and that is deliberate.** AES-GCM over a 20-byte secret is
 * microseconds of CPU with no I/O, so a `Promise` here would buy nothing and would oblige every
 * row-mapping function on the read path to become `async` — including the pure ones. A vault
 * adapter that needs the network fetches its key at construction, as `JwtAdminTokens` derives
 * its keys at construction; if a future adapter must call out per operation, that is a change
 * to this signature made with the reason in hand, not one pre-paid for today.
 */
export interface SecretCipher {
  /** The stored representation: `v<n>.<base64url(iv|tag|ciphertext)>`, carrying the version of
   *  the key it was written under so a later rotation can tell one generation from the next. */
  seal(plaintext: string): string;

  /**
   * The secret back, or a **throw**.
   *
   * Deliberately unlike `unsealJson`, which answers `null` for anything it cannot open: a cookie
   * that will not unseal is an ordinary visitor with a stale browser, whereas a secret that will
   * not open is a wrong key, a wrong key version or a corrupt row — an operator misconfiguration.
   * Degrading that to a falsy value would present it as "wrong code" on a sign-in screen and send
   * an operator to re-enrol their authenticator against a database that is fine.
   */
  open(sealed: string): string;
}

export const SECRET_CIPHER = Symbol('SECRET_CIPHER');
