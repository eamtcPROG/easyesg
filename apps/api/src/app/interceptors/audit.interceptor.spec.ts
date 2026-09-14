import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import type { SystemAuditEvent, SystemAuditLog } from '@api/contracts/system-audit-log.port';
import { runInRequestContext, type RequestContext } from '@api/infrastructure/persistence/request-context';
import { AUDIT_ACTION_METADATA, AUDIT_TARGET, type AuditDeclaration } from '../decorators/audit-action.decorator';
import { AuditInterceptor } from './audit.interceptor';

class RecordingAuditLog implements SystemAuditLog {
  readonly recorded: SystemAuditEvent[] = [];

  record(event: SystemAuditEvent): Promise<void> {
    this.recorded.push(event);
    return Promise.resolve();
  }
}

const OPERATOR = '01920000-0000-7000-8000-00000000000a';
const ACCOUNT = '01920000-0000-7000-8000-00000000000b';

const handlerWith = (declaration?: AuditDeclaration) => {
  const handler = () => undefined;
  if (declaration !== undefined) Reflect.defineMetadata(AUDIT_ACTION_METADATA, declaration, handler);
  return handler;
};

const contextFor = (handler: () => unknown, params: Record<string, string> = {}): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ params }) }),
  }) as unknown as ExecutionContext;

const requestWith = (adminAccountId?: string): RequestContext => ({
  correlationId: 'test',
  locale: 'ro',
  adminAccountId,
});

const run = (input: {
  readonly audit: RecordingAuditLog;
  readonly context: ExecutionContext;
  readonly next: CallHandler;
  readonly adminAccountId?: string;
}) =>
  runInRequestContext(requestWith(input.adminAccountId), () =>
    firstValueFrom(new AuditInterceptor(new Reflector(), input.audit).intercept(input.context, input.next)),
  );

describe('AuditInterceptor (task 67.4, FR-159)', () => {
  it('records the declared action once, for the operator, on the account the route names', async () => {
    const audit = new RecordingAuditLog();
    const handler = handlerWith({
      action: 'admin.account.suspended',
      target: { from: AUDIT_TARGET.PARAM, name: 'accountId' },
    });

    await run({
      audit,
      context: contextFor(handler, { accountId: ACCOUNT }),
      next: { handle: () => of(undefined) },
      adminAccountId: OPERATOR,
    });

    expect(audit.recorded).toEqual([
      { action: 'admin.account.suspended', actorId: OPERATOR, targetId: ACCOUNT },
    ]);
  });

  it('names the row a request created from the handler’s own result, and passes the result on untouched', async () => {
    const audit = new RecordingAuditLog();
    const created = { id: '01920000-0000-7000-8000-00000000000c', email: 'nou@easyesg.md' };

    const answered = await run({
      audit,
      context: contextFor(handlerWith({ action: 'admin.invitation.issued', target: { from: AUDIT_TARGET.RESULT } })),
      next: { handle: () => of(created) },
      adminAccountId: OPERATOR,
    });

    expect(answered).toBe(created);
    expect(audit.recorded).toEqual([
      { action: 'admin.invitation.issued', actorId: OPERATOR, targetId: created.id },
    ]);
  });

  it('records nothing for a refused request — a refusal is not a change', async () => {
    const audit = new RecordingAuditLog();

    await expect(
      run({
        audit,
        context: contextFor(
          handlerWith({ action: 'admin.account.removed', target: { from: AUDIT_TARGET.PARAM, name: 'accountId' } }),
          { accountId: ACCOUNT },
        ),
        next: { handle: () => throwError(() => new Error('refused')) },
        adminAccountId: OPERATOR,
      }),
    ).rejects.toThrow('refused');

    expect(audit.recorded).toEqual([]);
  });

  it('records nothing for a route that declares nothing — a tenant write is core.field_change’s', async () => {
    const audit = new RecordingAuditLog();

    await run({
      audit,
      context: contextFor(handlerWith()),
      next: { handle: () => of({ id: ACCOUNT }) },
      adminAccountId: OPERATOR,
    });

    expect(audit.recorded).toEqual([]);
  });

  it('still records a declared change that reached it with no operator, rather than losing the event', async () => {
    const audit = new RecordingAuditLog();

    await run({
      audit,
      context: contextFor(
        handlerWith({ action: 'admin.account.reactivated', target: { from: AUDIT_TARGET.PARAM, name: 'accountId' } }),
        { accountId: ACCOUNT },
      ),
      next: { handle: () => of(undefined) },
    });

    expect(audit.recorded).toEqual([
      { action: 'admin.account.reactivated', actorId: null, targetId: ACCOUNT },
    ]);
  });
});
