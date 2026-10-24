/**
 * The cascade's light values an email is drawn in (task 225; §12.5.6's task-225 row (4)), under the cascade's own names.
 *
 * **Copied, not imported, and held equal by `email-palette.spec.ts`**: the api does not depend on the design system,
 * so UX-127's single source is kept the way the report document keeps it (the task-43 row (a)) — a value changed in
 * `tokens.css` fails that spec until it is changed here too. Only the light scheme: a mail client decides on its own
 * whether to darken a message, and the band is drawn dark in both.
 */
export const EMAIL_PALETTE = {
  '--pine-50': '#EDF5F0',
  '--pine-100': '#D6E8DE',
  '--pine-600': '#2E6A4F',
  '--pine-700': '#245540',
  '--pine-800': '#1B4031',
  '--slate-0': '#FFFFFF',
  '--slate-25': '#FAFBFC',
  '--slate-50': '#F4F6F8',
  '--slate-100': '#E8ECF0',
  '--slate-500': '#65717C',
  '--slate-700': '#3A434C',
  '--slate-900': '#161B20',
  '--amber-600': '#9A6510',
  '--amber-tint': '#FDF4E3',
  '--crimson-600': '#B32318',
  '--crimson-tint': '#FDEDEB',
} as const;

/** What each part of the message is drawn in — the brand band, the card, the words and the button. */
export const EMAIL_COLOUR = {
  ground: EMAIL_PALETTE['--slate-50'],
  surface: EMAIL_PALETTE['--slate-0'],
  well: EMAIL_PALETTE['--slate-50'],
  listHeader: EMAIL_PALETTE['--slate-25'],
  border: EMAIL_PALETTE['--slate-100'],
  band: EMAIL_PALETTE['--pine-800'],
  bandText: EMAIL_PALETTE['--slate-0'],
  bandSuffix: EMAIL_PALETTE['--pine-100'],
  heading: EMAIL_PALETTE['--slate-900'],
  body: EMAIL_PALETTE['--slate-700'],
  muted: EMAIL_PALETTE['--slate-500'],
  accent: EMAIL_PALETTE['--pine-600'],
  onAccent: EMAIL_PALETTE['--slate-0'],
  link: EMAIL_PALETTE['--pine-700'],
  factGround: EMAIL_PALETTE['--pine-50'],
  monogramGround: EMAIL_PALETTE['--pine-100'],
  monogramText: EMAIL_PALETTE['--pine-800'],
} as const;
