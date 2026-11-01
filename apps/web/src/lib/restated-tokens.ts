/**
 * Token values restated where CSS cannot reach (tasks 82, 152) — a manifest is JSON and a `<meta>` tag cannot read a
 * custom property, so the browser chrome and the splash screen take hex values. **Declared once, here**, for the
 * manifest and the viewport to share, and held to `packages/ui`'s `tokens.css` by `restated-tokens.spec.ts`, so a
 * token that moves fails a test instead of leaving these behind.
 */
export const RESTATED_TOKEN = {
  /** `--accent` in light: `--pine-600`. */
  ACCENT_LIGHT: '#2E6A4F',
  /** `--accent` in dark: `--pine-dark-400`. */
  ACCENT_DARK: '#58B085',
  /** `--surface-sunken` in light — the page ground: `--slate-50`. */
  PAGE_GROUND_LIGHT: '#F4F6F8',
} as const;
