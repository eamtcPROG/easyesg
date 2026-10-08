import { Logger } from '@nestjs/common';
import type { ConfigurationHistory } from '@api/infrastructure/configuration/configuration-history.service';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { VALIDATION_RULE_SET_CONFIG_KIND } from '../constants/validation.constants';
import { ValidationRuleSetCatalog } from './validation-rule-set-catalog.service';

const rule = {
  id: 'b1-turnover',
  kind: 'required',
  verdict: 'missing',
  message: 'validation.required',
  fields: [{ element: 'Turnover' }],
};

/**
 * The rule set in force, read as at a date and through the package's reader (task 41.1; FR-73 items 4, 5, 9). What
 * matters most is the direction it fails in: no set, never an empty one, because a run with no rules finds nothing
 * and reads ready to file (§12.5.6's task-41 row (d)).
 */
describe('ValidationRuleSetCatalog (FR-73)', () => {
  let logged: string[] = [];
  const asked: string[] = [];

  const build = (payload: unknown, revision = 3) =>
    new ValidationRuleSetCatalog(
      {
        get: (query: { kind: string; scope: string; on?: string }) => {
          asked.push(`${query.kind}/${query.scope}@${query.on}`);
          return payload === undefined ? undefined : { kind: query.kind, scope: query.scope, revision, payload };
        },
      } as unknown as ConfigurationStore,
      {
        // History holds every published revision; this one answers the one asked for, superseded or not.
        version: (query: { kind: string; scope: string; revision: number }) => {
          asked.push(`${query.kind}/${query.scope}#${query.revision}`);
          return Promise.resolve(
            payload === undefined || query.revision !== revision
              ? undefined
              : { kind: query.kind, scope: query.scope, revision, payload, validFrom: null, validTo: null },
          );
        },
      } as unknown as ConfigurationHistory,
    );

  beforeEach(() => {
    logged = [];
    asked.length = 0;
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads the set in force on the date asked, with its revision', () => {
    expect(build({ rules: [rule] }).inForce({ on: '2026-12-15' })).toEqual({ ruleSet: { rules: [rule] }, revision: 3 });
    expect(asked).toEqual([`${VALIDATION_RULE_SET_CONFIG_KIND}/vsme@2026-12-15`]);
  });

  // "Once" is the per-revision cache: a published revision never changes, so it is read and judged one time.
  it('answers no set, never an empty one, where the set in force cannot be read — and says so once', () => {
    const catalog = build({ rules: [{ ...rule, verdict: 'error' }] });
    expect(catalog.inForce({ on: '2026-12-15' })).toBeNull();
    expect(catalog.inForce({ on: '2026-12-16' })).toBeNull();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('b1-turnover: verdict_not_admitted');
  });

  it('answers no set where none is in force on the date, naming the date', () => {
    expect(build(undefined).inForce({ on: '2026-12-15' })).toBeNull();
    expect(logged[0]).toContain('2026-12-15');
  });

  it('reads a pinned revision by number, from the history rather than the schedule', async () => {
    expect(await build({ rules: [rule] }).pinned({ revision: 3 })).toEqual({ ruleSet: { rules: [rule] }, revision: 3 });
    expect(asked).toEqual([`${VALIDATION_RULE_SET_CONFIG_KIND}/vsme#3`]);
  });

  it('answers no set for a pin naming no published revision, saying so each time', async () => {
    const catalog = build({ rules: [rule] });
    expect(await catalog.pinned({ revision: 9 })).toBeNull();
    expect(await catalog.pinned({ revision: 9 })).toBeNull();
    expect(logged).toHaveLength(2);
  });

  it('answers no set for a pinned revision that cannot be read', async () => {
    expect(await build({ rules: [{ ...rule, verdict: 'error' }] }).pinned({ revision: 3 })).toBeNull();
  });
});
