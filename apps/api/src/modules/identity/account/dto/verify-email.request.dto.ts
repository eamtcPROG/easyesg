import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * `POST /api/v1/auth/verify-email` (FR-3, UC-03).
 *
 * **A POST carrying the token in the body, not a GET on the link itself**, and the reason is
 * operational rather than stylistic. The link in the email opens `apps/web`'s verification page
 * (S-02); that page then calls this. If following the link *were* the consumption, every corporate
 * mail scanner and link-preview fetcher that opens a URL before the human does would burn a
 * single-use token, and the user would be told their brand-new link had already been used. It also
 * keeps a token out of server access logs and out of `Referer` headers on the next navigation.
 *
 * A second effect worth naming: the page can be opened twice without failing, because only the
 * explicit action consumes.
 */
export class VerifyEmailRequestDto {
  @ApiProperty({
    description:
      'The value from the verification link. Single-use and valid for 24 hours from issue.',
  })
  @IsString()
  token!: string;
}
