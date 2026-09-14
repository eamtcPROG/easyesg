import type { DataSource } from 'typeorm';
import type { Run } from './support-access.queries';

/**
 * A `READ ONLY` transaction bound to one organization, on a connection of its own (task 67.9).
 *
 * **For an admin-realm caller that must see one organization exactly as its policies show it** — the
 * support-access ledger asking about a request, before any grant exists. `app.current_org` is bound and
 * `app.current_user` is not: nothing here writes, so there is no member for the field-change trigger to
 * attribute a write to, and a policy that asks for one finds none.
 *
 * `admin-readonly.ts` is the other read an admin-realm request may make, and the two are deliberately not one
 * helper: that one crosses organizations through `BYPASSRLS` and logs an acquisition, this one stays inside
 * one organization's policies and needs no bypass to log.
 */
export async function boundReadOnly<T>(
  dataSource: DataSource,
  organizationId: string,
  work: (run: Run) => Promise<T>,
): Promise<T> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.startTransaction();
    await runner.query('SET TRANSACTION READ ONLY');
    await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', organizationId]);
    const result = await work((sql, parameters) => runner.query(sql, parameters as unknown[]));
    await runner.commitTransaction();
    return result;
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}
