#!/usr/bin/env bash
# Proves each boundary rule rejects a real violation.
#
# CLAUDE.md: "Prove a deliberate cross-context import actually fails CI — a rule that
# silently matches nothing looks identical to a rule that passes."
#
# Each fixture is written into the path its rule guards, cruised, then removed. A rule
# that fails to reject its fixture fails this script.
set -uo pipefail
cd "$(dirname "$0")/.."

API=apps/api/src
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
  out="$(pnpm exec depcruise --config .dependency-cruiser.cjs "$API" 2>&1)"
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
