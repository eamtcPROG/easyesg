import { Injectable } from '@nestjs/common';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import {
  toOrganizationRegisterQuery,
  type RegisterListInput,
} from '../domain/organization-register-query';
import { AdminSessionInvalidError } from '../errors/admin-session.errors';
import type {
  OrganizationRegisterPage,
  OrganizationRegisterQuery,
  OrganizationRegisterRow,
} from '../models/organization-register.model';
import { ListOrganizationRegister } from '../use-cases/list-organization-register.use-case';
import { ReadOrganizationRegisterRow } from '../use-cases/read-organization-register-row.use-case';

/**
 * The Nest-aware seam between `OrganizationRegisterController` and UC-69's use case (house rule:
 * controllers call services, services call use cases) — and the layer that resolves the one piece of
 * ambient context this read needs: **who is reading**, for the acquisition log.
 */
@Injectable()
export class OrganizationRegisterService {
  constructor(
    private readonly listRegister: ListOrganizationRegister,
    private readonly readRow: ReadOrganizationRegisterRow,
  ) {}

  /** One organization's row (task 67.9) — resolving the reader as `list` does, for the same reason. */
  row(organizationId: string): Promise<OrganizationRegisterRow> {
    const requesterId = requestContext()?.adminAccountId;
    if (!requesterId) throw new AdminSessionInvalidError();
    return this.readRow.execute({ organizationId, requesterId });
  }

  /** The parsed list query and the search, narrowed to what A-02 can be asked. */
  narrow(input: { readonly list: RegisterListInput; readonly search: unknown }): OrganizationRegisterQuery {
    return toOrganizationRegisterQuery({ ...input, fallbackTake: DEFAULT_ON_PAGE });
  }

  /**
   * `@RequiresAdminRole` has already refused a request with no live operator session; this throws
   * rather than trusting that, for `AccessService.seats`' reason — a guard is a declaration, and this
   * is the layer that would otherwise log an acquisition by nobody.
   */
  list(query: OrganizationRegisterQuery): Promise<OrganizationRegisterPage> {
    const requesterId = requestContext()?.adminAccountId;
    if (!requesterId) throw new AdminSessionInvalidError();
    return this.listRegister.execute({ query, requesterId });
  }
}
