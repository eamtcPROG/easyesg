import type { DataSource, QueryRunner } from 'typeorm';
import { AdminReadOnly } from './admin-readonly';
import { ACQUISITION_PURPOSE } from '@api/modules/platform/support-access/models/support-access-log.model';

/**
 * `esg_admin_ro`'s acquisition discipline (task 67.3; §7.6): logged first, fail closed, read-only.
 *
 * Unit-level on purpose. The fail-closed branch is the one that matters and the one no e2e can reach
 * without breaking the log table under a running server; here it is a rejected promise. The real
 * insert and the real read are `test/organization-register.e2e-spec.ts`'s.
 */
const ACQUISITION = {
  requesterId: '00000000-0000-7000-8000-00000000aaaa',
  purpose: ACQUISITION_PURPOSE.ORGANIZATION_REGISTER,
  organizationId: null,
} as const;

function harness(options: { logFails?: boolean; readFails?: boolean } = {}) {
  const events: string[] = [];
  let transactionActive = false;

  const runner = {
    connect: jest.fn(() => {
      events.push('connect');
      return Promise.resolve();
    }),
    startTransaction: jest.fn(() => {
      events.push('begin');
      transactionActive = true;
      return Promise.resolve();
    }),
    query: jest.fn((sql: string) => {
      events.push(sql);
      return Promise.resolve([]);
    }),
    commitTransaction: jest.fn(() => {
      events.push('commit');
      transactionActive = false;
      return Promise.resolve();
    }),
    rollbackTransaction: jest.fn(() => {
      events.push('rollback');
      transactionActive = false;
      return Promise.resolve();
    }),
    release: jest.fn(() => {
      events.push('release');
      return Promise.resolve();
    }),
    get isTransactionActive() {
      return transactionActive;
    },
  };

  const readOnly = {
    createQueryRunner: jest.fn(() => {
      events.push('acquire-runner');
      return runner as unknown as QueryRunner;
    }),
  };
  const core = {
    query: jest.fn((_sql: string, parameters: unknown[]) => {
      events.push(`log:${String(parameters[0])}:${String(parameters[3])}`);
      return options.logFails ? Promise.reject(new Error('partition missing')) : Promise.resolve();
    }),
  };

  const reader = new AdminReadOnly(readOnly as unknown as DataSource, core as unknown as DataSource);
  const read = jest.fn(() => {
    events.push('read');
    return options.readFails ? Promise.reject(new Error('read broke')) : Promise.resolve('rows');
  });

  return { reader, read, events, core, readOnly, runner };
}

describe('AdminReadOnly.acquire (§7.6, task 67.3)', () => {
  it('writes the acquisition row before it takes a read connection, then reads read-only and commits', async () => {
    const { reader, read, events } = harness();

    await expect(reader.acquire(ACQUISITION, read)).resolves.toBe('rows');

    expect(events).toEqual([
      'log:acquisition:organization_register',
      'acquire-runner',
      'connect',
      'begin',
      'SET TRANSACTION READ ONLY',
      'read',
      'commit',
      'release',
    ]);
  });

  it('refuses the read when the log write fails — no connection taken, nothing read', async () => {
    const { reader, read, readOnly } = harness({ logFails: true });

    await expect(reader.acquire(ACQUISITION, read)).rejects.toThrow('partition missing');

    expect(readOnly.createQueryRunner).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('keeps the log row when the read fails, and rolls the read back and releases', async () => {
    const { reader, read, events, core } = harness({ readFails: true });

    await expect(reader.acquire(ACQUISITION, read)).rejects.toThrow('read broke');

    expect(core.query).toHaveBeenCalledTimes(1);
    expect(events.slice(-2)).toEqual(['rollback', 'release']);
  });

  it('records the requester, the purpose and the organization as given', async () => {
    const { reader, read, core } = harness();

    await reader.acquire({ ...ACQUISITION, organizationId: '00000000-0000-7000-8000-00000000bbbb' }, read);

    expect(core.query.mock.calls[0][1]).toEqual([
      'acquisition',
      '00000000-0000-7000-8000-00000000aaaa',
      '00000000-0000-7000-8000-00000000bbbb',
      'organization_register',
    ]);
  });
});
