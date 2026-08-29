import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AppModule } from '@api/app.module';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import {
  REQUIRED_ROLES,
  REQUIRES_ACCOUNT,
} from '@api/modules/identity/membership/constants/membership.constants';
import { IS_PUBLIC } from '@api/app/decorators/public.decorator';

/**
 * **Every route on the surface states its permission, and the statement is committed** (task 28.2).
 *
 * The task row asks for permissions "applied to every route rather than to the ones someone
 * remembered", and that is a claim about a *surface*, not about the routes a reviewer happened to
 * open. So this file does not check that each route has *something* — it pins **what** each route
 * has, as one table compared with `toEqual` against the whole surface derived from the source.
 *
 * That shape catches three different mistakes with one assertion, and the second two are the ones a
 * presence check would wave through:
 *
 *  - a **new route with no declaration** — it appears in the computed surface, is absent from the
 *    table, and the diff names it;
 *  - a route whose permission **changed** — `GET /members` quietly moving from
 *    `organization_administrator` to any authenticated account is a privilege escalation that
 *    compiles, passes every other test, and shows up here as one changed line;
 *  - a route that was **deleted** while its entry stayed, which is how a table like this normally
 *    rots into fiction.
 *
 * **It is hermetic, and deliberately so.** The surface is read from `@Module` and `@Controller`
 * metadata by walking the import graph from `AppModule` — no container, no provider instantiated,
 * no database. `emit-openapi.ts` established that decorator metadata is readable without a live
 * application; this needs even less, since it never builds the graph at all. Eight of the ten gates
 * run with no Docker and this one keeps that true.
 *
 * **What it deliberately does not check** is the *entitlement* axis (`@RequiresEntitlement`, task
 * 54's guard). Decided 27 Aug 2026 with the project owner: requiring an annotation before the guard
 * that reads it exists would put thirty-one assertions on the surface that nothing can verify, most
 * of them exemptions, and unverifiable annotations decay before their reader arrives. Authorization
 * and entitlement are two questions with two guards and two tasks.
 *
 * **This module is the table and the walk; the two gates over it live elsewhere.**
 * `route-permissions.spec.ts` is the hermetic one — it asserts that the surface *declares* what this
 * table says. `test/route-matrix.e2e-spec.ts` is the other half: it asserts the declarations are
 * *enforced*, by deriving each actor's expected outcome from this same table and driving real HTTP.
 * One table, two claims — a second copy of it would let "declared" and "enforced" drift apart, which
 * is precisely the pair that must not.
 *
 * **Two things about where it lives, and the second is the boundary rules teaching a lesson.** It
 * sits under `testing/` because `tsconfig.build.json` excludes that directory: the table describes
 * the surface for the gates and has no runtime caller, so it must not reach `dist` — while staying
 * inside `tsconfig.json`'s program, so a route renamed in a controller breaks `pnpm typecheck` here
 * rather than at a gate. And it sits at **`src/testing/` rather than `src/app/testing/`**, for
 * exactly the reason `app.module.ts` sits at `src/`: `cross-cutting-not-to-modules` forbids `app/`
 * from importing `modules/**`, and a table describing every module's routes names every module by
 * definition. Written under `app/` first; the rule rejected it, which is the rule working.
 */

/**
 * Every role, as `computeSurface` renders a multi-role declaration: sorted and joined, so the
 * table's spelling cannot depend on the order the decorator happened to list them in.
 */
/** The three ways a route may state who reaches it. There is no fourth, and no default. */
export const PERMISSION = {
  /**
   * No session. Every use carries its own reason at the call site — see `public.decorator.ts`,
   * which enumerates the three legitimate classes and warns that the admin realm's `@Public()`
   * means public to the *tenant* guard and nothing more.
   */
  PUBLIC: 'public',
  /** An authenticated account, with no membership required (FR-12, UC-16). */
  ACCOUNT: 'account',
  /** An authenticated account holding one of these roles in the bound organization (FR-158). */
  ROLE: 'role',
} as const;

type PermissionKind = (typeof PERMISSION)[keyof typeof PERMISSION];

/** `role` carries its roles; the other two are complete on their own. */
type Permission =
  | typeof PERMISSION.PUBLIC
  | typeof PERMISSION.ACCOUNT
  | `${typeof PERMISSION.ROLE}:${string}`;

/**
 * Every role, as `computeSurface` renders a multi-role declaration: sorted and joined, so the
 * table's spelling cannot depend on the order the decorator happened to list them in.
 */
const ALL_MEMBERS: Permission = `${PERMISSION.ROLE}:${[
  MEMBERSHIP_ROLE.EDITOR,
  MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
  MEMBERSHIP_ROLE.VIEWER,
]
  .sort()
  .join('+')}`;

/**
 * **The committed surface.** Sorted by route, so a diff reads as a diff.
 *
 * Adding a route means adding a line here, which is the point: the decision about who reaches it is
 * taken once, in a file a reviewer of the permission model reads, rather than inferred from a
 * decorator three directories away.
 */
export const SURFACE: Readonly<Record<string, Permission>> = {
  // Liveness. NFR-50's probe must not depend on a session or on the database being reachable.
  'GET /health': PERMISSION.PUBLIC,

  // ── The credential funnel. Public because these routes are how a session comes to exist;
  // requiring a token to obtain one is the circularity `public.decorator.ts` names.
  'POST /auth/register': PERMISSION.PUBLIC,
  'POST /auth/verify-email': PERMISSION.PUBLIC,
  'POST /auth/verification-email': PERMISSION.PUBLIC,
  'POST /auth/password-reset-email': PERMISSION.PUBLIC,
  'POST /auth/password-reset': PERMISSION.PUBLIC,
  'POST /auth/session': PERMISSION.PUBLIC,
  'POST /auth/session/factor': PERMISSION.PUBLIC,
  'POST /auth/session/refresh': PERMISSION.PUBLIC,
  // Authenticates by the refresh token itself, so it still works once the access token has expired
  // (AD-12) — which is exactly when someone wants it.
  'DELETE /auth/session': PERMISSION.PUBLIC,

  // ── Social sign-in, the other way a session comes to exist (UC-02, UC-05).
  'GET /auth/social/providers': PERMISSION.PUBLIC,
  'POST /auth/social/:provider/challenge': PERMISSION.PUBLIC,
  'POST /auth/social/:provider/session': PERMISSION.PUBLIC,

  // ── The admin realm. **`public` here means public to the TENANT guard and nothing more**: this
  // surface carries no bearer, and NFR-65 gives it a separate credential store, a sealed
  // `SameSite=Strict` cookie its own handler verifies, an Origin proof and mandatory TOTP.
  // `AdminRealmGuard` — task 67.3, which is the first task that gives it a route to protect — is
  // what will make that a chain rather than a controller checking for itself.
  'POST /auth/admin/session/challenge': PERMISSION.PUBLIC,
  'POST /auth/admin/session': PERMISSION.PUBLIC,
  'GET /auth/admin/session': PERMISSION.PUBLIC,
  'DELETE /auth/admin/session': PERMISSION.PUBLIC,

  // ── A person's own account: credentials, second factor, linked identities (actors.md §5's first
  // row — CA, held by every other human actor "via CA"). `account` and not `role`, because these
  // belong to a person rather than to an organization and are reachable before one is bound.
  'POST /account/password': PERMISSION.ACCOUNT,
  'GET /account/totp': PERMISSION.ACCOUNT,
  'POST /account/totp/enrolment': PERMISSION.ACCOUNT,
  'POST /account/totp/confirmation': PERMISSION.ACCOUNT,
  'POST /account/totp/removal': PERMISSION.ACCOUNT,
  'POST /account/totp/recovery-codes': PERMISSION.ACCOUNT,
  'GET /account/providers': PERMISSION.ACCOUNT,
  'POST /account/providers/:provider': PERMISSION.ACCOUNT,
  'POST /account/providers/:provider/removal': PERMISSION.ACCOUNT,

  // ── Memberships: which organizations this account belongs to (UC-16). `account`, not `role` —
  // its caller is by definition someone who may belong to nothing, and `@RequiresRole` would
  // refuse exactly the person the route exists for.
  'GET /memberships': PERMISSION.ACCOUNT,

  // ── The invitation a person was sent. `preview` is public because the invitee may have no
  // account at all; `acceptance` needs one, and the organization comes from the token rather than
  // from a membership the caller does not yet hold (UC-15).
  'POST /invitations/preview': PERMISSION.PUBLIC,
  'POST /invitations/acceptance': PERMISSION.ACCOUNT,

  // ── Organization users and access — actors.md §5: "Organization users: invite, re-role, remove,
  // promote to OA" is OA alone. RC and viewer are refused, which is what the matrix e2e proves.
  'GET /members': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
  'PATCH /members/:membershipId': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
  'DELETE /members/:membershipId': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
  'GET /invitations': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
  'POST /invitations': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
  'POST /invitations/:invitationId/email': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
  'DELETE /invitations/:invitationId': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,

  // ── Founding an organization, and the vocabulary the founding form is built from (UC-49).
  // `account`, not `role`, for `GET /memberships`' reason exactly: S-04's caller is a verified
  // account with **no** memberships, and `@RequiresRole` refuses the member-of-nothing this route
  // exists for. The legal-form list is behind the same gate rather than public — nothing here is
  // secret, but closed-by-default costs nothing on a route whose only readers are signed in.
  'POST /organizations': PERMISSION.ACCOUNT,
  'GET /organizations/legal-forms': PERMISSION.ACCOUNT,

  // ── The organization profile (UC-50). OA for the **read** as well as the write: actors.md gives
  // RC "explicitly no access to organization settings", and D-2 makes master data OA-owned while
  // the disclosure content is the Contributor's. Seeing the registered address is not a lesser
  // privilege than editing it.
  'GET /organization': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
  'PATCH /organization': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,

  // ── Reporting entities (UC-52, UC-53, UC-55). **The reads are the interesting rows**: D-2 makes
  // master data OA-*owned*, which is about who maintains it, and UC-19 has the Contributor
  // completing B1 from values that pre-populate from this record. Refusing an RC the read would put
  // the wizard's own source out of reach of the person filling it in. Writes stay OA.
  'GET /entities': ALL_MEMBERS,
  // The activity picker (task 30.4.1). Every member, like the entity reads beside it and for the
  // controller's stated reason: an RC completing B1 sees the entity, so refusing them the
  // vocabulary it is classified by would make the wizard's own source unreadable to its author.
  'GET /entities/nace-codes': ALL_MEMBERS,
  'GET /entities/:entityId': ALL_MEMBERS,
  'POST /entities': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
  'PATCH /entities/:entityId': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
  'POST /entities/:entityId/archive': `${PERMISSION.ROLE}:${MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR}`,
};

type Constructor = new (...args: never[]) => object;

/** `@Module({ imports })` holds classes and `DynamicModule`s alike; only the latter wrap a class. */
const moduleClassOf = (entry: unknown): unknown =>
  typeof entry === 'object' && entry !== null && 'module' in entry
    ? entry.module
    : entry;

/** Every controller reachable from `AppModule`, found by walking rather than by a maintained list —
 *  the same discipline `message-keys.spec.ts` applies to error files. */
function controllersOf(root: unknown): Constructor[] {
  const seen = new Set<unknown>();
  const found: Constructor[] = [];

  const walk = (entry: unknown): void => {
    const module = moduleClassOf(entry);
    if (module === undefined || module === null || seen.has(module)) return;
    seen.add(module);

    found.push(...((Reflect.getMetadata('controllers', module) ?? []) as Constructor[]));
    for (const imported of (Reflect.getMetadata('imports', module) ?? []) as unknown[]) {
      walk(imported);
    }
  };

  walk(root);
  return found;
}

const METHOD_NAMES: Readonly<Record<number, string>> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
};

/** `''`, `'/'` and `'session/factor'` all reach here; the surface spells one of them. */
const joinPath = (base: string, own: string): string =>
  `/${[base, own].map((part) => part.replace(/^\/+|\/+$/gu, '')).filter(Boolean).join('/')}`;

/**
 * The permission a route actually resolves to — **method metadata over class metadata**, which is
 * `Reflector.getAllAndOverride`'s rule and therefore the guards' own.
 *
 * Answers `null` where a route declares none. That is not an error here: it is a row that will be
 * absent from the computed surface and therefore a difference the assertion reports, with the route
 * named — which is more useful than a throw from inside a helper.
 */
function permissionOf(controller: Constructor, handler: object): Permission | null {
  const read = <T>(key: string): T | undefined =>
    (Reflect.getMetadata(key, handler) as T | undefined) ??
    (Reflect.getMetadata(key, controller) as T | undefined);

  if (read<boolean>(IS_PUBLIC) === true) return PERMISSION.PUBLIC;

  const roles = read<string[]>(REQUIRED_ROLES);
  if (roles !== undefined && roles.length > 0) return `${PERMISSION.ROLE}:${[...roles].sort().join('+')}`;

  if (read<boolean>(REQUIRES_ACCOUNT) === true) return PERMISSION.ACCOUNT;
  return null;
}

/** `method path` for every handler on the surface, mapped to what it declares. */
export function computeSurface(): Record<string, Permission | null> {
  const surface: Record<string, Permission | null> = {};

  for (const controller of controllersOf(AppModule)) {
    const base = (Reflect.getMetadata(PATH_METADATA, controller) ?? '') as string;
    const prototype = controller.prototype as Record<string, unknown>;

    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (typeof handler !== 'function') continue;

      // No `name === 'constructor'` guard: the constructor is a function and would survive the line
      // above, but it carries no `METHOD_METADATA` — that is set by `@Get`/`@Post` on methods — so
      // the check below already excludes it. One condition rather than two, and no bare literal.

      const verb = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      if (verb === undefined) continue;

      const own = (Reflect.getMetadata(PATH_METADATA, handler) ?? '') as string;
      surface[`${METHOD_NAMES[verb] ?? String(verb)} ${joinPath(base, own)}`] = permissionOf(
        controller,
        handler,
      );
    }
  }

  return surface;
}

export type { Permission, PermissionKind };
