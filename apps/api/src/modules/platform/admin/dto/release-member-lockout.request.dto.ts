import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '@api/app/decorators/trim.decorator';

/**
 * A-02's release of a locked member (task 67.12; FR-209). **The reason is required**, A-07's length (FR-78) and
 * FR-22's form — trimmed, and whitespace is not a reason — because every Platform Administrator act is attributed and a
 * reason is how this product treats a privileged one (182/1). The system audit row carries it.
 */
export class ReleaseMemberLockoutRequestDto {
  @ApiProperty({
    maxLength: 500,
    example: 'The owner called support: the reset email does not reach their mailbox.',
    description: 'Why the lock is released, recorded with the system audit row.',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
