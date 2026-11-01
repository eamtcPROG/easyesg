/**
 * The issuer an authenticator files a tenant account's second factor under — the name its owner
 * reads on their phone beside the six digits (task 143).
 *
 * **Not the admin realm's `ADMIN_TOTP_ISSUER`**, which this realm used from task 27.2 until task 143
 * because `ManageTotp` borrows `platform/admin/domain/totp.ts`'s primitive. Borrowing the mechanism is
 * right — NFR-65 separates the realms' data, not their algorithms — and borrowing the name was not. It
 * stayed invisible only while nothing drew the URI: a typed key lets a person name the entry
 * themselves, and a scanned one names it for them. A factor enrolled before task 143 keeps working
 * under its old name, since RFC 6238's HMAC never sees the issuer; enrolling again renames it.
 *
 * A name rather than wording, so not a catalogue key: it reads the same in every locale.
 */
export const TENANT_TOTP_ISSUER = 'EasyESG';
