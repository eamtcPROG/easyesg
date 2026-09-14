import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * The current password — the whole body of A-19's re-enrolment and recovery-code writes (task 144).
 * **Required in the type as in the rule**, unlike the tenant `TotpReauthenticationRequestDto`: an operator
 * cannot be provider-only, so every one of them holds a password to give.
 */
export class AdminReauthenticationRequestDto {
  @ApiProperty({
    format: 'password',
    description: 'The operator’s current password. Every write on this screen asks for it.',
  })
  @IsString()
  password!: string;
}
