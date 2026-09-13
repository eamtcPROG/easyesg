import { ApiProperty } from '@nestjs/swagger';
import type { OrganizationRegisterRow } from '../models/organization-register.model';

/**
 * One organization in A-02's register (UC-69, FR-76; task 67.3) — account-level metadata, and the
 * complete list of it: **nothing here is report content** (FR-77, D-5), and a field added to this
 * class is a question for `design_spec.md` §5.2 before it is a question for the code.
 *
 * Instants are epoch-millisecond integers, converted at this boundary and nowhere else (OQ-50).
 */
export class OrganizationRegisterRowResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Brutăria Lina SRL' })
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '1009600041284',
    description: 'The organization’s IDNO. Null until its profile records one.',
  })
  idno: string | null;

  @ApiProperty({
    type: Number,
    description: 'Unix epoch milliseconds when the organization was registered on the platform.',
  })
  registeredAt: number;

  @ApiProperty({
    type: Number,
    description: 'Active reporting entities. An archived entity is not counted.',
  })
  entityCount: number;

  @ApiProperty({
    type: Number,
    description:
      'Reports the organization holds, in any status — a count only. What a report contains, its ' +
      'stage and its findings are report content and are not published here.',
  })
  reportCount: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix epoch milliseconds of the most recent sign-in by any active member. Null when no ' +
      'member has signed in.',
  })
  lastSignInAt: number | null;

  constructor(row: OrganizationRegisterRow) {
    this.id = row.id;
    this.name = row.name;
    this.idno = row.idno;
    this.registeredAt = row.registeredAt.getTime();
    this.entityCount = row.entityCount;
    this.reportCount = row.reportCount;
    this.lastSignInAt = row.lastSignInAt === null ? null : row.lastSignInAt.getTime();
  }
}
