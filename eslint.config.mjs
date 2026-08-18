// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * One flat config for the workspace. Type-aware rules are on: AD-13 pins TypeScript at 6.x
 * partly to keep type-aware ESLint working, so running it untyped would waste the constraint.
 *
 * Boundary enforcement is NOT here — dependency-cruiser owns it (.dependency-cruiser.cjs),
 * because DR-1's rule is about module graphs, not syntax.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      // Config files and tooling scripts: CommonJS, and outside any tsconfig project, so
      // type-aware rules cannot parse them. Listed individually rather than blanket-ignoring
      // *.cjs — a source file that ends up unlinted is the failure this rule set exists to
      // prevent.
      'eslint.config.mjs',
      '.dependency-cruiser.cjs',
      '**/jest.config.cjs',
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
);
