import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';
import {
  LEGAL_CONTROLLER_FAULT,
  type LegalControllerFault,
} from '@api/modules/platform/legal/domain/legal-controller';

/**
 * A-21's refusals (task 75; FR-205) — each names its resolution, per NFR-79, in the catalogue entry its key points at.
 */

/** One key per fault, because the true sentence differs: a wrong check digit is fixed differently from a blank field. */
const INVALID_KEY = {
  [LEGAL_CONTROLLER_FAULT.NAME_MISSING]: 'platform.admin.legal_controller_invalid.name_missing',
  [LEGAL_CONTROLLER_FAULT.IDNO_MISSING]: 'platform.admin.legal_controller_invalid.idno_missing',
  [LEGAL_CONTROLLER_FAULT.IDNO_MALFORMED]: 'platform.admin.legal_controller_invalid.idno_malformed',
  [LEGAL_CONTROLLER_FAULT.IDNO_CHECK_DIGIT]: 'platform.admin.legal_controller_invalid.idno_check_digit',
  [LEGAL_CONTROLLER_FAULT.ADDRESS_MISSING]: 'platform.admin.legal_controller_invalid.address_missing',
  [LEGAL_CONTROLLER_FAULT.EMAIL_MISSING]: 'platform.admin.legal_controller_invalid.email_missing',
  [LEGAL_CONTROLLER_FAULT.EMAIL_MALFORMED]: 'platform.admin.legal_controller_invalid.email_malformed',
} as const satisfies Record<LegalControllerFault, string>;

/** A field the documents could not state — the first, in the order A-21 lays them out. */
export class LegalControllerInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor(fault: LegalControllerFault) {
    super(INVALID_KEY[fault], undefined, { fault });
  }
}

/** Another operator put a newer revision in force after this one was read. */
export class LegalControllerChangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.LegalControllerChanged;
  readonly status = 409;

  constructor() {
    super('platform.admin.legal_controller_changed');
  }
}

/** A save identical to what is in force — refused, not recorded in the audit log as a change that did not happen. */
export class LegalControllerUnchangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.admin.legal_controller_unchanged');
  }
}
