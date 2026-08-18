// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import nextPlugin from '@next/eslint-plugin-next';

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
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Surfaces a forgotten await on a repository call, which under RLS would otherwise
      // present as an empty result rather than an error.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // ── The browser tier ────────────────────────────────────────────────────────────────────
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Pages Router rule. This project is App Router only, so it looks for a `pages/`
      // directory that will never exist and reports its absence on every run.
      '@next/next/no-html-link-for-pages': 'off',

      /**
       * NFR-26, whose stated verification is "a static analysis rule in CI" — this is that rule.
       *
       * The sanctioned path is a NAMED format declared once in src/i18n/formats.ts and reached
       * through useFormatter()/getFormatter(). Everything banned here is a way of deciding a
       * format at the call site, which is what "no hardcoded format pattern" forbids.
       *
       * §14.2's `"use cache"` ban rides along: it is a SECURITY rule, not a performance
       * preference. A cache key the compiler generated without knowing about organization_id
       * would leak a rendered page across tenants ABOVE the RLS boundary of AD-2, where none
       * of its probes would catch it.
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
        {
          selector: 'CallExpression > MemberExpression[property.name="toFixed"]',
          message:
            'NFR-26: no hardcoded format pattern. Use a named number format from ' +
            'src/i18n/formats.ts via useFormatter()/getFormatter().',
        },
        {
          selector:
            'CallExpression > MemberExpression[property.name=/^toLocale(String|DateString|TimeString)$/]',
          message:
            'NFR-26: formatting is derived from the active locale through next-intl, not chosen ' +
            'at the call site. Use a named format from src/i18n/formats.ts.',
        },
        {
          selector: 'NewExpression[callee.object.name="Intl"]',
          message:
            'NFR-26: declare the format in src/i18n/formats.ts and reach it by name. A formatter ' +
            'constructed here is a format pattern in a component.',
        },
        {
          selector: 'JSXText[value=/[^\\s]/]',
          message:
            'No user-facing text in code. Wording is versioned configuration published from the ' +
            'admin console (FR-61, FR-62) and revertible in one step (NFR-85); a literal here ' +
            'would need a release to change. Use a message key through useTranslations().',
        },
      ],

      /**
       * The locale-aware navigation wrappers from src/i18n/navigation.ts are the only ones this
       * app may use. A raw `next/link` renders a working-looking anchor that drops the locale
       * prefix — nothing throws, nothing logs, and the user lands on a redirect that resets
       * their language.
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

  // src/i18n/navigation.ts is where the wrappers are created, so it is the one file that must
  // import the module the rule above bans everywhere else.
  {
    files: ['apps/web/src/i18n/navigation.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
