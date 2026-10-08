import { Injectable } from '@nestjs/common';
import type { ValidationReading } from '../models/validation-run.model';
import { RunValidation } from '../use-cases/run-validation.use-case';

/** The Nest-aware seam over UC-40 (task 41.2) — the request supplies the report and nothing else. */
@Injectable()
export class ValidationService {
  constructor(private readonly validation: RunValidation) {}

  run(command: { readonly reportId: string }): Promise<ValidationReading> {
    return this.validation.run(command);
  }

  read(query: { readonly reportId: string }): Promise<ValidationReading> {
    return this.validation.read(query);
  }
}
