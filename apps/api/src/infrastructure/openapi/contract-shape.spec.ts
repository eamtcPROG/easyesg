import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Shape rules over the **committed** contract — hermetic, no boot, no database.
 *
 * `openapi:check` proves the spec matches the source that produced it; it cannot prove the spec is
 * a good one, because it regenerates both sides and diffs them against each other. A DTO that
 * publishes a bad shape stays green there forever.
 *
 * ## `default` on a request property
 *
 * **This is a gate because the same defect arrived three times.** openapi-typescript treats a
 * property carrying a `default` as always present and emits it **required**, so a generated client
 * obliges every caller to send a field the schema's own `required` list omits. It was met and fixed
 * at `SignInRequestDto.remember` (task 97), then met again the next day at
 * `CreateReportRequestDto.scope` — and the sweep that followed found a third,
 * `ChangePasswordRequestDto.terminateOtherSessions`, that nothing had noticed at all. The root
 * `CLAUDE.md`'s rule is that *a finding that recurs graduates into a mechanical gate*, and the
 * sites were fixed first, so this starts green.
 *
 * The default itself is not the problem and does not disappear: it belongs in the property's
 * description, where a reader needs it, and in the use case, where it can actually be applied.
 *
 * **Request bodies only.** A `default` on a *response* property is a different claim — the server
 * really does always send it — and narrowing the rule is what keeps it true rather than merely
 * enforced.
 */
type Schema = {
  properties?: Record<string, { default?: unknown }>;
  required?: string[];
};

type Document = {
  paths: Record<string, Record<string, { requestBody?: unknown }>>;
  components: { schemas: Record<string, Schema> };
};

const contract = JSON.parse(
  readFileSync(join(__dirname, '../../../../../packages/contracts/openapi/v1.json'), 'utf8'),
) as Document;

/** Every schema a request body points at, by name — resolved from the paths rather than guessed
 *  from a `Request` suffix, so a DTO named otherwise is still covered. */
const requestSchemaNames = (): Set<string> => {
  const names = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    const record = node as Record<string, unknown>;
    const ref = record.$ref;
    if (typeof ref === 'string') names.add(ref.replace('#/components/schemas/', ''));
    for (const value of Object.values(record)) walk(value);
  };

  for (const operations of Object.values(contract.paths)) {
    for (const operation of Object.values(operations)) {
      if (operation.requestBody !== undefined) walk(operation.requestBody);
    }
  }
  return names;
};

describe('the published contract’s shape', () => {
  it('finds request bodies at all', () => {
    // A rule over an empty set passes — the `boundaries:prove` guard, again.
    expect(requestSchemaNames().size).toBeGreaterThan(10);
  });

  it('publishes no request property carrying a schema default', () => {
    const offences = [...requestSchemaNames()]
      .flatMap((name) => {
        const schema = contract.components.schemas[name];
        return Object.entries(schema?.properties ?? {})
          .filter(([, spec]) => spec.default !== undefined)
          .map(([property]) => `${name}.${property}`);
      })
      .sort();

    expect(offences).toEqual([]);
  });
});
