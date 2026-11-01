import type { UrlRule } from '../rule-definition.js';
import { isAbsoluteAddress } from '../address-form.js';
import { addressOf, isDeclaredUnavailable } from '../field-value.js';
import type { Finding } from '../finding.js';
import { rowsAt } from '../value-index.js';
import type { EvaluationContext } from './evaluation-context.js';

/**
 * `url` (task 40.2): an address that is not absolute is `INVALID URL`, **shown verbatim** (FR-40 item 1) — the finding
 * quotes the text exactly as stored, so the reporter sees the address the export would carry. An empty or
 * unavailable field is no finding: there is no address to read.
 */
export function evaluateUrl(rule: UrlRule, context: EvaluationContext): readonly Finding[] {
  return rule.fields.flatMap((field) =>
    rowsAt(context.current, field).flatMap((row) => {
      const text = row.valueText ?? '';
      if (isDeclaredUnavailable(row) || text.trim() === '' || isAbsoluteAddress(text)) return [];
      return [
        {
          rule: rule.id,
          verdict: rule.verdict,
          field: addressOf(row),
          related: [],
          message: rule.message,
          params: { value: text },
        },
      ];
    }),
  );
}
