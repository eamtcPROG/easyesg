import { CALC_SOURCE_REFUSAL, type CalcSourceRefusal } from '../domain/calc-source-check';
import type { DomainError } from '@api/app/filters/domain.error';
import {
  CalcMonthsInvalidError,
  CalcOverrideInvalidError,
  CalcSourceContentsError,
  CalcSourceElsewhereError,
  CalcUnitNotAdmittedError,
  UnknownCalcSiteError,
  UnknownCalcSourceError,
} from '../errors/calculator.errors';

/**
 * A line's refusal as the error the caller meets — one mapping for the two use cases that check a line, writing it
 * and recording a run over it, so the same defect cannot answer two ways.
 */
export function calcSourceRefusalError(refusal: CalcSourceRefusal): Error {
  switch (refusal) {
    case CALC_SOURCE_REFUSAL.CONTENTS:
      return new CalcSourceContentsError();
    case CALC_SOURCE_REFUSAL.SOURCE:
      return new UnknownCalcSourceError();
    case CALC_SOURCE_REFUSAL.UNIT:
      return new CalcUnitNotAdmittedError();
    case CALC_SOURCE_REFUSAL.OVERRIDE:
      return new CalcOverrideInvalidError();
    case CALC_SOURCE_REFUSAL.MONTHS:
      return new CalcMonthsInvalidError();
  }
}

/**
 * Is this the refusal of **the line** rather than of the report (task 218; §12.5.6's task-218 row (b))? Every error
 * `calcSourceRefusalError` answers, a site the report's B1 does not list, and an id another report's line holds — each
 * is the line's own, and a client sets the line aside and keeps sending the rest. No factor set, no report and no
 * taxonomy are the report's, and hold the queue.
 */
export function isLineRefusal(error: unknown): error is DomainError {
  return (
    error instanceof CalcSourceContentsError ||
    error instanceof UnknownCalcSourceError ||
    error instanceof CalcUnitNotAdmittedError ||
    error instanceof CalcOverrideInvalidError ||
    error instanceof CalcMonthsInvalidError ||
    error instanceof UnknownCalcSiteError ||
    error instanceof CalcSourceElsewhereError
  );
}
