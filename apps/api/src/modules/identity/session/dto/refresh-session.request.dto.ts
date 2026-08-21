import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** `POST /api/v1/auth/session/refresh` (AD-12). The token is opaque; only presence is shape. */
export class RefreshSessionRequestDto {
  @ApiProperty({
    description:
      'The refresh token exactly as issued. Single-use: a successful refresh replaces it, and ' +
      'the replaced value is rejected from then on.',
  })
  @IsString()
  refreshToken!: string;
}
