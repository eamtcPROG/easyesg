import { describe, expect, it } from 'vitest';
import { COOKIE_CHOICE_EVENT, INITIAL_COOKIE_CHOICE, cookieChoiceReducer, type CookieChoiceState } from './cookie-choice-state';

const after = (...types: (typeof COOKIE_CHOICE_EVENT)[keyof typeof COOKIE_CHOICE_EVENT][]): CookieChoiceState =>
  types.reduce((state, type) => cookieChoiceReducer(state, { type }), INITIAL_COOKIE_CHOICE);

describe('S-31’s state over a page (task 223)', () => {
  it('closes the settings and clears a failure once an answer is recorded', () => {
    expect(
      after(
        COOKIE_CHOICE_EVENT.SETTINGS_OPENED,
        COOKIE_CHOICE_EVENT.ANSWER_SENT,
        COOKIE_CHOICE_EVENT.ANSWER_FAILED,
        COOKIE_CHOICE_EVENT.ANSWER_SENT,
        COOKIE_CHOICE_EVENT.ANSWER_RECORDED,
      ),
    ).toEqual(INITIAL_COOKIE_CHOICE);
  });

  it('keeps the settings open when an answer from them fails, and says so', () => {
    expect(after(COOKIE_CHOICE_EVENT.SETTINGS_OPENED, COOKIE_CHOICE_EVENT.ANSWER_SENT, COOKIE_CHOICE_EVENT.ANSWER_FAILED)).toEqual({
      settingsOpen: true,
      saving: false,
      failed: true,
    });
  });

  it('does not carry the banner’s failure into the settings, nor the settings’ out of them', () => {
    expect(after(COOKIE_CHOICE_EVENT.ANSWER_SENT, COOKIE_CHOICE_EVENT.ANSWER_FAILED, COOKIE_CHOICE_EVENT.SETTINGS_OPENED).failed).toBe(false);
    expect(
      after(COOKIE_CHOICE_EVENT.SETTINGS_OPENED, COOKIE_CHOICE_EVENT.ANSWER_SENT, COOKIE_CHOICE_EVENT.ANSWER_FAILED, COOKIE_CHOICE_EVENT.SETTINGS_CLOSED)
        .failed,
    ).toBe(false);
  });

  it('is saving from the moment an answer is sent until it is settled', () => {
    expect(after(COOKIE_CHOICE_EVENT.ANSWER_SENT).saving).toBe(true);
    expect(after(COOKIE_CHOICE_EVENT.ANSWER_SENT, COOKIE_CHOICE_EVENT.ANSWER_FAILED).saving).toBe(false);
  });
});
