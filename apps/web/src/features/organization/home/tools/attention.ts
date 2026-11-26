import type { Invitation } from '@easyesg/contracts';
import { OVERVIEW_STANDING, attentionRows, type OverviewRow } from './overview';

/**
 * *What needs my attention*, as the artboard draws it (task 255): one item per thing to act on, each with a mark whose
 * tone says how pressing it is, a sentence, and the one way on.
 *
 * **Two sources, one list** — the filings somebody still has work to do on (`attentionRows`, unchanged) and, for an
 * Organization Administrator, the invitations nobody has accepted (`GET /invitations`), which is the artboard's third
 * item and the project owner's choice for this task. Each item's *concern* is what decides its words and its tone,
 * and it is a closed vocabulary here rather than a branch in the component, so every arm is a unit spec.
 */
export const ATTENTION_CONCERN = {
  /** The due date has passed and the filing is not settled — the attention list's most pressing case. */
  OVERDUE: 'overdue',
  /** A report whose last check left answers needing a fix: it cannot be marked ready until they are resolved. */
  FINDINGS: 'findings',
  /** A period nobody has opened a report against. */
  NOT_STARTED: 'not_started',
  /** A report under way with nothing outstanding from its last check, or none run yet. */
  IN_PROGRESS: 'in_progress',
  /** A report every check has passed, waiting to be exported and filed. */
  READY_TO_FILE: 'ready_to_file',
  /** An invitation sent and not yet accepted, its link still working. */
  INVITATION_PENDING: 'invitation_pending',
  /** An invitation whose link has lapsed; it still holds the address, and resending it restores a working link. */
  INVITATION_LAPSED: 'invitation_lapsed',
} as const;

export type AttentionConcern = (typeof ATTENTION_CONCERN)[keyof typeof ATTENTION_CONCERN];

/** The concerns a filing can raise — the item a filing's words are chosen for. */
export type FilingConcern = Exclude<
  AttentionConcern,
  typeof ATTENTION_CONCERN.INVITATION_PENDING | typeof ATTENTION_CONCERN.INVITATION_LAPSED
>;

/** The concerns an invitation can raise. */
export type InvitationConcern = Exclude<AttentionConcern, FilingConcern>;

/** The mark's four tones — the artboard's `×`, `!`, `→` and a settled `✓`. */
export const ATTENTION_TONE = {
  ERROR: 'error',
  ATTENTION: 'attention',
  NEUTRAL: 'neutral',
  OK: 'ok',
} as const;

export type AttentionTone = (typeof ATTENTION_TONE)[keyof typeof ATTENTION_TONE];

/**
 * **Red where the report cannot move until something is done** — a passed deadline, answers needing a fix — as the
 * artboard's B3 item is; amber for a lapsed link, which is a warning about the invitation rather than about a filing;
 * the neutral arrow for work that is simply waiting; and a settled mark for a report ready to file. Exhaustive by
 * `Record`, so a concern added above fails here rather than rendering with no tone.
 */
export const ATTENTION_TONE_OF: Readonly<Record<AttentionConcern, AttentionTone>> = {
  [ATTENTION_CONCERN.OVERDUE]: ATTENTION_TONE.ERROR,
  [ATTENTION_CONCERN.FINDINGS]: ATTENTION_TONE.ERROR,
  [ATTENTION_CONCERN.NOT_STARTED]: ATTENTION_TONE.NEUTRAL,
  [ATTENTION_CONCERN.IN_PROGRESS]: ATTENTION_TONE.NEUTRAL,
  [ATTENTION_CONCERN.READY_TO_FILE]: ATTENTION_TONE.OK,
  [ATTENTION_CONCERN.INVITATION_PENDING]: ATTENTION_TONE.NEUTRAL,
  [ATTENTION_CONCERN.INVITATION_LAPSED]: ATTENTION_TONE.ATTENTION,
};

/**
 * What a filing asks of the reader. **A passed deadline outranks everything else about it**, because it is the one
 * fact that is true whatever the report's state and the one the reader can no longer wait on; then a period with no
 * report; then a report ready to file; then one whose last check left findings; and otherwise, work in progress.
 */
export const filingConcern = (row: OverviewRow): FilingConcern => {
  if (row.overdue) return ATTENTION_CONCERN.OVERDUE;
  if (row.reportId === null) return ATTENTION_CONCERN.NOT_STARTED;
  if (row.standing === OVERVIEW_STANDING.READY_TO_FILE) return ATTENTION_CONCERN.READY_TO_FILE;
  if ((row.validation?.outstanding ?? 0) > 0) return ATTENTION_CONCERN.FINDINGS;
  return ATTENTION_CONCERN.IN_PROGRESS;
};

/**
 * Whether an invitation's link still works. **`now` is a parameter**, as `toOverviewRows`' is, so *lapsed* is a unit
 * spec rather than a test waiting for a date; the api keeps a lapsed invitation listed because it holds the address
 * (`GET /invitations`), so lapsing changes the item's words and never removes it.
 */
export const invitationConcern = (input: {
  readonly invitation: Pick<Invitation, 'expiresAt'>;
  readonly now: number;
}): InvitationConcern =>
  input.invitation.expiresAt <= input.now
    ? ATTENTION_CONCERN.INVITATION_LAPSED
    : ATTENTION_CONCERN.INVITATION_PENDING;

export const ATTENTION_ITEM_KIND = { FILING: 'filing', INVITATION: 'invitation' } as const;

/** One item of the list, before it is worded. */
export type AttentionItem =
  | { readonly kind: typeof ATTENTION_ITEM_KIND.FILING; readonly concern: FilingConcern; readonly row: OverviewRow }
  | {
      readonly kind: typeof ATTENTION_ITEM_KIND.INVITATION;
      readonly concern: InvitationConcern;
      readonly invitation: Invitation;
    };

/**
 * The list, in order: **the filings first, in `attentionRows`' order** — soonest deadline first, which is UX-6's own
 * question — **then the invitations, the one lapsing soonest first**. A filing is the screen's subject and an
 * invitation a fact about the people who work on it, so no invitation is placed between two filings however close
 * its expiry.
 */
export const attentionItems = (input: {
  readonly rows: readonly OverviewRow[];
  readonly invitations: readonly Invitation[];
  readonly now: number;
}): readonly AttentionItem[] => [
  ...attentionRows(input.rows).map(
    (row): AttentionItem => ({ kind: ATTENTION_ITEM_KIND.FILING, concern: filingConcern(row), row }),
  ),
  ...[...input.invitations]
    .sort((left, right) => left.expiresAt - right.expiresAt || left.email.localeCompare(right.email))
    .map(
      (invitation): AttentionItem => ({
        kind: ATTENTION_ITEM_KIND.INVITATION,
        concern: invitationConcern({ invitation, now: input.now }),
        invitation,
      }),
    ),
];
