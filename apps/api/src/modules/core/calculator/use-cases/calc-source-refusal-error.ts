import { CALC_SOURCE_REFUSAL, type CalcSourceRefusal } from '../domain/calc-source-check';
import {
  CalcOverrideInvalidError,
  CalcSourceContentsError,
  CalcUnitNotAdmittedError,
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
  }
}
