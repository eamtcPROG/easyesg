import { CALLOUT_INTENT } from '@easyesg/ui';
import { MEMBERSHIP_ROLE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { ACCESS_ROW_KIND, ACCESS_STANDING, type AccessRow } from './access';
import {
  ACCESS_EVENT,
  CONFIRMATION,
  INITIAL_ACCESS_STATE,
  accessReducer,
  type AccessState,
  NOTICE_REGION,
  type PlacedNotice,
} from './access-state';

/**
 * The screen's transitions, as a function.
 *
 * This is what the reducer bought beyond batching: every branch names the whole next state, so a
 * field left stale is a line someone can point at — and two were. Both are asserted below, and
 * neither was reachable from a browser journey without contriving the timing.
 */
const ROW: AccessRow = {
  kind: ACCESS_ROW_KIND.INVITATION,
  standing: ACCESS_STANDING.INVITED,
  emailSuppressed: false,
  id: 'i-1',
  email: 'bogdan@example.md',
  role: MEMBERSHIP_ROLE.EDITOR,
  issuedAt: 1_780_000_000_000,
  expiresAt: 1_780_500_000_000,
};

const NOTICE: PlacedNotice = {
  // The screen holds ONE notice and it carries where it renders: the list reports row actions at
  // its head, the invite dialogue reports a refusal beside its form. Two settled outcomes on screen at
  // once is unrepresentable, which is what this field bought (28 Aug 2026).
  region: NOTICE_REGION.LIST,
  intent: CALLOUT_INTENT.SUCCESS,
  title: 'Invitația a fost trimisă.',
  body: 'Lista de mai sus arată deja situația nouă.',
  action: 'Nu mai aveți nimic de făcut.',
};

const settled = (state: AccessState) =>
  accessReducer(state, { type: ACCESS_EVENT.ACTION_SETTLED, notice: NOTICE });

describe('accessReducer', () => {
  it('clears the invite dialogue\'s notice when a row action starts', () => {
    // The defect this field was added for (28 Aug 2026). The panel used to hold its outcome in a
    // `useState` of its own, outside this reducer, so "the invitation has been sent" survived a
    // removal starting — which is the exact case ACTION_STARTED was written to prevent, described
    // in those words, and prevented only for the list's own notice.
    const showing: AccessState = {
      ...INITIAL_ACCESS_STATE,
      notice: { ...NOTICE, region: NOTICE_REGION.INVITE },
    };

    expect(
      accessReducer(showing, { type: ACCESS_EVENT.ACTION_STARTED, rowKey: 'm-1' }).notice,
    ).toBeNull();
  });

  it('clears the list\'s notice when the invite form submits', () => {
    // The other direction, and the one the browser suite had been tolerating with
    // `getByRole(\'alert\').first()`: two settled outcomes on screen at once, from two actions.
    const next = accessReducer(
      { ...INITIAL_ACCESS_STATE, notice: NOTICE },
      { type: ACCESS_EVENT.ACTION_STARTED, rowKey: null },
    );

    expect(next.notice).toBeNull();
    expect(next.pendingRowKey).toBeNull();
  });

  it('starts with nothing running, nothing asked and nothing said', () => {
    expect(INITIAL_ACCESS_STATE).toEqual({
      notice: null,
      confirming: null,
      pendingRowKey: null,
      inviting: false,
    });
  });

  it('opens the dialogue on a request', () => {
    const state = accessReducer(INITIAL_ACCESS_STATE, {
      type: ACCESS_EVENT.CONFIRMATION_REQUESTED,
      confirmation: { kind: CONFIRMATION.REVOKE, row: ROW },
    });

    expect(state.confirming).toEqual({ kind: CONFIRMATION.REVOKE, row: ROW });
  });

  it('closes it on a dismissal, leaving everything else where it was', () => {
    const asked = accessReducer(INITIAL_ACCESS_STATE, {
      type: ACCESS_EVENT.CONFIRMATION_REQUESTED,
      confirmation: { kind: CONFIRMATION.REMOVE, row: ROW },
    });

    expect(accessReducer(asked, { type: ACCESS_EVENT.CONFIRMATION_DISMISSED })).toEqual(
      INITIAL_ACCESS_STATE,
    );
  });

  it('marks the acting row, and only that row', () => {
    const state = accessReducer(INITIAL_ACCESS_STATE, {
      type: ACCESS_EVENT.ACTION_STARTED,
      rowKey: 'invitation:i-1',
    });

    expect(state.pendingRowKey).toBe('invitation:i-1');
  });

  /**
   * One event, three fields — the case the three `useState` setters were spelling out by hand, and
   * the reason this is a reducer.
   */
  it('settles everything at once: the outcome shown, nothing running, nothing asked', () => {
    const running = accessReducer(
      accessReducer(INITIAL_ACCESS_STATE, {
        type: ACCESS_EVENT.CONFIRMATION_REQUESTED,
        confirmation: { kind: CONFIRMATION.REVOKE, row: ROW },
      }),
      { type: ACCESS_EVENT.ACTION_STARTED, rowKey: 'invitation:i-1' },
    );

    expect(settled(running)).toEqual({
      notice: NOTICE,
      confirming: null,
      pendingRowKey: null,
      inviting: false,
    });
  });

  /**
   * The first defect writing the whole state exposed: the previous action's outcome must not sit
   * above a row that is currently changing. Three separate setters left it there, because nothing
   * asked what `notice` should be while an action ran.
   */
  it('clears the last outcome when the next action starts', () => {
    const reported = settled(INITIAL_ACCESS_STATE);
    expect(reported.notice).not.toBeNull();

    const running = accessReducer(reported, {
      type: ACCESS_EVENT.ACTION_STARTED,
      rowKey: 'member:m-2',
    });

    expect(running.notice).toBeNull();
    expect(running.pendingRowKey).toBe('member:m-2');
  });

  /**
   * The second: a success callout from one action framing a dialogue asking about a different one
   * reads as though the two are connected.
   */
  it('clears the last outcome when a new decision is asked for', () => {
    const reported = settled(INITIAL_ACCESS_STATE);

    const asking = accessReducer(reported, {
      type: ACCESS_EVENT.CONFIRMATION_REQUESTED,
      confirmation: { kind: CONFIRMATION.REMOVE, row: ROW },
    });

    expect(asking.notice).toBeNull();
    expect(asking.confirming).not.toBeNull();
  });

  /** A row action opens no dialogue, so settling has none to close — and must not mind. */
  it('settles cleanly when no dialogue was open', () => {
    const running = accessReducer(INITIAL_ACCESS_STATE, {
      type: ACCESS_EVENT.ACTION_STARTED,
      rowKey: 'invitation:i-1',
    });

    expect(settled(running).confirming).toBeNull();
  });

  /** An outcome settling is not the address changing: the dialogue stays as the address has it. */
  it('leaves the dialogue as it was when an action settles', () => {
    const open = accessReducer(INITIAL_ACCESS_STATE, { type: ACCESS_EVENT.INVITE_OPENED });

    expect(settled(open).inviting).toBe(true);
  });
});

/**
 * The invite dialogue's two edges (28 Sep 2026). Whatever opened or closed it — the button, the close
 * control, Back — the provider turns the address changing into one of these, so the rules live here.
 */
describe('accessReducer · the invite dialogue', () => {
  const REFUSAL: PlacedNotice = {
    region: NOTICE_REGION.INVITE,
    intent: CALLOUT_INTENT.ERROR,
    title: 'Există deja o invitație în așteptare pentru această adresă.',
    body: 'Invitația trimisă anterior este încă valabilă.',
    action: 'Închideți fereastra, găsiți persoana în listă și alegeți ce faceți mai departe.',
  };

  it('opens clear of whatever the last action said', () => {
    const opened = accessReducer(settled(INITIAL_ACCESS_STATE), {
      type: ACCESS_EVENT.INVITE_OPENED,
    });

    expect(opened).toEqual({ ...INITIAL_ACCESS_STATE, inviting: true });
  });

  /**
   * The case the edge exists for: a refusal, the dialogue closed, then reopened by Forward. An event
   * sent only by the button would have shown the old refusal above a form that is now empty.
   */
  it('takes a refusal with it when it closes, so reopening shows none', () => {
    const refused = accessReducer(
      accessReducer(INITIAL_ACCESS_STATE, { type: ACCESS_EVENT.INVITE_OPENED }),
      { type: ACCESS_EVENT.ACTION_SETTLED, notice: REFUSAL },
    );
    const closed = accessReducer(refused, { type: ACCESS_EVENT.INVITE_CLOSED });

    expect(closed.notice).toBeNull();
    expect(accessReducer(closed, { type: ACCESS_EVENT.INVITE_OPENED }).notice).toBeNull();
  });

  /** A sent invitation reports at the list's head and then closes the dialogue: the success stays. */
  it('keeps the list\'s notice when it closes', () => {
    const sent = accessReducer(
      accessReducer(INITIAL_ACCESS_STATE, { type: ACCESS_EVENT.INVITE_OPENED }),
      { type: ACCESS_EVENT.ACTION_SETTLED, notice: NOTICE },
    );

    expect(accessReducer(sent, { type: ACCESS_EVENT.INVITE_CLOSED })).toEqual({
      ...INITIAL_ACCESS_STATE,
      notice: NOTICE,
    });
  });
});
