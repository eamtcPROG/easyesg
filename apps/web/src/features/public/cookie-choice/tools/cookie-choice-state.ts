/**
 * S-31's state over a page (task 223; `design_spec.md` S-31's states): whether the settings are open, whether an answer
 * is on its way, and whether the last one failed. **Three fields moving on five events**, so a reducer rather than three
 * `useState`s — an answer recorded both closes the settings and clears a failure, and a setter per field would leave one
 * of them to whoever remembered.
 *
 * Whether the browser has answered is not here: it is the cookie's, read from `document.cookie`, so a tab that answered
 * in another tab sees it on its next read rather than holding a copy of its own.
 */
export const COOKIE_CHOICE_EVENT = {
  SETTINGS_OPENED: 'settingsOpened',
  SETTINGS_CLOSED: 'settingsClosed',
  ANSWER_SENT: 'answerSent',
  ANSWER_RECORDED: 'answerRecorded',
  ANSWER_FAILED: 'answerFailed',
} as const;

export type CookieChoiceEvent = { readonly type: (typeof COOKIE_CHOICE_EVENT)[keyof typeof COOKIE_CHOICE_EVENT] };

export interface CookieChoiceState {
  readonly settingsOpen: boolean;
  readonly saving: boolean;
  readonly failed: boolean;
}

export const INITIAL_COOKIE_CHOICE: CookieChoiceState = { settingsOpen: false, saving: false, failed: false };

export function cookieChoiceReducer(state: CookieChoiceState, event: CookieChoiceEvent): CookieChoiceState {
  switch (event.type) {
    // Opening the settings is a fresh start: a failure the banner showed is not the panel's to repeat.
    case COOKIE_CHOICE_EVENT.SETTINGS_OPENED:
      return { ...state, settingsOpen: true, failed: false };
    case COOKIE_CHOICE_EVENT.SETTINGS_CLOSED:
      return { ...state, settingsOpen: false, failed: false };
    case COOKIE_CHOICE_EVENT.ANSWER_SENT:
      return { ...state, saving: true, failed: false };
    // Recorded: nothing is left open and nothing is wrong — the banner leaves with the cookie.
    case COOKIE_CHOICE_EVENT.ANSWER_RECORDED:
      return INITIAL_COOKIE_CHOICE;
    // Failed: where the reader answered stays open, and says so.
    case COOKIE_CHOICE_EVENT.ANSWER_FAILED:
      return { ...state, saving: false, failed: true };
  }
}
