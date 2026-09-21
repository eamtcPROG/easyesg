import type { DataSource } from 'typeorm';

/**
 * Removes a suite's notices and their deliveries, as the owner (task 50.1.1).
 *
 * **Nothing in the product deletes a notice** — NFR-109's retention will, and brings its policy with it — so the
 * `notification` tables carry no `DELETE` policy, and `FORCE ROW LEVEL SECURITY` subjects the owner to that
 * absence: a plain `DELETE` as `esg_migrator` removes nothing and says so quietly (`apps/api/CLAUDE.md`, the task
 * 26.1 note). Neither table has a parent to cascade from, since an organization is referenced by id. So the owner
 * lifts `FORCE` for the one statement, inside a transaction that restores it before committing — DDL is
 * transactional, so no other session ever sees the table unforced.
 */
export const deleteNotificationsOf = async (owner: DataSource, organizationId: string): Promise<void> => {
  const runner = owner.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(`ALTER TABLE notification.notification NO FORCE ROW LEVEL SECURITY`);
    // The deliveries go by the cascade from their notice.
    await runner.query(`DELETE FROM notification.notification WHERE organization_id = $1`, [organizationId]);
    await runner.query(`ALTER TABLE notification.notification FORCE ROW LEVEL SECURITY`);
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
};
