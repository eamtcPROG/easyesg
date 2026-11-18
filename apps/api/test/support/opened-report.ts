import request from 'supertest';
import type { SignedInAccount } from './signed-in-account';

/**
 * An organization founded over HTTP by a fresh account — its Organization Administrator, and its one membership, so
 * the session binds it — with a period for a fiscal year and that period's report (tasks 67.22 … 67.24). **The year
 * decides the pin**: a period starting before 2026-01-01 pins `2026-02-01`, one on or after it `2026-05-01`
 * (`reporting-taxonomy.vsme.json`), which is how the migration suites put a report on the superseded version through
 * the product's own path. The organization's deletion, as the owner, takes all of it with it.
 */
export async function openReport(input: {
  readonly server: Parameters<typeof request>[0];
  readonly administrator: SignedInAccount;
  readonly name: string;
  readonly fiscalYear: number;
}): Promise<{ readonly organizationId: string; readonly periodId: string; readonly reportId: string }> {
  const http = () => request(input.server);
  const founded = await http()
    .post('/api/v1/organizations')
    .set(input.administrator.authorization)
    .send({ name: input.name, countryCode: 'MD' })
    .expect(201);
  const organizationId = (founded.body as { object: { id: string } }).object.id;

  const entities = await http().get('/api/v1/entities').set(input.administrator.authorization).expect(200);
  const [entity] = (entities.body as { objects: { id: string }[] }).objects;
  const period = await http()
    .post('/api/v1/periods')
    .set(input.administrator.authorization)
    .send({
      reportingEntityId: entity.id,
      fiscalYear: input.fiscalYear,
      periodStart: { date: `${input.fiscalYear}-01-01`, timezone: 'Europe/Chisinau' },
      periodEnd: { date: `${input.fiscalYear}-12-31`, timezone: 'Europe/Chisinau' },
    })
    .expect(201);
  const periodId = (period.body as { object: { id: string } }).object.id;
  const report = await http()
    .post('/api/v1/reports')
    .set(input.administrator.authorization)
    .send({ reportingPeriodId: periodId })
    .expect(201);
  return { organizationId, periodId, reportId: (report.body as { object: { id: string } }).object.id };
}
