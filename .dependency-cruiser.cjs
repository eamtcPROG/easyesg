/**
 * Boundary rules (AD-1, DR-1, and CLAUDE.md's clean-architecture dependency rule).
 *
 * CLAUDE.md: "Prove a deliberate cross-context import actually fails CI — a rule that
 * silently matches nothing looks identical to a rule that passes." Every rule below has a
 * counter-fixture in tools/prove-boundaries.sh, which asserts each one still rejects it.
 *
 * Rules 1-6 guard apps/api; 7-11 guard apps/web and packages/ui; 12-18 guard apps/admin and the
 * separation between the two front ends; no-circular guards everything cruised. The `boundaries`
 * script names all four roots — a rule anchored at a path that is never walked is inert in the
 * same invisible way.
 */
module.exports = {
  forbidden: [
    {
      name: 'core-not-to-billing',
      comment:
        'DR-1: the compliance core knows nothing about plan, price or tenant type. The shortest ' +
        'path to "show the plan name on the report page" is always a direct import, which is why ' +
        'this is a build failure and not a review note. Go through contracts/entitlement.port.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/core' },
      to: { path: '^apps/api/src/modules/billing' },
    },
    {
      name: 'billing-not-to-core',
      comment:
        'DR-1, the other direction. billing references the organization by id with no FK ' +
        '(NFR-15); it must not reach into core code either.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/billing' },
      to: { path: '^apps/api/src/modules/core' },
    },
    {
      name: 'cross-cutting-not-to-modules',
      comment:
        'app/ is cross-cutting only. Code there that reaches into a domain has stopped being ' +
        'cross-cutting, and app/ would otherwise become the path of least resistance for the ' +
        'one helper that reads both core and billing.',
      severity: 'error',
      from: { path: '^apps/api/src/app/' },
      to: { path: '^apps/api/src/modules' },
    },
    {
      name: 'api-not-to-contracts-package',
      comment:
        'apps/api PRODUCES @easyesg/contracts (the OpenAPI client). Importing it back is a cycle, ' +
        'and it is the only way the two things called "contracts" can actually be confused in code. ' +
        'The in-process port surface is apps/api/src/contracts/.',
      severity: 'error',
      from: { path: '^apps/api/src' },
      to: { path: 'packages/contracts' },
    },
    {
      name: 'contracts-is-a-leaf',
      comment:
        'contracts/ is the shared kernel every context imports, so it must depend on nothing inside ' +
        'the app. If it can reach into app/, modules/ or infrastructure/, then core importing ' +
        'contracts transitively imports whatever contracts reached for — and DR-1 leaks through the ' +
        'one surface that exists to hold it. Shared primitives live here; they do not get fetched ' +
        'from elsewhere.',
      severity: 'error',
      from: { path: '^apps/api/src/contracts' },
      to: { path: '^apps/api/src/(app|modules|infrastructure)/' },
    },
    {
      name: 'domain-free-of-frameworks',
      comment:
        'CLAUDE.md: "Domain and use-case code must not import NestJS, TypeORM, Express, Redis, ' +
        'BullMQ or any HTTP/ORM type. If a domain file needs a decorator or a repository class to ' +
        'compile, the layering is wrong." The check is testability: these run with no DB, no broker, ' +
        'no HTTP.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/[^/]+/[^/]+/(domain|use-cases)' },
      to: {
        dependencyTypes: ['npm'],
        // Must match the RESOLVED path, not the bare specifier: dependency-cruiser reports
        // npm dependencies as node_modules/... , so an anchored '^@nestjs' matches nothing
        // and the rule looks green while enforcing nothing.
        path: 'node_modules/(@nestjs|typeorm|express|ioredis|bullmq)(/|$)',
      },
    },
    {
      name: 'web-not-to-commerce',
      comment:
        'A6: with BILLING_ENABLED=false the reporting core must still pass UC-17…48 end to end, ' +
        'which is also the standing verification that Layer 1 holds no commercial logic (D-11). ' +
        'IMPLEMENTATION_PLAN Phase 9 states it as a build rule: "no screen from an earlier phase ' +
        'may import a commerce component." The realistic violation is a plan badge on the home ' +
        'screen. The billing route subtree is exempt because rendering commerce is its job.',
      severity: 'error',
      from: {
        path: '^apps/web/src/(?!features/commerce/|app/\\[locale\\]/\\(app\\)/\\(workspace\\)/billing/)',
      },
      to: { path: '^apps/web/src/features/commerce' },
    },
    {
      name: 'web-public-is-a-leaf',
      comment:
        'IMPLEMENTATION_PLAN Phase 10: the public site "depends on nothing from phases 4-9. ' +
        'Nothing later depends on them either." That is what makes it pullable forward if ' +
        'commercial timing demands it. An import from features/public into any authenticated ' +
        'feature quietly removes that property. packages/ui is the shared surface, as intended.',
      severity: 'error',
      from: { path: '^apps/web/src/features/public' },
      to: { path: '^apps/web/src/features/(?!public)' },
    },
    {
      name: 'web-not-to-api-src',
      comment:
        'DR-11: apps/web is an ordinary client of the public API, not a privileged backend. The ' +
        'wire contract is @easyesg/contracts, generated from source and diffed in CI (P-5). ' +
        'Reaching into apps/api/src would couple the front end to server internals that no ' +
        'OpenAPI diff or contract test would ever see change.',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: { path: '^apps/api/src' },
    },
    {
      name: 'client-not-to-server',
      comment:
        'AD-9: the Next server tier holds the httpOnly refresh cookie and forwards a short-lived ' +
        'access token, "so no token is exposed to browser JavaScript". src/server also holds ' +
        'SESSION_SECRET via lib/env. One import from a client component bundles the credential ' +
        'into the browser. server-only fails the build too; this fails CI, and the two failures ' +
        'catch different mistakes.',
      severity: 'error',
      from: { path: '^apps/web/src/client' },
      to: { path: '^apps/web/src/server' },
    },
    {
      name: 'ui-is-presentational',
      comment:
        'packages/ui is consumed by apps/web AND apps/admin (§10.7), and its values are the ' +
        'single source of truth for the print layer and email too (UX-127). A dependency on an ' +
        'app inverts that and makes the design system unusable from the other side.',
      severity: 'error',
      from: { path: '^packages/ui/src' },
      to: { path: '^apps/' },
    },
    {
      name: 'admin-not-to-api-src',
      comment:
        'DR-11 and P-5: both front ends are ordinary clients of one documented, versioned API. ' +
        'The mirror of web-not-to-api-src. Reaching into apps/api/src for a type or a constant ' +
        'couples the console to server internals that the OpenAPI diff never sees, so the wire ' +
        'contract stops being the contract. Types come from @easyesg/contracts.',
      severity: 'error',
      from: { path: '^apps/admin/src' },
      to: { path: '^apps/api/src' },
    },
    {
      name: 'admin-not-to-web',
      comment:
        'NFR-65: the administrative surface shares no session, cookie scope or credential with ' +
        'the tenant surface, and AD-9 rejected an admin route group inside apps/web for exactly ' +
        'that reason. Shared code is how that separation erodes — the first import is always a ' +
        'harmless-looking session-cookie helper or fetch wrapper, and it arrives carrying the ' +
        'assumptions of the surface it was written for. Shared code goes in packages/.',
      severity: 'error',
      from: { path: '^apps/admin/src' },
      to: { path: '^apps/web/src' },
    },
    {
      name: 'web-not-to-admin',
      comment:
        'NFR-65, the other direction. The tenant application must not import console code: the ' +
        'console is built against esg_admin_ro and cross-tenant rollups (§7.6), and anything ' +
        'written under those assumptions is wrong inside a tenant-scoped request.',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: { path: '^apps/admin/src' },
    },
    {
      name: 'admin-platform-not-to-billing',
      comment:
        'DR-1 and D-11 in the console: billing and the compliance platform are separate bounded ' +
        'contexts, and the front end is where that is easiest to forget because one operator sees ' +
        'both in one navigation. The mirror of core-not-to-billing. This rule is what makes ' +
        'BILLING_ENABLED=false testable on this surface — with it, the /billing subtree goes dark ' +
        'and every platform screen still works; without it, one import decides otherwise.',
      severity: 'error',
      from: { path: '^apps/admin/src/features/platform' },
      to: { path: '^apps/admin/src/features/billing' },
    },
    {
      name: 'admin-billing-not-to-platform',
      comment:
        'DR-1 and D-11, the other direction. The pull here is real and specific: A-09 is ' +
        'config-as-data like A-03/A-04/A-05/A-17, so the generic versioned-config editor looks ' +
        'like it belongs in features/platform/configuration. It does not — it belongs in ' +
        'src/shared/ (or packages/ui once OQ-38 closes), reachable from both contexts without ' +
        'either depending on the other.',
      severity: 'error',
      from: { path: '^apps/admin/src/features/billing' },
      to: { path: '^apps/admin/src/features/platform' },
    },
    {
      name: 'admin-realm-is-a-leaf',
      comment:
        'The mirror of contracts-is-a-leaf. realm/ holds the session, the API client and the ' +
        'route guards — the things every feature depends on. A reference in the other direction ' +
        'makes whatever it reached for a transitive dependency of both bounded contexts at once, ' +
        'and the platform/billing separation leaks through the one surface that spans them.',
      severity: 'error',
      from: { path: '^apps/admin/src/realm' },
      to: { path: '^apps/admin/src/features' },
    },
    {
      name: 'admin-shared-is-a-leaf',
      comment:
        'src/shared/ exists to hold what BOTH contexts need — the generic config-as-data editor ' +
        'and the UX-123 blast-radius flow. It is only safe as a leaf: the moment it imports a ' +
        'feature, it becomes a path from billing to platform that the two rules above cannot ' +
        'see, and it launders exactly the dependency they forbid.',
      severity: 'error',
      from: { path: '^apps/admin/src/shared' },
      to: { path: '^apps/admin/src/features' },
    },
    {
      name: 'no-circular',
      comment:
        'A cycle here is a design smell, not a packaging problem. forwardRef is not an approved ' +
        'fix: if two modules need each other, the shared concept belongs in a third or the ' +
        'dependency should be inverted through a port.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.boundaries.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '(^|/)(dist|coverage)/' },
  },
};
