#!/usr/bin/env bash
# Proves each boundary rule rejects a real violation.
#
# CLAUDE.md: "Prove a deliberate cross-context import actually fails CI — a rule that
# silently matches nothing looks identical to a rule that passes."
#
# Each fixture is written into the path its rule guards, cruised, then removed. A rule
# that fails to reject its fixture fails this script.
#
# Fixtures land inside WATCHED source trees. That bit twice on 20 Aug 2026: a running
# `nest start --watch` compiled the api-not-to-contracts-package fixture — which deliberately
# reaches outside apps/api's rootDir — and left stray index.js/.d.ts emits beside
# packages/contracts/src/index.ts, failing lint one gates run later. The structural fix is that
# `**/__boundary_fixture.ts` is excluded from BOTH apps/api tsconfigs (exclude arrays replace,
# not merge — and nest watches on tsconfig.build.json), so no tsc program ever contains a
# fixture; this script walks the cruised roots directly, so the proof still sees them. Keep the
# filename if you add a fixture — the exclusion matches on it.
set -uo pipefail
cd "$(dirname "$0")/.."

API=apps/api/src
WEB=apps/web/src
ADMIN=apps/admin/src
UI=packages/ui/src
I18N=packages/i18n/src
# Must match the roots in package.json's `boundaries` script. A rule anchored at a path this
# script never walks cannot fail, which is the same invisible pass the script exists to catch.
ROOTS=("$API" "$WEB" "$ADMIN" "$UI" "$I18N")
FIXTURES=()
# Removes the fixture files and any directory they had to create, so a proof run leaves
# the tree exactly as it found it.
cleanup() {
  for f in "${FIXTURES[@]:-}"; do
    rm -f "$f"
    rmdir -p "$(dirname "$f")" 2>/dev/null || true
  done
}
trap cleanup EXIT

fail=0

prove() {
  local rule="$1" file="$2" content="$3"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$content" > "$file"
  FIXTURES+=("$file")

  local out
  out="$(pnpm exec depcruise --config .dependency-cruiser.cjs "${ROOTS[@]}" 2>&1)"
  if grep -q "$rule" <<< "$out"; then
    printf '  ok    %s rejects its violation\n' "$rule"
  else
    printf '  FAIL  %s did NOT reject its violation — the rule matches nothing\n' "$rule"
    fail=1
  fi
  rm -f "$file"
}

echo 'Proving boundary rules bite:'

prove core-not-to-billing \
  "$API/modules/core/period/__boundary_fixture.ts" \
  "import { CatalogueModule } from '../../billing/catalogue/catalogue.module';
export const violation = CatalogueModule;"

prove billing-not-to-core \
  "$API/modules/billing/order/__boundary_fixture.ts" \
  "import { PeriodModule } from '../../core/period/period.module';
export const violation = PeriodModule;"

# Deliberately violates THROUGH the @api/* alias rather than relatively: this fixture is also
# the proof that an aliased import still resolves to a path the boundary rules match on. If
# tsconfig.boundaries.json loses the @api mapping, this fails — and so does api-no-unresolvable.
prove controllers-not-to-use-cases \
  "$API/modules/identity/account/controllers/__boundary_fixture.ts" \
  "import { VerifyEmail } from '@api/modules/identity/account/use-cases/verify-email.use-case';
export const violation = VerifyEmail;"

prove api-no-unresolvable \
  "$API/app/constants/__boundary_fixture.ts" \
  "import { nothing } from '@api/no-such-module';
export const violation = nothing;"

prove cross-cutting-not-to-modules \
  "$API/app/__boundary_fixture.ts" \
  "import { PeriodModule } from '../modules/core/period/period.module';
export const violation = PeriodModule;"

prove contracts-is-a-leaf \
  "$API/contracts/__boundary_fixture.ts" \
  "import { MessageDto } from '../app/dto/message.dto';
export const violation = MessageDto;"

prove domain-free-of-frameworks \
  "$API/modules/core/disclosure/domain/__boundary_fixture.ts" \
  "import { Injectable } from '@nestjs/common';
@Injectable()
export class Violation {}"

prove api-not-to-contracts-package \
  "$API/__boundary_fixture.ts" \
  "export * from '../../../packages/contracts/src/index';"

prove web-not-to-commerce \
  "$WEB/features/reporting/__boundary_fixture.ts" \
  "import { } from '../commerce';
export const violation = 1;"

prove web-public-is-a-leaf \
  "$WEB/features/public/__boundary_fixture.ts" \
  "import { } from '../reporting';
export const violation = 1;"

prove web-not-to-api-src \
  "$WEB/__boundary_fixture.ts" \
  "export * from '../../api/src/contracts/types/time';"

prove client-not-to-server \
  "$WEB/client/__boundary_fixture.ts" \
  "import { refreshCookieName } from '../server/session';
export const violation = refreshCookieName;"

prove ui-is-presentational \
  "$UI/__boundary_fixture.ts" \
  "export * from '../../../apps/web/src/lib/session-cookie';"

# ── apps/admin, and the separation between the two front ends ────────────────────────────────

prove admin-not-to-api-src \
  "$ADMIN/__boundary_fixture.ts" \
  "export * from '../../api/src/contracts/types/time';"

prove admin-not-to-web \
  "$ADMIN/lib/__boundary_fixture.ts" \
  "export * from '../../../web/src/lib/session-cookie';"

prove web-not-to-admin \
  "$WEB/lib/__boundary_fixture.ts" \
  "export * from '../../../admin/src/lib/pagination';"

prove admin-platform-not-to-billing \
  "$ADMIN/features/platform/taxonomy/__boundary_fixture.ts" \
  "export * from '../../billing/catalogue';"

prove admin-billing-not-to-platform \
  "$ADMIN/features/billing/catalogue/__boundary_fixture.ts" \
  "export * from '../../platform/configuration';"

prove admin-realm-is-a-leaf \
  "$ADMIN/realm/__boundary_fixture.ts" \
  "export * from '../features/platform/admin';"

prove admin-shared-is-a-leaf \
  "$ADMIN/shared/__boundary_fixture.ts" \
  "export * from '../features/billing/invoicing';"

prove i18n-is-a-leaf \
  "$I18N/__boundary_fixture.ts" \
  "export * from '../../ui/src/index';"

# A cycle needs both halves present. The partner is written here and registered for cleanup;
# prove() writes the other half and does the cruise.
PARTNER="$API/modules/platform/audit/__boundary_fixture_b.ts"
mkdir -p "$(dirname "$PARTNER")"
printf '%s\n' "import { a } from './__boundary_fixture_a';
export const b = a;" > "$PARTNER"
FIXTURES+=("$PARTNER")

prove no-circular \
  "$API/modules/platform/audit/__boundary_fixture_a.ts" \
  "import { b } from './__boundary_fixture_b';
export const a = b;"

if [ "$fail" -ne 0 ]; then
  echo
  echo 'At least one boundary rule is inert. Fix the rule, not the fixture.'
  exit 1
fi

echo
echo 'All boundary rules reject their violations.'
