/**
 * Whether a VSME label is EFRAG's own published wording or this platform's (NFR-24, T-14).
 *
 * `platform_authored` is not a lesser translation — the Romanian and Russian catalogues are
 * separately authored under NFR-23, and FR-63 forbids machine translation. It is a statement about
 * *authority*: only the official rendering can be cited to a bank or an EU buyer as the standard's
 * own words, which is what UX-47's export dialogue and UX-98's exported document must say.
 *
 * **It lives here and the label catalogues are read in `apps/api`, which is a boundary rather than
 * an accident** (task 33.2). This package owns the catalogues under `catalogues/disclosure/` and
 * their integrity — parity within a version, and that `standing.json` only ever holds members of
 * this vocabulary. It does **not** own resolution, because a module here importing those JSON files
 * would have to satisfy this package's two emits at once, and they cannot both be satisfied:
 * TypeScript rejects an import attribute under `module: commonjs` (TS2823) while `nodenext` — which
 * is how `apps/api` typechecks against this source — requires one (TS1543). The resolver is
 * `apps/api`'s `platform/localization`, which is CJS, has `resolveJsonModule`, and reads the
 * catalogues through this package's `./catalogues/*` export. `apps/web` never needs them directly:
 * a label reaches the browser through the API like every other tenant-scoped read (AD-9).
 *
 * This file therefore holds **no JSON import**, deliberately, and must not grow one.
 */
export const LABEL_STANDING = {
  OFFICIAL: 'official',
  PLATFORM_AUTHORED: 'platform_authored',
} as const;
export type LabelStanding = (typeof LABEL_STANDING)[keyof typeof LABEL_STANDING];

/**
 * One element's label at one version in one locale — text and provenance, never separable.
 *
 * There is no accessor anywhere that answers the text alone. UX-47 and UX-98 require a reader to be
 * told when the wording in front of them is platform-authored, at export language selection *and* on
 * the exported document; a bare string would make that statement something each surface has to
 * remember, and the export worker (task 46.3) has no other reason to know which locales EFRAG
 * publishes.
 */
export interface DisclosureLabel {
  readonly text: string;
  readonly standing: LabelStanding;
}

/**
 * Is this unvalidated value one of the standings?
 *
 * **Here rather than at each caller**, per CLAUDE.md: *"An operation over a vocabulary lives with
 * the vocabulary, not with each caller … the narrowing is derived from the set and belongs in the
 * module that owns the set."* `isLocale` and `toLocale` sit beside `LOCALES` two files away for
 * exactly this reason, after private copies had diverged in six places — and the two readers of a
 * `standing.json` manifest, one in `apps/api` and one in this package's parity spec, are the same
 * shape of pair on the day the vocabulary is born.
 */
export function isLabelStanding(value: unknown): value is LabelStanding {
  return (Object.values(LABEL_STANDING) as readonly unknown[]).includes(value);
}

/**
 * A version directory's `standing.json`, as committed — declared here because it is the shape that
 * crosses out of this package, and it was being restated at each of its three readers.
 *
 * `labels` is keyed by locale, but typed as a plain record: the manifest is a file on disk, so a key
 * it carries is a claim rather than a guarantee, and narrowing it to `Locale` at the type level
 * would assert what the reader is supposed to check.
 */
export interface LabelStandingManifest {
  readonly version: string;
  readonly labels: Readonly<Record<string, string>>;
}
