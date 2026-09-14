import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, MaxLength } from 'class-validator';
import { ADMIN_ROLE, type AdminRole } from '../models/admin-session.model';

/** A-08's invitation form (task 67.4; UC-87). */
export class InviteAdministratorRequestDto {
  @ApiProperty({
    format: 'email',
    maxLength: 320,
    description:
      'The operator’s address. The link goes here, and the account it creates holds this address.',
  })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    enum: Object.values(ADMIN_ROLE),
    description:
      'The realm the account will belong to. The two realms are separate accounts: a realm is not ' +
      'changed later.',
  })
  @IsIn(Object.values(ADMIN_ROLE))
  role!: AdminRole;
}
