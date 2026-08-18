/**
 * Time primitives.
 *
 * `EpochMillis` is a Unix timestamp in milliseconds, UTC-based — the representation for every
 * instant in storage, on the wire and in DTOs. The alias exists because OpenAPI can only type it
 * `integer`, so the contract cannot say what the number means; the type name is where that
 * survives. Name the field so it reads as a time too, and state the unit in `@ApiProperty`.
 */
export type EpochMillis = number;

/**
 * A calendar date with legal force, as `YYYY-MM-DD`, paired with the timezone that determines it.
 *
 * NOT an instant, and the distinction is not stylistic. NFR-34 requires the originating timezone
 * wherever a legal date is determined, because an instant cannot settle which fiscal year a
 * document falls in: an invoice dated 31 December encoded as an epoch value lands in the wrong
 * year, and FR-125 makes that uncorrectable by editing — only by credit note.
 *
 * Use for invoice and credit-note dates, number-series fiscal years (AD-7, DR-8), reporting period
 * start/end/due (FR-21), the BNM rate date (FR-129), and effective dates on VAT rules, factor sets
 * and thresholds (AD-4).
 *
 * The test: would a different timezone change the answer to a legal or regulatory question?
 */
export interface LegalDate {
  /** ISO 8601 calendar date, `YYYY-MM-DD`. No time, no offset. */
  date: string;
  /** IANA zone that determined it, e.g. `Europe/Chisinau`. */
  timezone: string;
}
