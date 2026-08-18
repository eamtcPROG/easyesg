/**
 * Boundary rules (AD-1, DR-1, and CLAUDE.md's clean-architecture dependency rule).
 *
 * CLAUDE.md: "Prove a deliberate cross-context import actually fails CI — a rule that
 * silently matches nothing looks identical to a rule that passes." Every rule below has a
 * counter-fixture under tools/boundary-fixtures/, and `pnpm boundaries:prove` asserts each
 * one is still rejected.
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
