import { TenantRepository, TenantContextMissingError } from './tenant-repository';
import { runInRequestContext } from './request-context';

class FakeReportRepository extends TenantRepository<{ id: string }> {
  protected readonly entity = 'Report' as never;
  read() {
    return this.repository;
  }
  org() {
    return this.organizationId;
  }
}

/**
 * AD-2's CI probe, stated as a requirement rather than left to review:
 * "AD-2's CI probe suite gains a case that calls a repository method outside a request
 * context and asserts it raises."
 *
 * Why this test matters more than it looks: RLS returns ZERO ROWS when app.current_org is
 * unset — it does not error. So the failure mode this guards against is not a crash, it is
 * a query that succeeds and returns nothing, which reads downstream as "this customer has
 * no data". That can pass review, staging and a demo.
 */
describe('TenantRepository', () => {
  const repo = new FakeReportRepository();

  it('raises when called with no request context at all', () => {
    expect(() => repo.read()).toThrow(TenantContextMissingError);
  });

  it('raises when a context exists but carries no QueryRunner', () => {
    runInRequestContext({ correlationId: 'c-1', organizationId: 'org-1' }, () => {
      expect(() => repo.read()).toThrow(TenantContextMissingError);
    });
  });

  it('raises when asked for the organization outside a context', () => {
    expect(() => repo.org()).toThrow(TenantContextMissingError);
  });

  it('names the entity in the message, so the failure points at the caller', () => {
    expect(() => repo.read()).toThrow(/Report/);
  });
});
