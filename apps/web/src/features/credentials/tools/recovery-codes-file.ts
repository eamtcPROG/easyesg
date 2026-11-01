/**
 * The recovery codes as a text file the reader keeps (task 169, the owner's review: *a button to download the
 * codes*). Plain text, one code a line under a heading and the one sentence that says what they are for — so the
 * file is still understood when it is found a year later, and a printed copy reads the same.
 *
 * **Line ends are CRLF**: Notepad, the one editor every Windows reader has, drew LF-only files as one line until
 * 2018, and a list of codes run together is the failure this file exists to prevent. Every other reader takes CRLF.
 */
export function recoveryCodesFile(input: {
  readonly heading: string;
  readonly note: string;
  readonly codes: readonly string[];
}): string {
  return [input.heading, input.note, '', ...input.codes, ''].join('\r\n');
}
