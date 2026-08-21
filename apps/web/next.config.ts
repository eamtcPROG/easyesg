import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // @easyesg/ui ships raw TypeScript + CSS modules (main → src/index.ts) so both bundlers
  // compile one source of truth; Next only does that for a linked package when told to.
  transpilePackages: ['@easyesg/ui'],

  // §10.4 runs this service at 2 replicas with no host ports. Standalone output is what the
  // Compose image copies; verify its file tracing against pnpm's symlink layout on the first
  // Docker build (root CLAUDE.md) — Next traces real paths, pnpm ships links.
  output: 'standalone',

  // A SECURITY setting, not a performance one (architecture.md §14.2, AD-9). Every page here
  // is tenant-scoped. A cache key the compiler generated without knowing about organization_id
  // would leak a rendered page across tenants ABOVE the RLS boundary of AD-2, where none of its
  // probes would see it. The lint rule banning `"use cache"` is the other half; this is the
  // half that means the directive would do nothing even if one slipped through.
  cacheComponents: false,

  // AD-9: stays off until the wizard's render profile is measured. Turning it on before there
  // is a profile is guessing at which renders are hot. Top-level in Next 16 — it graduated out
  // of `experimental`, where every pre-16 example still puts it.
  reactCompiler: false,

  // NFR-81: fail explicitly rather than silently outside the supported browser matrix.
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
