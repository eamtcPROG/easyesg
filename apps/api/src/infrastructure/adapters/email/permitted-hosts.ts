/**
 * NFR-27's obligation, made checkable at boot.
 *
 * **Why a list exists at all.** §12.5.2 makes the mail provider an environment value so that a swap
 * is a configuration change rather than a code change — and that property cuts both ways: a
 * config-driven provider is exactly as easy to point somewhere non-compliant as somewhere
 * compliant. Without this, NFR-27's *"at providers not subject to third-country access law"* would
 * rest on whoever last edited an environment file, and nothing would notice.
 *
 * **Gmail is in the list, and it is the interesting entry.** It is not NFR-27-compliant: Google LLC
 * is subject to FISA 702 and the CLOUD Act, which is the third-country access law that requirement
 * names, and verification, reset and invitation mail carries an address and a single-use link. It
 * is here because the project owner took that exception knowingly on 12 Sep 2026
 * (`non_functional_requirements.md` OQ-17), scoped to the mail channel alone and to the
 * pre-production period.
 *
 * **Enumerating the exception is the point.** Skipping the check for Gmail would have been fewer
 * lines and would have left the platform with no guard at all; naming it means a reader meets the
 * exception, `NON_COMPLIANT` says so in the type, and the boot log states it on every start. An
 * exception someone has to delete from a list is one that gets revisited; a disabled check is one
 * nobody sees again.
 */

/** Why a host is permitted. Not a formality: `NON_COMPLIANT` is what the boot warning keys on. */
export const HOST_STANDING = {
  /** Meets NFR-27: EU/EEA, no adequacy decision and no SCCs relied on. */
  COMPLIANT: 'compliant',
  /** Permitted by a recorded, scoped exception rather than by meeting the requirement. */
  NON_COMPLIANT: 'non-compliant',
} as const;

export type HostStanding = (typeof HOST_STANDING)[keyof typeof HOST_STANDING];

interface PermittedHost {
  readonly standing: HostStanding;
  /** Stated in the boot log when the host is non-compliant, so the exception is never silent. */
  readonly because: string;
}

export const PERMITTED_EMAIL_HOSTS: Readonly<Record<string, PermittedHost>> = {
  'in-v3.mailjet.com': {
    standing: HOST_STANDING.COMPLIANT,
    because: 'Mailjet, EU — architecture.md OQ-12',
  },
  'smtp.gmail.com': {
    standing: HOST_STANDING.NON_COMPLIANT,
    because:
      'Gmail is a knowing NFR-27 exception (non_functional_requirements.md OQ-17, 12 Sep 2026): ' +
      'Google LLC is subject to third-country access law, the carve-out covers the mail channel ' +
      'only, and it ends when EMAIL_HOST names a permitted EU provider',
  },
};

/**
 * Throws unless `host` is permitted. Called from the adapter factory, so an unpermitted host fails
 * the boot rather than the first send — §9.1's precedent, where a missing secret takes the tier
 * down instead of letting it run wrong. The message names the set rather than saying "invalid",
 * because the reader's next question is always *what may I use*.
 */
export const assertPermittedHost = (host: string | undefined): PermittedHost => {
  if (!host) {
    throw new Error(
      'EMAIL_HOST is not set, and EMAIL_PROVIDER=smtp requires it. Permitted hosts: ' +
        `${Object.keys(PERMITTED_EMAIL_HOSTS).join(', ')}.`,
    );
  }
  const permitted = PERMITTED_EMAIL_HOSTS[host];
  if (!permitted) {
    throw new Error(
      `EMAIL_HOST is "${host}", which is not a permitted mail provider. NFR-27 bounds this to an ` +
        `enumerated set and the set is: ${Object.keys(PERMITTED_EMAIL_HOSTS).join(', ')}. ` +
        'Adding to it is an amendment to NFR-27 with a recorded rationale, not an environment edit.',
    );
  }
  return permitted;
};
