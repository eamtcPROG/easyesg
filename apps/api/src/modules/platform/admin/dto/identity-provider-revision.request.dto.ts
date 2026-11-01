import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/** The body of A-18's enablement and disablement (task 67.11): the revision the operator was looking at. */
export class IdentityProviderRevisionRequestDto {
  @ApiProperty({
    type: Number,
    minimum: 0,
    description:
      'The revision this change was made against. A newer one in force refuses the change (problem type ' +
      'identity-provider-changed), so a provider another operator just reconfigured is never enabled unseen.',
  })
  @IsInt()
  @Min(0)
  revision!: number;
}
