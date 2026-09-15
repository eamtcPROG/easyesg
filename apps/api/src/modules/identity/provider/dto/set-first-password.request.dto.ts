import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * `POST /api/v1/account/setup/password` (task 155; S-36's first step). Shape here, policy in the use
 * case — `RegisterAccountRequestDto`'s split, for its reasons: a password that fails the policy is read
 * by a person in their own language, so it leaves as a problem document rather than a field error.
 */
export class SetFirstPasswordRequestDto {
  @ApiProperty({
    format: 'password',
    description:
      'The account’s first password, under the same policy as registration: minimum 8 and maximum 128 ' +
      'characters, with at least one lowercase letter, one uppercase letter, one digit and one further ' +
      'character.',
  })
  @IsString()
  password!: string;
}
