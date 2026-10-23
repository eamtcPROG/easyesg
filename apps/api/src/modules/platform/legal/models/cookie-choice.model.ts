/**
 * An answer to the cookie banner as recorded (task 223): the id the browser's cookie carries, the cookie policy version
 * the reader was shown, and when. Whose it was stays in the row and does not come back — the browser that answered
 * already knows.
 */
export interface RecordedCookieChoice {
  readonly id: string;
  readonly policyVersion: string;
  readonly chosenAt: Date;
}
