import { COOKIE_POLICY_VERSION_IN_FORCE } from '@easyesg/i18n';
import { describe, expect, it } from 'vitest';
import {
  answersPolicyInForce,
  cookieChoiceExpires,
  cookieChoiceValueIn,
  decodeCookieChoice,
  encodeCookieChoice,
} from './cookie-choice-cookie';

const RECORD = {
  id: '01920000-0000-7000-8000-000000000001',
  policyVersion: COOKIE_POLICY_VERSION_IN_FORCE,
  chosenAt: Date.UTC(2026, 9, 23, 12),
};

describe('the cookie banner’s answer, as the browser keeps it (task 223)', () => {
  it('reads back what it wrote', () => {
    expect(decodeCookieChoice(encodeCookieChoice(RECORD))).toEqual(RECORD);
  });

  it('reads nothing from a value the browser could have changed', () => {
    for (const value of [undefined, '', 'x~1.0~1', `${RECORD.id}~~1`, `${RECORD.id}~1.0~soon`, `${RECORD.id}~1.0~1~2`]) {
      expect(decodeCookieChoice(value)).toBeNull();
    }
  });

  it('finds its value among the others in document.cookie, and nothing where it is absent or malformed', () => {
    const value = encodeCookieChoice(RECORD);
    expect(cookieChoiceValueIn(`NEXT_LOCALE=en; easyesg_cookie_choice=${encodeURIComponent(value)}`)).toBe(value);
    expect(cookieChoiceValueIn('NEXT_LOCALE=en')).toBe('');
    expect(cookieChoiceValueIn('easyesg_cookie_choice=%E0%A4%A')).toBe('');
  });

  it('lapses twelve calendar months on, the day clamped to the month as PostgreSQL clamps it', () => {
    expect(cookieChoiceExpires(RECORD.chosenAt)).toEqual(new Date(Date.UTC(2027, 9, 23, 12)));
    expect(cookieChoiceExpires(Date.UTC(2028, 1, 29, 8))).toEqual(new Date(Date.UTC(2029, 1, 28, 8)));
  });

  it('answers the policy in force only at its version', () => {
    expect(answersPolicyInForce(RECORD)).toBe(true);
    expect(answersPolicyInForce({ ...RECORD, policyVersion: '0.9' })).toBe(false);
    expect(answersPolicyInForce(null)).toBe(false);
  });
});
