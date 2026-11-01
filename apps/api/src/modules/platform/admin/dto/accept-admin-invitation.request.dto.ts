import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** A-20's last step (task 67.4): the link, the password and a code confirming the staged factor. */
export class AcceptAdminInvitationRequestDto {
  @ApiProperty({ description: 'The single-use value from the invitation link.', maxLength: 128 })
  @IsString()
  @MaxLength(128)
  token!: string;

  @ApiProperty({
    format: 'password',
    description:
      'The operator’s password, under the same policy as every other: minimum 8 and maximum 128 ' +
      'characters, with at least one lowercase letter, one uppercase letter, one digit and one ' +
      'further character.',
  })
  @IsString()
  password!: string;

  @ApiProperty({
    description:
      'A current code from the authenticator the enrolment secret was entered into. The account ' +
      'exists only once this confirms.',
    example: '492039',
  })
  @IsString()
  totpCode!: string;
}
