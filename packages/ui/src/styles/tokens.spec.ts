import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * UX-101's contrast floors, measured against `tokens.css` itself — **in both schemes**.
 *
 * UX-80 obliges every semantic token to be defined for light and dark and to satisfy §10.2 in
 * both. Task 82 authored the dark palette; this file is the half that makes the obligation
 * checkable, because a palette nobody measures is an assertion. It parses the stylesheet, resolves
 * each token through its `var()` chain per scheme, and computes the WCAG 2.x ratio for every
 * pairing the product actually renders.
 *
 * **It reads the stylesheet rather than a copy of its values**, which is the whole point: a table
 * of ratios in a document describes the file on the day it was written, and this describes it on
 * the day it is run. It is also what keeps two palettes from drifting — the owner chose a full
 * second palette over re-pointing the first (12 Sep 2026), and the cost of that choice is exactly
 * that the two can disagree. They cannot disagree silently while this runs.
 *
 * **What is asserted, and what is deliberately not.** UX-101 sets ≥ 4.5:1 for body text and
 * ≥ 3:1 for large text, *non-text UI components* and *state indicators*. "Non-text UI component"
 * is WCAG 1.4.11's term and means the parts of a control a user must perceive to operate it — an
 * input's boundary, a focus ring, an active-state marker. It does **not** mean every line on the
 * screen. So `--border-default` (a card edge, a table rule, a divider) is not asserted: it is
 * decorative, it measures about 1.3:1 in light by design, and asserting 3:1 on it would fail the
 * gate on correct design and teach the next reader to weaken the threshold. Surface-against-surface
 * is excluded for the same reason.
 *
 * The report is written on every run so the record cannot drift from the measurement.
 */

type Scheme = 'light' | 'dark';

const CSS = readFileSync(join(__dirname, 'tokens.css'), 'utf8');

/** Comments are stripped **before** anything is parsed, and that is not tidiness.
 *  This file's own house style records superseded values in comments — `--slate-400` carries
 *  `#8B96A3 until 12 Sep 2026` three lines above its declaration. Parsed as text, a comment
 *  mentioning `--x: <value>;` AFTER the real one silently wins the `Map`, so the spec measures a
 *  value the browser never uses. Proved on 12 Sep 2026: a commented-out override made a 1.75:1
 *  dark stylesheet pass all 76 assertions. */
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Declarations inside a block, in source order; a later declaration wins, as in CSS. */
const declarationsOf = (block: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const [, name, value] of withoutComments(block).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(name, value.trim());
  }
  return out;
};

const BARE = withoutComments(CSS);
const rootBlock = /^:root\s*\{([\s\S]*?)\n\}/m.exec(BARE);
const darkBlocks = [...BARE.matchAll(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n {2}\}/g)];
if (!rootBlock) throw new Error('tokens.css: no top-level :root block');
if (darkBlocks.length === 0) throw new Error('tokens.css: no prefers-color-scheme: dark block — UX-80 is unmet');
// More than one and this file measures the first while the browser applies the last. Refuse rather
// than measure the wrong one — proved 12 Sep 2026: a second block re-pointing `--text-muted` was
// honoured by the browser and invisible here.
if (darkBlocks.length > 1) {
  throw new Error(`tokens.css: ${darkBlocks.length} dark blocks; this check measures one — merge them`);
}
const darkBlock = darkBlocks[0];

const LIGHT = declarationsOf(rootBlock[1]);
const DARK = new Map([...LIGHT, ...declarationsOf(darkBlock[1])]);
const table = (scheme: Scheme) => (scheme === 'light' ? LIGHT : DARK);

/** Follows `var(--x)` to a literal. Throws rather than returning a default — an unresolved token
 *  is the defect this file exists to catch, and a fallback would hide it. */
const resolve = (name: string, scheme: Scheme, seen = new Set<string>()): string => {
  if (seen.has(name)) throw new Error(`tokens.css: ${name} resolves in a cycle`);
  seen.add(name);
  const raw = table(scheme).get(name);
  if (raw === undefined) throw new Error(`tokens.css: ${name} is not defined in the ${scheme} scheme`);
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(raw);
  return ref ? resolve(ref[1], scheme, seen) : raw;
};

const channel = (hex: string): [number, number, number] => {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const full = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (short) return [short[1], short[2], short[3]].map((c) => parseInt(c + c, 16)) as [number, number, number];
  if (full) return [full[1], full[2], full[3]].map((c) => parseInt(c, 16)) as [number, number, number];
  throw new Error(`tokens.css: "${hex}" is not an opaque colour this check can measure`);
};

/** WCAG 2.x relative luminance. */
const luminance = (hex: string): number => {
  const [r, g, b] = channel(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** A pairing the product renders: foreground token, background token, and the floor it must clear. */
interface Pairing {
  readonly what: string;
  readonly fg: string;
  readonly bg: string;
  readonly floor: 4.5 | 3;
}

const TEXT: Pairing[] = [
  { what: 'default text on a card', fg: '--text-default', bg: '--surface-default', floor: 4.5 },
  { what: 'default text on the page ground', fg: '--text-default', bg: '--surface-sunken', floor: 4.5 },
  { what: 'default text on a popover', fg: '--text-default', bg: '--surface-raised', floor: 4.5 },
  { what: 'body text on a card', fg: '--text-body', bg: '--surface-default', floor: 4.5 },
  { what: 'body text on the page ground', fg: '--text-body', bg: '--surface-sunken', floor: 4.5 },
  { what: 'body text on a popover', fg: '--text-body', bg: '--surface-raised', floor: 4.5 },
  // The three untinted surfaces only. `--text-muted` on `--accent-tint` — the highlight every menu
  // and listbox row takes — measures 4.50:1, the floor to two decimals with no margin, and the
  // tier-2 comment records that secondary text on a highlighted row uses `--text-body` instead.
  // Asserting the tinted pairing would pin a design that is deliberately not used.
  { what: 'muted text on a card', fg: '--text-muted', bg: '--surface-default', floor: 4.5 },
  { what: 'muted text on the page ground', fg: '--text-muted', bg: '--surface-sunken', floor: 4.5 },
  // Added 12 Sep 2026 by review: light made `--surface-raised` identical to `--surface-default`,
  // so this pairing could not fail and was not listed. Dark pulls them apart and it measured
  // 4.32:1 — the account menu's address line, and every select and combobox item description.
  { what: 'muted text in a popover', fg: '--text-muted', bg: '--surface-raised', floor: 4.5 },
  { what: 'text on the accent', fg: '--text-on-accent', bg: '--accent', floor: 4.5 },
  { what: 'Focus header text', fg: '--focus-header-text', bg: '--focus-header-surface', floor: 4.5 },
  { what: 'Focus header muted text', fg: '--focus-header-text-muted', bg: '--focus-header-surface', floor: 4.5 },
  { what: 'global bar text', fg: '--globalbar-text', bg: '--globalbar-surface', floor: 4.5 },
  { what: 'global bar muted text', fg: '--globalbar-text-muted', bg: '--globalbar-surface', floor: 4.5 },
  { what: 'avatar initials', fg: '--globalbar-avatar-text', bg: '--globalbar-avatar-surface', floor: 4.5 },
  // §11.5's Badge (task 50.2.1): a count in digits at 12px, so text's floor, in each of its two tones.
  { what: 'badge count, quiet', fg: '--badge-quiet-text', bg: '--badge-quiet-surface', floor: 4.5 },
  { what: 'badge count, alert', fg: '--badge-alert-text', bg: '--badge-alert-surface', floor: 4.5 },
  { what: 'band button label', fg: '--button-band-text', bg: '--button-band-surface', floor: 4.5 },
  { what: 'band button label, hovered', fg: '--button-band-text', bg: '--button-band-surface-hover', floor: 4.5 },
  // The console's chrome (task 67.1) — every text it draws, on the surface it draws it on.
  { what: 'console bar text', fg: '--consolebar-text', bg: '--consolebar-surface', floor: 4.5 },
  { what: 'console bar muted text', fg: '--consolebar-text-muted', bg: '--consolebar-surface', floor: 4.5 },
  { what: 'console bar text, hovered', fg: '--consolebar-text', bg: '--consolebar-hover', floor: 4.5 },
  { what: 'console bar avatar glyph', fg: '--consolebar-avatar-text', bg: '--consolebar-avatar-surface', floor: 4.5 },
  { what: 'console nav section heading', fg: '--consolenav-heading', bg: '--consolenav-surface', floor: 4.5 },
  { what: 'console nav destination', fg: '--consolenav-text', bg: '--consolenav-surface', floor: 4.5 },
  { what: 'console nav destination, hovered', fg: '--consolenav-text-strong', bg: '--consolenav-hover', floor: 4.5 },
  { what: 'console nav current destination', fg: '--consolenav-text-strong', bg: '--consolenav-current-surface', floor: 4.5 },
];

const STATES = ['ok', 'attention', 'warning', 'error', 'reasoned', 'pending', 'neutral'] as const;

/** A state's own text on its own tint — the callout, the chip, the inline finding. */
const STATE_TEXT: Pairing[] = STATES.map((s) => ({
  what: `${s} text on its tint`,
  fg: `--state-${s}`,
  bg: `--state-${s}-tint`,
  floor: 4.5,
}));

/** The Callout's own body copy. Found 12 Sep 2026 by looking at a rendered dark screen rather than
 *  at the token list: `callout.module.css` paints `--text-default` on the heading and `--text-body`
 *  on the paragraph, both over `--state-*-tint`. Neither pairing was listed — the list had been
 *  written from the tokens' names, where a tint looks like something only its own state sits on. */
const TEXT_ON_TINT: Pairing[] = STATES.flatMap((s) => [
  { what: `callout heading on the ${s} tint`, fg: '--text-default', bg: `--state-${s}-tint`, floor: 4.5 as const },
  { what: `callout body on the ${s} tint`, fg: '--text-body', bg: `--state-${s}-tint`, floor: 4.5 as const },
]);

/** The same colour as a status word on an ordinary surface. */
const STATE_ON_SURFACE: Pairing[] = STATES.map((s) => ({
  what: `${s} text on a card`,
  fg: `--state-${s}`,
  bg: '--surface-default',
  floor: 4.5,
}));

/** WCAG 1.4.11: the parts of a control a user must perceive to operate it. */
const NON_TEXT: Pairing[] = [
  { what: 'input boundary at rest', fg: '--border-strong', bg: '--surface-default', floor: 3 },
  { what: 'input boundary on the page ground', fg: '--border-strong', bg: '--surface-sunken', floor: 3 },
  { what: 'input boundary in a popover', fg: '--border-strong', bg: '--surface-raised', floor: 3 },
  // UX-105 requires the focus indicator to meet contrast against EVERY background it can appear
  // on, and UX-80a makes the ring two layers precisely because one is illegible on some of them.
  // Measuring the inner ring on one surface tested the guard on its happy path.
  { what: 'focus ring, inner, on a card', fg: '--border-focus', bg: '--surface-default', floor: 3 },
  { what: 'focus ring, inner, on the page ground', fg: '--border-focus', bg: '--surface-sunken', floor: 3 },
  { what: 'focus ring, inner, in a popover', fg: '--border-focus', bg: '--surface-raised', floor: 3 },
  // The halo is asserted against the RING, not against the surface. A first draft asserted it on
  // all three surfaces and failed in BOTH schemes — 1.66:1 in light, on a design that has shipped
  // and is correct. That was this file's own warning about `--border-default` repeating: the halo
  // is the outer layer whose job is to separate the inner ring from whatever is behind it, so the
  // pairing that carries UX-80a's *"two are legible on both"* is halo against ring. The inner ring
  // carries the indicator's own contrast against the surface, asserted above on all three.
  { what: 'focus ring, halo against the ring', fg: '--border-focus-halo', bg: '--border-focus', floor: 3 },
  { what: 'accent as an active marker', fg: '--accent', bg: '--surface-default', floor: 3 },
  { what: 'accent on its own tint', fg: '--accent', bg: '--accent-tint', floor: 3 },
  // The Enrolment code's modules on their plate (task 143). Held to 4.5 rather than 1.4.11's 3:
  // no WCAG floor is written for a camera, and of the two this file knows the stricter is the nearer
  // to what one needs. The pair's comment in `tokens.css` is why it is the same in both schemes.
  { what: 'enrolment code modules on their plate', fg: '--enrolment-code-module', bg: '--enrolment-code-ground', floor: 4.5 },
  // The console nav's current-destination rule (task 67.1) against the surface it marks.
  { what: 'console nav current rule', fg: '--consolenav-current-rule', bg: '--consolenav-current-surface', floor: 3 },
];

const ALL = [...TEXT, ...STATE_TEXT, ...TEXT_ON_TINT, ...STATE_ON_SURFACE, ...NON_TEXT];

const measure = (p: Pairing, scheme: Scheme) => ratio(resolve(p.fg, scheme), resolve(p.bg, scheme));

/** Two decimals by arithmetic rather than by a format call. NFR-26's selector bans a format
 *  pattern chosen at a call site, and its own docblock puts specs in scope on purpose — so a
 *  ratio in a developer record is rounded, not formatted. Dropping a trailing zero is honest
 *  here: these are measurements, and 4.5 is everything 4.50 knew. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The compact density's block, parsed the same way the dark block is. */
const compactBlocks = [...BARE.matchAll(/:root\[data-density='compact'\]\s*\{([\s\S]*?)\n\}/g)];

describe("tokens.css — §11.4's compact density (architecture.md OQ-44, task 67.2)", () => {
  it('declares the compact block once', () => {
    expect(compactBlocks).toHaveLength(1);
  });

  /**
   * **The shift, asserted rather than trusted.** OQ-44 closed on *"steps 4 through 8 each take the
   * value of the step below"*, and the block writes that as five literals — because chaining it as
   * `--space-5: var(--space-4)` reads the value declared in the same block and collapses every step
   * to 8px (measured in a browser before the block shipped). Literals that cannot be derived at
   * runtime are exactly the copy this repository guards with a gate rather than deletes, as the
   * migrations' `CHECK` constraints already are.
   */
  it('shifts steps 4 through 8 down exactly one rung of the same scale', () => {
    const compact = declarationsOf(compactBlocks[0][1]);
    for (const step of [4, 5, 6, 7, 8]) {
      expect(
        compact.get(`--space-${step}`),
        `compact --space-${step} must equal the scale's --space-${step - 1}`,
      ).toBe(LIGHT.get(`--space-${step - 1}`));
    }
  });

  /** Steps 1–3 are optical and 9–10 are page rhythm; §11.4 records why neither moves. Type, radius,
   *  colour, elevation and motion are not a density's business at all — a density chooses steps of
   *  the space scale and nothing else, so anything else appearing here is a different decision. */
  it('moves nothing else', () => {
    const compact = declarationsOf(compactBlocks[0][1]);
    expect([...compact.keys()].sort()).toEqual([
      '--space-4', '--space-5', '--space-6', '--space-7', '--space-8',
    ]);
  });
});

describe('tokens.css — UX-80 and UX-101', () => {
  it('defines a dark scheme at all', () => {
    expect(darkBlock).not.toBeNull();
  });

  it.each(['light', 'dark'] as const)('%s: every semantic token resolves to a literal', (scheme) => {
    const semantic = [...new Set(ALL.flatMap((p) => [p.fg, p.bg]))];
    for (const token of semantic) expect(() => resolve(token, scheme)).not.toThrow();
  });

  /**
   * **The omission check, and it is the one the pairing assertions cannot make.**
   *
   * Dark inherits light, as CSS does — so a token left out of the dark block does not fail, it
   * silently keeps its light value. Worse, the pairing list cannot see it: when BOTH sides of a
   * pairing revert together the measured ratio is exactly the light ratio, which passes. A review
   * on 12 Sep 2026 deleted each of the 45 dark declarations in turn and found **19 silent**,
   * including the whole Focus-header, global-bar and band-button families — every one of which has
   * asserted pairings.
   *
   * So this asserts the other direction: a token that carries colour and resolves to the SAME
   * literal in both schemes was either left out, or is deliberately scheme-independent and named
   * below. Nothing else is admitted, which also makes the next tier-3 token that reads tier 1 a
   * failure rather than a thing `packages/ui/CLAUDE.md` hopes someone remembers.
   */
  it('re-points every colour-bearing token, or names why not', () => {
    const isColour = (v: string) => /^(#|rgb|hsl|oklch)/.test(v);
    const isTier1 = (n: string) => /^--(pine|slate|amber|rust|crimson|iris|azure)-/.test(n);

    /** Scheme-independent on purpose, and each family for its own reason. Adding to this list is a
     *  decision; it needs a reason in the same commit.
     *
     *  - **The global bar's three rules** are white-over-brand alpha on a band that is dark in BOTH
     *    schemes — the tier-3 comment on the global bar records why alpha rather than a pine step:
     *    it composites correctly against any brand colour, which is what makes it correct here too.
     *    **The notification entry's two surfaces** (task 50.2.1) are the same white alpha on the same
     *    band, for the same reason.
     *  - **The Enrolment code's plate** (task 143) is dark modules on a light ground in both schemes
     *    because a camera reads it, and decoding a reversed QR symbol is optional in ISO/IEC 18004 —
     *    a symbol that inverted with the scheme would be unreadable to any scanner omitting it.
     *  - **The console's chrome** (task 67.1) is a dark neutral bar and side navigation in both
     *    schemes, the global bar's reasoning for a second realm: the console says it is not the
     *    tenant application by its surface, and a light console in the light scheme would not. */
    const SCHEME_INDEPENDENT = new Set([
      '--globalbar-divider',
      '--globalbar-plate-border',
      '--globalbar-plate-hover',
      '--globalbar-control-surface',
      '--globalbar-control-surface-hover',
      '--enrolment-code-module',
      '--enrolment-code-ground',
      '--consolebar-surface',
      '--consolebar-text',
      '--consolebar-text-muted',
      '--consolebar-divider',
      '--consolebar-hover',
      '--consolebar-avatar-surface',
      '--consolebar-avatar-text',
      '--consolenav-surface',
      '--consolenav-heading',
      '--consolenav-text',
      '--consolenav-text-strong',
      '--consolenav-hover',
      '--consolenav-current-surface',
      '--consolenav-current-rule',
    ]);

    const unmoved = [...LIGHT.keys()]
      .filter((name) => !isTier1(name))
      .filter((name) => isColour(resolve(name, 'light')))
      .filter((name) => resolve(name, 'light') === resolve(name, 'dark'))
      .filter((name) => !SCHEME_INDEPENDENT.has(name));

    expect(
      unmoved,
      `these carry colour and are identical in both schemes — re-point them in the dark block, ` +
        `or add them to SCHEME_INDEPENDENT with a reason: ${unmoved.join(', ')}`,
    ).toEqual([]);

    // The set requires as well as permits. The filter above only drops a member from the offenders,
    // so a member re-pointed in the dark block passed silently — proven on task 143's plate by
    // re-pointing it to its own reverse (gate-integrity review). Each member is held to its claim.
    const moved = [...SCHEME_INDEPENDENT].filter(
      (name) => resolve(name, 'light') !== resolve(name, 'dark'),
    );
    expect(
      moved,
      `named scheme-independent but re-pointed in the dark block: ${moved.join(', ')}`,
    ).toEqual([]);
  });

  /**
   * The Enrolment code's plate draws dark modules on a light ground (task 143), and a contrast ratio
   * cannot say which side is darker — swapped in `:root`, the pair still measured 17.33:1 and every
   * assertion passed. So the direction is its own check, in both schemes.
   */
  it.each(['light', 'dark'] as const)(
    '%s: the enrolment code draws dark modules on a light ground',
    (scheme) => {
      expect(luminance(resolve('--enrolment-code-module', scheme))).toBeLessThan(
        luminance(resolve('--enrolment-code-ground', scheme)),
      );
    },
  );

  it.each(
    (['light', 'dark'] as const).flatMap((scheme) => ALL.map((p) => [scheme, p] as const)),
  )('%s: %o clears its floor', (scheme, pairing) => {
    const got = measure(pairing, scheme);
    expect(
      got,
      `${scheme}: ${pairing.what} (${pairing.fg} on ${pairing.bg}) measured ` +
        `${Math.round(got * 1000) / 1000}:1, below UX-101's ${pairing.floor}:1`,
    ).toBeGreaterThanOrEqual(pairing.floor);
  });

  /**
   * The record UX-80's deliverable asks for, regenerated from the same computation that gates it.
   *
   * **It asserts rather than describes**, because the first draft did neither: its only check was
   * `expect(report).toContain('| Pairing |')` — a literal the test had pushed into the array eleven
   * lines above, which a review proved passes on a table with no data rows at all. And because the
   * writer is a separate `it`, it ran even when pairings had failed and recorded a *failing* ratio
   * with no indication, so the artefact for "contrast verified and recorded" could record
   * non-compliance as compliance. Both are fixed here: a verdict per row, one row per pairing, and
   * the same floors asserted again on the way out.
   */
  it('writes the contrast record, and every row in it passes', () => {
    const rows = ALL.map((p) => {
      const light = measure(p, 'light');
      const dark = measure(p, 'dark');
      const ok = light >= p.floor && dark >= p.floor;
      return {
        p,
        ok,
        line:
          `| ${p.what} | \`${p.fg}\` on \`${p.bg}\` | ${round2(light)}:1 | ` +
          `${round2(dark)}:1 | ${p.floor}:1 | ${ok ? 'pass' : 'FAIL'} |`,
      };
    });

    const report = [
      '# Contrast record',
      '',
      '**Generated by `tokens.spec.ts`. Do not edit — it is rewritten on every test run.**',
      '',
      'UX-80 requires every semantic token to be defined for both schemes and to satisfy §10.2 in',
      'both; UX-101 sets the floors. This table is the record that deliverable asks for, and the',
      'spec that generates it is the gate — so a token change that breaks a floor fails the build',
      'rather than silently making this file wrong.',
      '',
      `${ALL.length} pairings, each measured in both schemes.`,
      '',
      '| Pairing | Tokens | Light | Dark | Floor | Verdict |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows.map((r) => r.line),
      '',
    ].join('\n');
    // Read before writing, so the committed copy can be compared against what the stylesheet says
    // today. This is `openapi:check`'s shape — emit, then `git diff --exit-code` — folded into the
    // spec, because a generated artefact with no freshness check drifts silently and the claim
    // "the record cannot drift from the file" would be true of a run and false of the repository.
    const path = join(__dirname, 'contrast-record.md');
    const committed = existsSync(path) ? readFileSync(path, 'utf8') : '';
    writeFileSync(path, report);

    expect(rows).toHaveLength(ALL.length);
    expect(rows.filter((r) => !r.ok).map((r) => r.p.what)).toEqual([]);
    expect(
      committed,
      'contrast-record.md was stale — it has been regenerated; commit the new copy',
    ).toBe(report);
  });
});
