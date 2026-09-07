// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import nextPlugin from '@next/eslint-plugin-next';
import sonarjs from 'eslint-plugin-sonarjs';

/**
 * One flat config for the workspace. Type-aware rules are on: AD-13 pins TypeScript at 6.x
 * partly to keep type-aware ESLint working, so running it untyped would waste the constraint.
 *
 * Boundary enforcement is NOT here — dependency-cruiser owns it (.dependency-cruiser.cjs),
 * because DR-1's rule is about module graphs, not syntax.
 *
 * This config is the ONLY lint gate for apps/web: Next 16 removed `next lint`, and AD-9 records
 * the consequence — "CI must invoke ESLint directly or every gate in AD-13's table silently
 * turns off."
 */
/**
 * NFR-26's formatting bans, shared by every browser-tier package.
 *
 * Hoisted into a constant rather than repeated because ESLint rule options REPLACE rather than
 * merge: a second `no-restricted-syntax` block matching apps/web would silently drop these
 * entries from it, and a lint rule that stopped matching looks exactly like a lint rule that
 * passes. Spread into each block instead, so adding a browser tier cannot quietly lose them.
 *
 * Split from `restrictedSyntaxText` on 24 Aug 2026: a spec's JSX fixture is not user-facing
 * text, but a spec asserting a formatted value would still be an NFR-26 violation, so the two
 * halves need different scopes. See the spec block below.
 */
const restrictedSyntaxFormatting = [
  {
    selector: 'CallExpression > MemberExpression[property.name="toFixed"]',
    message:
      'NFR-26: no hardcoded format pattern. Declare a named number format in the app\'s ' +
      'i18n/formats.ts and reach it by name.',
  },
  {
    selector:
      'CallExpression > MemberExpression[property.name=/^toLocale(String|DateString|TimeString)$/]',
    message:
      'NFR-26: formatting is derived from the active locale, not chosen at the call site. ' +
      "Use a named format from the app's i18n/formats.ts.",
  },
  {
    selector: 'NewExpression[callee.object.name="Intl"]',
    message:
      'NFR-26: declare the format in the app\'s i18n/formats.ts and reach it by name. A ' +
      'formatter constructed here is a format pattern in a component.',
  },
];

/**
 * The no-user-facing-text rule — every string a person reads is a catalogue key.
 *
 * Separate from the formatting list because it is the one part of the browser tier that does
 * NOT apply to a spec: a fixture's `<button>Continue</button>` is never shipped, never
 * translated and invisible to the parity gate by construction. Leaving it on there is how a
 * component spec ends up carrying an inline disable, which the migration exception below
 * already names as the failure to avoid.
 */
const restrictedSyntaxText = [
  {
    selector: 'JSXText[value=/[^\\s]/]',
    message:
      'No user-facing text in code. Every string a person reads is a message key resolved ' +
      'from a catalogue (design_spec.md §13.4); a literal here is invisible to the parity ' +
      'gate and to every translator. Use a message key.',
  },
  // JSXText catches the text BETWEEN tags and nothing else, so a sentence moved into an
  // attribute slipped through — and these are the attributes a screen reader reads aloud,
  // which makes it the accessibility surface (WCAG 2.2 AA) as much as the localization one.
  // Split from `alt` below because the empty string is meaningful there and nowhere else.
  {
    selector:
      "JSXAttribute[name.name=/^(title|placeholder|aria-label|aria-description|aria-placeholder|aria-valuetext|aria-roledescription)$/] > Literal",
    message:
      'No user-facing text in code — an attribute is still text a person reads, and a screen ' +
      'reader announces these. Resolve it from the catalogue: title={t(\'…\')}.',
  },
  {
    // `alt=""` is the correct, required marking for a decorative image, so only a non-empty
    // literal is a violation.
    selector: "JSXAttribute[name.name='alt'] > Literal[value!='']",
    message:
      'No user-facing text in code — alt text is read aloud. Resolve it from the catalogue. ' +
      'An intentionally decorative image keeps alt="".',
  },
];

/**
 * The closed-vocabulary rule (root `CLAUDE.md`, "Conventions"), as the part of it a syntax
 * selector can actually decide — added 21 Aug 2026 after `sonarjs/no-duplicate-string` turned
 * out to be blind to exactly the literals this convention is about (`MIN_LENGTH = 10` and
 * `NO_SEPARATOR_REGEXP = /^\w*$/`, so any single word of word-characters is invisible to it).
 *
 * These two selectors see what it cannot, by matching the *shape* rather than the repetition:
 * a vocabulary written as a union type, and a literal compared against. Both are the forms the
 * convention names, and neither depends on how many times the value appears — which matters,
 * because the `MODE === 'worker'` defect was one comparison per file across five files.
 *
 * Spread into every block that sets `no-restricted-syntax`, for the reason the constant below
 * documents: the option REPLACES rather than merges.
 */
const restrictedSyntaxVocabulary = [
  // Anchored on the two parents that mean "this union IS the vocabulary" — a type alias, and a
  // property's type. Matching `TSUnionType` alone was the first draft and it was wrong: it also
  // caught `Pick<AccountResponse, 'id' | 'email' | 'status'>` and `Omit<TextFieldProps, 'type'>`,
  // where the union selects KEYS rather than declaring values. Those have no `as const` form and
  // are not what the convention is about.
  {
    selector: "TSTypeAliasDeclaration > TSUnionType > TSLiteralType > Literal[raw=/^['\"]/]",
    message:
      'A closed vocabulary is declared once as an `as const` object with its union derived from ' +
      'it (CLAUDE.md, "Conventions"), never as a hand-written union of string literals — a union ' +
      'written here has no runtime value to reference, so every call site spells the member out ' +
      'again. Declare the object and derive: type X = (typeof X_VALUES)[keyof typeof X_VALUES].',
  },
  {
    selector:
      "TSPropertySignature > TSTypeAnnotation > TSUnionType > TSLiteralType > Literal[raw=/^['\"]/]",
    message:
      'A closed vocabulary is declared once as an `as const` object with its union derived from ' +
      'it (CLAUDE.md, "Conventions"), never as a hand-written union of string literals on a ' +
      'property. Deriving changes no caller — the derived type is still the same union of ' +
      'literals, so `variant="primary"` keeps compiling — and it gives the set a runtime value ' +
      'to iterate, which a hand-written union does not have.',
  },
  {
    // `[value!='']` for the reason the `alt` rule above gives: the empty string is a value test
    // (`x === ''` is `x.length === 0`), never a member of a vocabulary. `parity.ts` compares a
    // catalogue entry against it to find blank translations, which is not this rule's business.
    selector:
      'BinaryExpression[operator=/^[!=]==$/][left.operator!="typeof"] > Literal[raw=/^[\'"]/][value!=\'\']',
    message:
      'Comparing against a string literal (CLAUDE.md, "Conventions"): a typo does not error — ' +
      'the comparison is simply false and the wrong branch registers silently, which is how ' +
      "`MODE === 'worker'` split provider sets across five files. Compare against the member of " +
      'an `as const` object instead. A `typeof` check is not this and is already excluded.',
  },
  {
    // Added 28 Aug 2026, after a sweep found 38 of these against a green gate. The two selectors
    // above match a vocabulary's DECLARATION and a comparison; neither sees a JSX attribute, so
    // `intent="error"` passed while `CALLOUT_INTENT` sat exported beside it — the very object the
    // convention exists to route call sites through. `sonarjs/no-duplicate-string` cannot see them
    // either: its NO_SEPARATOR_REGEXP treats a single word of word-characters as invisible at any
    // repetition count, which is precisely the shape of every member here.
    //
    // **The attribute names are an allowlist, deliberately.** A prop is only in it when this
    // design system exports the vocabulary it takes. `align` is the counter-example that shaped
    // the rule: `COLUMN_ALIGN` exists, but `language-switcher.tsx` passes `align="end"` to Radix's
    // `DropdownMenu.Content`, whose values are Radix's and not ours — flagging it would demand a
    // member of an object that does not describe it.
    selector: 'JSXAttribute[name.name=/^(intent|variant|tone)$/] > Literal[raw=/^[\'"]/]',
    message:
      'A closed vocabulary is referenced through its `as const` object at EVERY site ' +
      '(CLAUDE.md, "Conventions"), and a JSX attribute is a site. Use CALLOUT_INTENT.ERROR, ' +
      'BUTTON_VARIANT.SUBTLE or SWITCHER_TONE.HEADER — the literal still type-checks, which is ' +
      'why nothing else catches it, and that is the reason to write the member instead.',
  },
  {
    // Added 4 Sep 2026, task 74.1, and it is the only selector here that guards a RUNTIME value
    // rather than a spelling. React's `'use client'` marks the whole module a client boundary:
    // the bundler replaces every export with a client reference, and only the ones React knows
    // how to render — components — survive the crossing. So an `as const` exported from such a
    // module reads as `undefined` in a Server Component, and a member off it is `undefined` again
    // rather than a throw.
    //
    // **Nothing else can see it.** TypeScript resolves the import against the *source* module,
    // where the value is real, and is right to; `next build` succeeds; the page renders. What
    // shipped was a call to action painted `--accent` on `--globalbar-surface` — pine on pine at
    // about 1.4:1 — because `tone={BUTTON_TONE.BAND}` passed `undefined` and `.filter(Boolean)`
    // dropped the class. Four vocabularies in `packages/ui` and one in `apps/web` were living this
    // way; one had a server reader, and the other four were waiting for theirs.
    //
    // The fix is a sibling module with no directive (`*-vocabulary.ts`), which the barrel exports
    // DIRECTLY — a re-export routed back through the client module is still a client reference,
    // so this selector is also what stops the fix being tidied away. Sites fixed first, then the
    // gate: it starts green.
    selector:
      "Program:has(> ExpressionStatement[directive='use client']) > ExportNamedDeclaration > " +
      'VariableDeclaration > VariableDeclarator > TSAsExpression',
    message:
      'A closed vocabulary may not be declared in a module carrying `\'use client\'` ' +
      '(CLAUDE.md, "A closed vocabulary is declared once"). The directive makes every export a ' +
      'client reference, so a Server Component importing this gets `undefined` — silently, and ' +
      'past typecheck, lint and build alike. Move the `as const` to a sibling module with no ' +
      'directive and import it back; see packages/ui/src/primitives/button-vocabulary.ts.',
  },
];

/**
 * **A component that slots may not be a client boundary** (root `CLAUDE.md`, "Conventions") —
 * added 7 Sep 2026, from a defect that 500'd two screens for three days.
 *
 * The same family as the last selector above, and the second time a `'use client'` directive has
 * changed what a Server Component sees without changing anything a gate could read. There it was
 * the module's *exports* (an `as const` arriving `undefined`); here it is the module's *children*.
 *
 * `Slot` does not render its child, it **introspects** it — `React.Children.count`,
 * `isValidElement`, then `cloneElement` with the merged props. The directive makes the module a
 * boundary, and children a Server Component writes for a boundary cross it as a Flight reference
 * (`$$typeof: Symbol(react.lazy)`), not as an element. react-slot 1.3.3 unwraps one such layer
 * (`use(children._payload)`) and the payload is already *fulfilled*, so the guard fires and still
 * does not yield a single element; Slot throws *"Slot failed to slot onto its children"* and takes
 * the route down with a 500.
 *
 * `Button` carried the directive from task 20 and never needed it — no hook, no browser API, no
 * handler of its own — which is why nothing noticed until task 26.3 gave it the `asChild` seam.
 * `TextLink` carries the identical seam, has never had the directive, and has worked from a Server
 * Component throughout: it was the control, and the fix was to make the two consistent.
 *
 * **Three properties made it worth a gate rather than a fix.** It presented as a screen bug and was
 * a directive, so the search started in the wrong workspace. It was *intermittent* — the failing
 * arm renders only when the tenant read answers READY, so a screen whose data call had failed
 * served a clean error state and looked healthy. And every other gate was green and right to be:
 * TypeScript resolves the import against the source module, and `next build` succeeds.
 *
 * **Deliberately narrower than the mechanism** (recorded 7 Sep 2026 rather than left to be
 * rediscovered). The general defect is *introspecting caller-supplied children across a boundary*,
 * which would mean matching `Children.*` and `cloneElement` in any `'use client'` module — and a
 * selector cannot tell whether those children came from a Server Component or from the client
 * parent one line up, where the same code is correct and ordinary. Such a rule would start green
 * and fire on legitimate code later, which trains the inline disable the `align="end"` note above
 * exists to avoid. `Slot` is decidable for a narrower reason than "slotting is a server thing":
 * *importing* it is how you build your own slotting primitive, and such a primitive is
 * presentational by construction. Using a Radix part's own `asChild` is a different act and stays
 * legitimate in a client boundary — `combobox.tsx`, `select.tsx`, `language-switcher.tsx` and
 * `consequence-dialogue.tsx` all do it, correctly, and none imports `Slot`.
 *
 * The known gap is `account-menu.tsx`, which wraps a caller-supplied `items[].node` in Radix's own
 * `DropdownMenu.Item asChild`. It cannot be covered here — it needs `'use client'` for the menu's
 * state, so the rule for it is *"do not pass slotted children across the boundary"*, which belongs
 * to the caller and is not a shape a syntax selector can see. It is safe today because its only
 * caller is itself a Client Component.
 *
 * Spread into every block that sets `no-restricted-syntax`, for the reason the constants above
 * document: the option REPLACES rather than merges.
 */
const restrictedSyntaxClientBoundary = [
  {
    // Both spellings, because closing the umbrella import while leaving the direct one open would
    // make the workaround the first thing a reader reaches for. Only `packages/ui` depends on
    // `radix-ui` today and nothing depends on `@radix-ui/react-slot` at all — the second half is
    // one line of insurance, not an abstraction.
    selector:
      "Program:has(> ExpressionStatement[directive='use client']) > ImportDeclaration" +
      ":matches([source.value='@radix-ui/react-slot'], " +
      "[source.value='radix-ui']:has(ImportSpecifier[imported.name='Slot']))",
    message:
      'A component that slots may not be a client boundary (CLAUDE.md, "Conventions"). `Slot` ' +
      'does not render its child, it INTROSPECTS it — Children.count, isValidElement, ' +
      'cloneElement — and `\'use client\'` makes this module a boundary, so children written by ' +
      'a Server Component arrive as a Flight reference (Symbol(react.lazy)) rather than an ' +
      'element. Slot then throws "Slot failed to slot onto its children" and 500s the route — ' +
      'intermittently, and past typecheck, lint and build alike. Delete the directive: a ' +
      'slotting primitive needs no hook and no browser API. See ' +
      'packages/ui/src/primitives/button.tsx.',
  },
  {
    // The namespace spelling of the SAME import, matched on the **usage** rather than on the
    // import — added after a gate-integrity review proved the asymmetry. The branch above closes
    // `@radix-ui/react-slot` whatever the specifier shape, but the `radix-ui` branch needs a named
    // `Slot`, and `radix-ui` is the package this repository actually imports from: so
    // `import * as Radix from 'radix-ui'` then `<Radix.Slot.Root>` went straight through the one
    // spelling most likely to be reached for once the named form is refused.
    //
    // It cannot be closed at the import, because `import * as Radix from 'radix-ui'` is also how a
    // client module would legitimately reach `Radix.DropdownMenu` — the import says nothing. The
    // usage does. It matches the `Radix.Slot` inside `Radix.Slot.Root` and does NOT match
    // `Slot.Root` itself, so the named-import case above is reported once, by the branch that
    // names the package — verified, not assumed.
    //
    // **Both node types, because JSX has its own.** The first draft matched `MemberExpression`
    // alone and was INERT: `<Radix.Slot.Root>` parses as a `JSXMemberExpression`, so the one
    // spelling this branch exists for was the one it could not see. It looked exactly like a
    // passing rule. A plain `MemberExpression` is still needed for the non-JSX form —
    // `text-link.tsx`'s `asChild ? Slot.Root : 'a'` is one.
    //
    // Zero occurrences of any `.Slot` member access exist in the workspace today (grepped before
    // turning it on, per "fix the sites first"), so this starts green and the theoretical false
    // positive — an unrelated `foo.Slot` in a client module — has no instance to argue about.
    selector:
      "Program:has(> ExpressionStatement[directive='use client']) " +
      ":matches(MemberExpression, JSXMemberExpression)[property.name='Slot']",
    message:
      'A component that slots may not be a client boundary (CLAUDE.md, "Conventions"), and the ' +
      'namespace spelling is the same violation. `Radix.Slot` in a module carrying ' +
      '`\'use client\'` introspects its child across an RSC boundary, where children arrive as a ' +
      'Flight reference rather than an element, and throws "Slot failed to slot onto its ' +
      'children". Delete the directive — a slotting primitive needs no hook and no browser API.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.next/**',
      // Config files and tooling scripts: CommonJS, and outside any tsconfig project, so
      // type-aware rules cannot parse them. Listed individually rather than blanket-ignoring
      // *.cjs — a source file that ends up unlinted is the failure this rule set exists to
      // prevent.
      'eslint.config.mjs', '.dependency-cruiser.cjs', '**/jest.config.cjs',
      '**/postcss.config.mjs',
      // Delivered design prototypes (design_spec.md §11) — reference artefacts, never built.
      'design/**',
      // Shared agent skills, vendored from elsewhere and not ours to lint.
      '.agents/**',
      // Generated by @tanstack/router-plugin from apps/admin/src/app/routes/ on every build.
      // Committed so `pnpm typecheck` needs no prior build, and kept honest by `routes:check`
      // — but machine output, so not ours to lint.
      '**/route-tree.gen.ts',
      // The same case, and it had been missed: openapi-typescript writes this from
      // packages/contracts/openapi/v1.json, it is committed for the same reason, and
      // `openapi:check` regenerates and diffs it. Added 21 Aug 2026, when a duplicated literal
      // inside it was the only lint finding outside a test — a machine's output is not a code
      // convention's business.
      'packages/contracts/src/generated/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        // `allowDefaultProject` rather than an ignore entry for `tools/*.mjs`. The ignores block
        // above lists config files individually on the stated principle that *a source file that
        // ends up unlinted is the failure this rule set exists to prevent* — and the taxonomy
        // extractor is 300 lines of real logic generating a shipped artefact, not config. It
        // belongs to no tsconfig, which is exactly the case this option exists for.
        projectService: { allowDefaultProject: ['tools/*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Surfaces a forgotten await on a repository call, which under RLS would otherwise
      // present as an empty result rather than an error.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      /**
       * `ignoreRestSiblings` — omit-by-destructure is a language idiom, not an unused variable.
       *
       * Added 26 Aug 2026, after the default cost `packages/ui`'s `Button` a real defect. Excluding
       * a component's own props from a DOM spread is written `const { asChild, busy, ...rest }`,
       * and with the rule at its default those two names are "assigned but never used" — so the
       * author discriminated the props union on **key presence** (`'asChild' in props`) instead,
       * to avoid the destructure entirely. That made `asChild={false}` take the Slot branch and
       * throw at render. The lint rule pushed the code into a worse shape than the one it was
       * objecting to.
       *
       * This is the option typescript-eslint documents for exactly that pattern, and turning it on
       * removes the pressure for every component written from here on rather than for the one that
       * hit it. Everything else the rule catches is untouched: a genuinely unused local, parameter
       * or import still fails.
       */
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },

  // ── Duplicated string literals ──────────────────────────────────────────────────────────
  // Added 21 Aug 2026 to put a mechanical check under CLAUDE.md's closed-vocabulary rule.
  //
  // **Read what it actually covers before relying on it, because it is a PARTIAL check and the
  // gap is not the one you would guess.** `no-duplicate-string` carries two constants in its
  // implementation: `MIN_LENGTH = 10`, and `NO_SEPARATOR_REGEXP = /^\w*$/` — where `\w` includes
  // the underscore. So a literal that is one word of word-characters is invisible to it, at any
  // repetition count. Measured on this repo, not assumed: `'unverified'` × 3 and
  // `'password_reset'` × 3 pass clean, while `'a sentence with separators'` × 3 is caught.
  //
  // What that leaves is real and worth having — message keys (`identity.sign_in.credential_invalid`),
  // route paths, SQL fragments and any prose literal all carry separators — but it does NOT see
  // the bare `'unverified'`/`'worker'`/`'expired'` tokens the convention is mostly about. Those
  // stay review-enforced. Saying otherwise in CLAUDE.md would be worse than leaving it unchecked:
  // a rule that matches nothing looks exactly like a rule that passes.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { sonarjs },
    rules: { 'sonarjs/no-duplicate-string': ['error', { threshold: 3 }] },
  },
  // Its exclusions are CLAUDE.md's two exceptions, mechanically — not a noise filter. Enabling
  // it across the repo flagged 28 sites and **not one was production source**: the convention
  // was already universal, and everything caught sat where it deliberately does not apply.
  {
    files: ['**/*.spec.{ts,tsx}', '**/*.e2e-spec.ts', 'apps/api/test/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      // "Tests may assert literals on purpose": a spec pinning `'active'` pins the WIRE value and
      // must break when someone renames the constant, which a spec written in constants never
      // would. Scoped by filename, so a fake under `testing/` is still held to the rule — it
      // models behaviour rather than asserting, and none of them tripped this.
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  {
    files: ['apps/api/src/infrastructure/persistence/migrations/**/*.ts'],
    rules: {
      // "Migration SQL stays literal" — a migration is frozen history, and a constant that can
      // later be renamed would silently rewrite what it says. Nothing here trips the rule today;
      // it is off in advance because the alternative when it does fire is someone reaching for an
      // inline disable, or hoisting a constant into frozen SQL, which is the defect the exception
      // exists to prevent.
      'sonarjs/no-duplicate-string': 'off',
    },
  },

  // The vocabulary selectors, for every workspace. The browser tier and apps/web set
  // `no-restricted-syntax` themselves and therefore REPLACE this — both respread the constant,
  // which is the only reason they still carry it. Tests are exempt for the reason CLAUDE.md
  // gives: a spec compares against the wire value on purpose.
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.spec.{ts,tsx}', '**/*.e2e-spec.ts', 'apps/api/test/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictedSyntaxVocabulary,
        ...restrictedSyntaxClientBoundary,
      ],
    },
  },

  // ── The browser tier: apps/web, apps/admin, packages/ui ─────────────────────────────────
  // Both front ends and the design system. AD-9 makes them two ordinary clients of one API, so
  // the rules that encode project conventions — accessibility, hooks, NFR-26, no user-facing
  // text — apply to both. Framework rules do not; those are the block below.
  {
    files: [
      'apps/web/**/*.{ts,tsx}',
      'apps/admin/**/*.{ts,tsx}',
      'packages/ui/**/*.{ts,tsx}',
    ],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // WCAG 2.2 AA is the target on every screen, admin included. design_spec.md §13.4 makes
      // an accessibility review a merge gate for every screen, and UX-108 is cited directly on
      // A-01 — so scoping a11y to the tenant app would exempt the one admin screen that names
      // an accessibility criterion.
      ...jsxA11y.flatConfigs.recommended.rules,
      'no-restricted-syntax': [
        'error',
        ...restrictedSyntaxFormatting,
        ...restrictedSyntaxText,
        ...restrictedSyntaxVocabulary,
        ...restrictedSyntaxClientBoundary,
      ],
    },
  },

  // ── Next.js only: apps/web ──────────────────────────────────────────────────────────────
  // apps/admin is a Vite SPA (AD-9) and must not inherit any of this. The restricted-syntax
  // list is respread here on purpose — see the constant's comment; omitting the spread would
  // drop NFR-26 from the tenant app.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Pages Router rule. This project is App Router only, so it looks for a `pages/`
      // directory that will never exist and reports its absence on every run.
      '@next/next/no-html-link-for-pages': 'off',

      /**
       * §14.2's `"use cache"` ban is a SECURITY rule, not a performance preference. A cache key
       * the compiler generated without knowing about organization_id would leak a rendered page
       * across tenants ABOVE the RLS boundary of AD-2, where none of its probes would catch it.
       *
       * Next-only because the directive is Next-only. apps/admin holds no tenant data to leak:
       * D-5 gives it no standing access to any organization's report content in the first place.
       */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExpressionStatement > Literal[value="use cache"]',
          message:
            'Cache Components are disabled as a security rule (architecture.md §14.2, AD-9). ' +
            'Every page here is tenant-scoped; a compiler-generated cache key does not know ' +
            'about organization_id and would leak across tenants above the RLS boundary.',
        },
        ...restrictedSyntaxFormatting,
        ...restrictedSyntaxText,
        ...restrictedSyntaxVocabulary,
        ...restrictedSyntaxClientBoundary,
      ],

      /**
       * The locale-aware navigation wrappers from src/i18n/navigation.ts are the only ones this
       * app may use. A raw `next/link` renders a working-looking anchor that drops the locale
       * prefix — nothing throws, nothing logs, and the user lands on a redirect that resets
       * their language.
       *
       * apps/admin has no equivalent rule because it has no locale segment to drop: the console
       * is Romanian-only (architecture.md §18), so its router needs no locale-aware wrapper.
       *
       * Scoped to the members that are locale-aware. `notFound`, `useSearchParams` and
       * `useParams` have no locale dimension and stay available.
       */
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message: "Use `Link` from '@/i18n/navigation' — next/link drops the locale prefix.",
            },
            {
              name: 'next/navigation',
              importNames: ['redirect', 'permanentRedirect', 'usePathname', 'useRouter'],
              message:
                "Use the locale-aware equivalents from '@/i18n/navigation'. notFound, " +
                'useSearchParams and useParams are fine from next/navigation.',
            },
          ],
        },
      ],
    },
  },

  // ── apps/api only: import climbs and the alias ──────────────────────────────────────────
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      /**
       * A relative import that climbs two or more levels uses `@api/*` instead (house rule,
       * 20 Aug 2026). One level (`../dto/x`) stays relative — that is a within-module
       * neighbourhood reference and aliasing it would hide which module a file belongs to.
       * `../../**` is gitignore-style and matches every deeper climb too, since a three-level
       * climb still starts with `../../`.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*', '../../**'],
              message:
                'Use the @api/* alias for anything above the parent directory — a ../../ climb ' +
                'breaks on every file move and hides what is being imported.',
            },
          ],
        },
      ],
    },
  },

  /**
   * The files the TypeORM CLI and the seed runner load — the migration datasource, every
   * migration, and the seed entrypoints — run under plain ts-node with NO paths registration
   * (`db:cli` and `config:seed` in apps/api/package.json), so an `@api/*` import anywhere in
   * their graph fails only at run time, in whichever environment migrates first. This makes it
   * a lint failure instead. The `../../` ban is restated because a later block REPLACES the
   * earlier rule config for matching files rather than merging with it.
   */
  {
    files: [
      'apps/api/src/infrastructure/persistence/migration.data-source.ts',
      'apps/api/src/infrastructure/persistence/migrations/**/*.ts',
      'apps/api/src/infrastructure/configuration/seed-configuration*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@api/*'],
              message:
                'This file is loaded by a ts-node CLI (db:cli / config:seed) that registers no ' +
                'path aliases — @api/* fails there at run time. Keep this graph relative.',
            },
            {
              group: ['../../*', '../../**'],
              message:
                'Use the @api/* alias… except that this file cannot (see above). Restructure so ' +
                'the import is at most one level up, or move the shared code.',
            },
          ],
        },
      ],
    },
  },

  // ── apps/admin only: TanStack Router control flow ───────────────────────────────────────
  {
    files: ['apps/admin/**/*.{ts,tsx}'],
    rules: {
      /**
       * `throw redirect({ to })` is TanStack Router's documented control flow for a route that
       * resolves elsewhere, and `Redirect` is deliberately NOT an Error subclass — the router
       * catches it by identity (`isRedirect`) rather than by type, so making it an Error would
       * mean swallowing real errors that happened to look like one.
       *
       * only-throw-error is therefore correct on the facts and wrong on the intent. The narrow
       * allowance is better than an inline disable: an inline comment would have to be repeated
       * on every route that redirects, and a disable line is invisible to anyone auditing which
       * rules this app actually runs. Everything else still has to throw a real Error.
       *
       * Scoped by declaring package, so an unrelated non-Error throw is still an error here.
       */
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allow: [
            { from: 'package', package: '@tanstack/router-core', name: 'Redirect' },
          ],
        },
      ],
    },
  },

  // Browser-tier specs: the no-user-facing-text half only. A fixture's `<button>Continue</button>`
  // is never shipped, never translated and invisible to the parity gate, so §13.4 has nothing to
  // say about it — but a spec that formats a number is still an NFR-26 violation, which is why
  // `restrictedSyntaxFormatting` is respread here rather than the block simply turning the rule
  // off. The vocabulary selectors stay off, as they are for every spec (see above).
  //
  // LAST in the array on purpose: rule options REPLACE rather than merge, so apps/web's own
  // `no-restricted-syntax` block would overwrite this one if it came after.
  {
    files: [
      'apps/web/**/*.spec.{ts,tsx}',
      'apps/admin/**/*.spec.{ts,tsx}',
      'packages/ui/**/*.spec.{ts,tsx}',
    ],
    // `restrictedSyntaxClientBoundary` IS respread here, unlike the vocabulary selectors, and the
    // asymmetry is the point: a spec asserts a wire literal on purpose (CLAUDE.md's own exception),
    // but nothing legitimately writes `'use client'` beside a `Slot` import in a vitest file — the
    // directive is inert under jsdom, so the rule can only ever fire on the real shape. Leaving it
    // out would have made this the fourth block, and the constant's docblock says *every* block.
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictedSyntaxFormatting,
        ...restrictedSyntaxClientBoundary,
      ],
    },
  },

  // src/i18n/navigation.ts is where the wrappers are created, so it is the one file that must
  // import the module the rule above bans everywhere else.
  {
    files: ['apps/web/src/i18n/navigation.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  /**
   * Build-time Node scripts, linted **without** the type-checked rule set.
   *
   * `tools/extract-vsme-taxonomy.mjs` is plain JavaScript on purpose — it parses four XML
   * attributes to generate `config/seed`'s taxonomy artefacts and runs quarterly, so a TypeScript
   * build step and a parser dependency would both cost more than they return. Type-aware rules on
   * an untyped file produce nothing but `no-unsafe-*`: 286 of them, every one saying "this value
   * has no type", which is true and is not a finding.
   *
   * What is left still bites — undeclared variables, unused bindings, unreachable code — which is
   * the half worth having here. Ignoring the file was the alternative, and the ignores block above
   * rejects it in terms: a source file that ends up unlinted is the failure this rule set exists to
   * prevent.
   *
   * **This paragraph used to claim the `no-restricted-syntax` vocabulary selectors bite here too,
   * and they do not** (corrected 7 Sep 2026, found while adding `eslint:prove`). Every block that
   * sets the rule is scoped to `*.{ts,tsx}`, and `.mjs` is neither — `eslint --print-config
   * tools/prove-eslint.mjs` answers with no `no-restricted-syntax` at all. The claim was wrong from
   * the day it was written, in the file whose own selectors it describes, and nothing could have
   * caught it: a rule that is not configured reports nothing, which is what a clean file also does.
   * Widen a block's `files` if these should apply here; do not re-assert that they already do.
   */
  {
    files: ['tools/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
