import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** The value from an administrator invitation's link (task 67.4) — in a body, never a query string. */
export class AdminInvitationTokenRequestDto {
  @ApiProperty({ description: 'The single-use value from the invitation link.', maxLength: 128 })
  @IsString()
  @MaxLength(128)
  token!: string;
}
