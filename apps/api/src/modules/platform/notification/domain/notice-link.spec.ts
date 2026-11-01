import { noticeLink } from './notice-link';

/** A notice's absolute link (tasks 49.3, 50.1.4). Literals on purpose: they are what an email carries. */
describe('noticeLink (task 50.1.4)', () => {
  it('prefixes the language, the source locale included, against the origin', () => {
    expect(noticeLink({ origin: 'https://app.easyesg.md', path: '/reports/r-1', locale: 'ro' })).toBe(
      'https://app.easyesg.md/ro/reports/r-1',
    );
    expect(noticeLink({ origin: 'https://app.easyesg.md', path: '/verify?token=t', locale: 'ru' })).toBe(
      'https://app.easyesg.md/ru/verify?token=t',
    );
  });

  it('prefixes nothing where the application routes by no language', () => {
    expect(noticeLink({ origin: 'https://admin.easyesg.md', path: '/invitation/t', locale: null })).toBe(
      'https://admin.easyesg.md/invitation/t',
    );
  });

  // A trailing slash on the configured origin must not produce `//ro/…`.
  it('joins an origin carrying a trailing slash cleanly', () => {
    expect(noticeLink({ origin: 'https://app.easyesg.md/', path: '/verify', locale: 'en' })).toBe(
      'https://app.easyesg.md/en/verify',
    );
  });
});
