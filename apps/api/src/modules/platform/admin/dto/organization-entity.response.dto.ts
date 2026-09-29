import { ApiProperty } from '@nestjs/swagger';
import { ENTITY_STATUS, type EntityStatus } from '@api/modules/core/entity/models/reporting-entity.model';
import type { OrganizationEntity } from '../models/organization-entity.model';

/** One reporting entity of an organization, as A-02's record lists it (task 175) — master data, never report content. */
export class OrganizationEntityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lina SRL' })
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '1009600041284',
    description: 'The entity’s IDNO. Null while it records none.',
  })
  idno: string | null;

  @ApiProperty({ enum: Object.values(ENTITY_STATUS) })
  status: EntityStatus;

  constructor(entity: OrganizationEntity) {
    this.id = entity.id;
    this.name = entity.name;
    this.idno = entity.idno;
    this.status = entity.status;
  }
}
