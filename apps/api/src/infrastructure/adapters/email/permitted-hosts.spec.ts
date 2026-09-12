import {
  HOST_STANDING,
  PERMITTED_EMAIL_HOSTS,
  assertPermittedHost,
} from './permitted-hosts';

/**
 * NFR-27's guard, and the reason it is tested rather than trusted.
 *
 * §12.5.2 makes the mail provider an environment value so a swap is configuration rather than code,
 * and task 51.1's row names the consequence in terms: *a config-driven provider is exactly as easy
 * to point somewhere non-compliant as somewhere compliant*. This list is what stops that, so a list
 * that silently admitted anything would leave NFR-27 resting on whoever last edited an environment
 * file — the shape of a rule that matches nothing, which this repository has caught four times.
 */
describe('the permitted mail providers (NFR-27, OQ-17)', () => {
  it('refuses a host that is not in the set', () => {
    expect(() => assertPermittedHost('smtp.sendgrid.net')).toThrow(/not a permitted mail provider/);
  });

  it('names the set in the refusal, because the reader is about to ask', () => {
    expect(() => assertPermittedHost('smtp.example.com')).toThrow(/in-v3\.mailjet\.com/);
    expect(() => assertPermittedHost('smtp.example.com')).toThrow(/smtp\.gmail\.com/);
  });

  it('refuses an unset host rather than defaulting to one', () => {
    expect(() => assertPermittedHost(undefined)).toThrow(/EMAIL_HOST is not set/);
    expect(() => assertPermittedHost('')).toThrow(/EMAIL_HOST is not set/);
  });

  it('admits Mailjet as meeting the requirement', () => {
    expect(assertPermittedHost('in-v3.mailjet.com').standing).toBe(HOST_STANDING.COMPLIANT);
  });

  /**
   * The exception, asserted as an exception. If someone later "tidies" Gmail's standing to
   * `COMPLIANT`, this fails — which is the point: the carve-out is a recorded decision with an end
   * condition, and a type that stopped saying so would quietly make it permanent.
   */
  it('admits Gmail while stating that it does NOT meet the requirement', () => {
    const gmail = assertPermittedHost('smtp.gmail.com');
    expect(gmail.standing).toBe(HOST_STANDING.NON_COMPLIANT);
    expect(gmail.because).toMatch(/OQ-17/);
    expect(gmail.because).toMatch(/third-country access law/);
  });

  /**
   * Every non-compliant entry must carry its reason, so the boot warning can never be empty. This
   * is written over the whole set rather than over Gmail alone, so a second exception added later
   * inherits the obligation instead of relying on whoever adds it having read this file.
   */
  it('makes every exception explain itself', () => {
    // Jest's `expect` takes no message argument, so the host travels in the compared value
    // instead — a failure then reads `['smtp.gmail.com: 12 chars'] toEqual []` and names itself.
    const unexplained = Object.entries(PERMITTED_EMAIL_HOSTS)
      .filter(([, entry]) => entry.standing === HOST_STANDING.NON_COMPLIANT)
      .filter(([, entry]) => entry.because.length <= 40)
      .map(([host, entry]) => `${host}: ${entry.because.length} chars`);
    expect(unexplained).toEqual([]);
  });

  /**
   * The set is small on purpose and its size is the claim: NFR-27 bounds it, so growth is an
   * amendment rather than an environment edit. This fails when an entry is added, which is the
   * moment someone should be made to write the rationale down.
   */
  it('holds exactly the two providers the documents record', () => {
    expect(Object.keys(PERMITTED_EMAIL_HOSTS).sort()).toEqual([
      'in-v3.mailjet.com',
      'smtp.gmail.com',
    ]);
  });
});
