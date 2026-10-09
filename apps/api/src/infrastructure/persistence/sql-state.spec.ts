import { QueryFailedError } from 'typeorm';
import { SQL_STATE, hasSqlState, violatesUniqueIndex } from './sql-state';

/**
 * The two predicates over the error a statement actually throws (task 209). **Each case builds TypeORM's own
 * `QueryFailedError` around a driver error shaped as `pg` raises it**, because both predicates read `code` and
 * `constraint` off the error itself rather than off `driverError` — which holds only while TypeORM copies the driver's
 * properties onto its wrapper. A TypeORM release that stopped would leave every refusal translated by these answering
 * `500`, and this spec is where that shows first.
 */
const failed = (driver: { code: string; constraint?: string }): QueryFailedError =>
  new QueryFailedError('INSERT …', [], Object.assign(new Error('duplicate key value'), driver));

describe('hasSqlState', () => {
  it('reads the SQLSTATE the driver raised, through TypeORM’s wrapper', () => {
    const error = failed({ code: '23P01', constraint: 'reporting_period_no_overlap' });
    expect(hasSqlState(error, SQL_STATE.EXCLUSION_VIOLATION)).toBe(true);
    expect(hasSqlState(error, SQL_STATE.UNIQUE_VIOLATION)).toBe(false);
  });
});

describe('violatesUniqueIndex', () => {
  it('answers a unique violation raised by the named index', () => {
    const error = failed({ code: '23505', constraint: 'account_email_key' });
    expect(violatesUniqueIndex({ error, index: 'account_email_key' })).toBe(true);
  });

  /** The social sign-in store tells its two keys apart by this, and the period store its year from its foreign key. */
  it('does not answer for another index on the same table', () => {
    const error = failed({ code: '23505', constraint: 'provider_identity_subject_key' });
    expect(violatesUniqueIndex({ error, index: 'account_email_key' })).toBe(false);
  });

  it('does not answer for another violation that names the same object', () => {
    const error = failed({ code: '23P01', constraint: 'account_email_key' });
    expect(violatesUniqueIndex({ error, index: 'account_email_key' })).toBe(false);
  });

  it('answers false for anything that is not a driver error, rather than throwing', () => {
    for (const error of [new Error('boom'), null, undefined, '23505', { code: '23505' }]) {
      expect(violatesUniqueIndex({ error, index: 'account_email_key' })).toBe(false);
    }
  });
});
