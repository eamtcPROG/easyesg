import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '@easyesg/i18n';

/**
 * **Every notification category's wording, and every template a category overrides with, resolves in
 * every locale** (task 51.3; §12.5.6's task-51.3 row; FR-173, NFR-23, OQ-43).
 *
 * The property this guards was already true when the task opened — tasks 49.2, 50.1.4 and 50.3 each
 * authored their wording into the committed catalogues as they registered their category. What it did
 * not have was a failing state. A category registered in `config/seed` with no wording is a
 * configuration change that needs no deploy (AD-4), so it can arrive without a catalogue edit and
 * without anything noticing: `renderEmail` throws, but only on the worker, only when a notice is
 * actually sent, and only for the locale of whoever it was sent to. That is `message-keys.spec.ts`'s
 * defect one domain over, and it is written the same way for the same reason.
 *
 * **What a category needs follows from the channels it publishes**, which is why this reads the
 * artefact rather than a list kept here:
 *
 * - `email` → `subject` and `body`, since `EmailChannelService` sends `templateKey ?? categoryKey`
 *   and `renderEmail` takes both members or throws.
 * - `in_app` → `name`, `in_app.title` and `in_app.body`, which `NotificationCentreService` resolves.
 *   **`in_app.action` is deliberately not required**: the centre omits an absent member, so a notice
 *   with no next step is a notice with no action rather than a broken one.
 *
 * **A template is not always a category**, which is the part a gate over `config/seed` alone would
 * miss. `PASSWORD_SETUP_TEMPLATE` is a second wording for the password-reset category (task 155), named
 * in code and in no artefact — so every `*_TEMPLATE` constant under `modules/` is held to the same
 * requirement as an email category. That convention is declared here rather than assumed: a template
 * constant named some other way is invisible, and the case below that counts what was found is what
 * turns that from a silent miss into a failure.
 *
 * **What this does NOT cover, because something else does.** Wording authored ahead of the channel that
 * will publish it — `reporting.manual_reminder`'s `subject` and `body`, waiting for task 52.2 — is not
 * required by any channel here, and its three locales are held together by `packages/i18n`'s parity
 * suite instead. Consistency is that gate's property; coverage of what the code asks for is this one's.
 */
const SEED_ROOT = join(__dirname, '../../../../../config/seed');
const MODULES_ROOT = join(__dirname, '../../modules');
const CATALOGUES_ROOT = join(__dirname, '../../../../../packages/i18n/catalogues');

const CATEGORY_ARTEFACT = /^notification-category\.(.+)\.json$/u;
const TEMPLATE_CONSTANT = /\b\w*_TEMPLATE\b\s*=\s*'([a-z][\w.]*\.[\w.]+)'/gu;

const NOTIFICATION_CHANNEL = { EMAIL: 'email', IN_APP: 'in_app' } as const;

interface CategoryArtefact {
  readonly channels: readonly string[];
  readonly classification: string;
}

/** Literal on purpose, as the channels above are: the seed's own spelling, which this file reads. */
const OPTIONAL = 'optional';
/** FR-169's footer (task 52.2.2), which the renderer appends to every email a person may switch off. */
const UNSUBSCRIBE_FOOTER = 'notification.unsubscribe.footer';

/** Every registered category and the channels it publishes, read from the seed the store is filled from. */
const registeredCategories = (): { key: string; channels: readonly string[]; classification: string }[] =>
  readdirSync(SEED_ROOT)
    .map((name) => ({ name, match: CATEGORY_ARTEFACT.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ name, match }) => {
      const artefact = JSON.parse(readFileSync(join(SEED_ROOT, name), 'utf8')) as CategoryArtefact;
      return { key: match[1], channels: artefact.channels, classification: artefact.classification };
    });

/** Every `*_TEMPLATE` constant under `modules/`, found by walking rather than by a maintained list. */
const templateOverrides = (directory: string = MODULES_ROOT): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return templateOverrides(path);
    if (!entry.name.endsWith('.ts') || entry.name.includes('.spec.')) return [];
    return [...readFileSync(path, 'utf8').matchAll(TEMPLATE_CONSTANT)].map((match) => match[1]);
  });

const catalogue = (locale: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(CATALOGUES_ROOT, `${locale}.json`), 'utf8')) as Record<string, unknown>;

const resolves = (messages: Record<string, unknown>, key: string): boolean => {
  let node: unknown = messages;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' && node.length > 0;
};

/**
 * The members a category owes, given what it publishes — and, since task 52.2.2, the unsubscribe footer where it emails
 * a person who may switch it off, since the renderer throws on that email without one. Code's mandatory set is not
 * consulted: every mandatory category is classified `transactional` in its seed, or the catalogue refuses it.
 */
const requiredKeys = (key: string, channels: readonly string[], classification: string): string[] => [
  ...(channels.includes(NOTIFICATION_CHANNEL.EMAIL)
    ? [`notification.${key}.subject`, `notification.${key}.body`]
    : []),
  ...(channels.includes(NOTIFICATION_CHANNEL.EMAIL) && classification === OPTIONAL ? [UNSUBSCRIBE_FOOTER] : []),
  ...(channels.includes(NOTIFICATION_CHANNEL.IN_APP)
    ? [`notification.${key}.name`, `notification.${key}.in_app.title`, `notification.${key}.in_app.body`]
    : []),
];

describe('every notification category and template is worded in every locale (task 51.3)', () => {
  const categories = registeredCategories();
  const templates = templateOverrides();

  // A rule matching nothing looks exactly like a rule that passes — `boundaries:prove`'s property,
  // and the reason `message-keys.spec.ts` opens the same way. Both readers can silently find zero:
  // the artefacts are matched by filename, the constants by a naming convention.
  it('finds the categories and the templates at all', () => {
    expect(categories.length).toBeGreaterThanOrEqual(5);
    expect(templates.length).toBeGreaterThanOrEqual(1);
    expect(categories.every((category) => category.channels.length > 0)).toBe(true);
  });

  it.each(LOCALES)('every registered category carries what its channels need in %s', (locale) => {
    const messages = catalogue(locale);
    const missing = categories.flatMap(({ key, channels, classification }) =>
      requiredKeys(key, channels, classification).filter((required) => !resolves(messages, required)),
    );

    expect(missing).toEqual([]);
  });

  // The footer is the link's only carrier in the body: one without `{link}` renders an unsubscribe that goes nowhere.
  it.each(LOCALES)('writes the unsubscribe footer against the link in %s (task 52.2.2)', (locale) => {
    expect(String(UNSUBSCRIBE_FOOTER.split('.').reduce<unknown>(
      (node, segment) => (node as Record<string, unknown> | undefined)?.[segment],
      catalogue(locale),
    ))).toContain('{link}');
  });

  it.each(LOCALES)('every template a category overrides with is worded in %s', (locale) => {
    const messages = catalogue(locale);
    const missing = templates.flatMap((template) =>
      [`notification.${template}.subject`, `notification.${template}.body`].filter(
        (required) => !resolves(messages, required),
      ),
    );

    expect(missing).toEqual([]);
  });
});
