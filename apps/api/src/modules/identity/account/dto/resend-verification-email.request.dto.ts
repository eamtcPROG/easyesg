import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * `POST /api/v1/auth/verification-email` (FR-3; OQ-55).
 *
 * The address only. There is no credential here and there cannot be one — the caller is someone
 * who cannot get into their account, which is the whole reason the route exists. What protects it
 * is that it discloses nothing and does nothing except send one message to an address that already
 * asked for it.
 *
 * `@IsEmail` is the one visible asymmetry in an otherwise uniform endpoint: a malformed address
 * answers `400` where an unknown one answers `202`. That is a statement about the *request*, not
 * about whether an account exists, so it tells an enumerator nothing.
 */
export class ResendVerificationEmailRequestDto {
  @ApiProperty({ format: 'email', example: 'ana.popescu@example.md' })
  @IsEmail()
  email!: string;
}
