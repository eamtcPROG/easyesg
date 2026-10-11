import { ApiProperty } from '@nestjs/swagger';
import { LABEL_STANDING, LOCALES, type LabelStanding, type Locale } from '@easyesg/i18n';

/** One language a file may be written in, and whose words its labels are at the report's pinned version. */
export class ExportLanguageDto {
  @ApiProperty({ enum: LOCALES })
  readonly locale: Locale;

  @ApiProperty({
    nullable: true,
    enum: Object.values(LABEL_STANDING),
    description:
      'Whether the labels in this language are EFRAG’s own or platform-authored at the report’s pinned taxonomy ' +
      'version (UX-47, T-14). Null where the version carries no labels in this language.',
  })
  readonly labelStanding: LabelStanding | null;

  constructor(language: { readonly locale: Locale; readonly labelStanding: LabelStanding | null }) {
    this.locale = language.locale;
    this.labelStanding = language.labelStanding;
  }
}

/**
 * The languages S-11's dialogue offers (task 47.3; UX-47, FR-52) — every language a file may be written in, in the
 * platform's order, each with its labels' standing, so the dialogue says where the wording carries no EFRAG standing
 * without the browser reading the label catalogues, which it never does (AD-9).
 */
export class ExportLanguagesResponseDto {
  @ApiProperty({ type: [ExportLanguageDto] })
  readonly languages: ExportLanguageDto[];

  constructor(languages: readonly { readonly locale: Locale; readonly labelStanding: LabelStanding | null }[]) {
    this.languages = languages.map((language) => new ExportLanguageDto(language));
  }
}
