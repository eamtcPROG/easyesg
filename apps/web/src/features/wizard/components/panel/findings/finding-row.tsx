import { FINDING_WEIGHT, TextLink, ValidationFinding, type FindingWeight } from '@easyesg/ui';
import { useFormatter, useMessages, useTranslations } from 'next-intl';
import { FIELD_DETAIL, fieldDetail } from '../../../tools/field-detail';
import { findingWords } from '../../../tools/finding-words';
import type { PanelFinding } from '../../../tools/panel-findings';
import { VALIDATION_MESSAGES } from '../../shared/validation-messages';
import { PANEL_MESSAGES } from '../shared/panel-messages';
import { FindingLink } from './finding-link';

/** A weight's words, by literal key, so a weight the catalogue does not word fails `pnpm typecheck`. */
const WEIGHT_KEY = {
  [FINDING_WEIGHT.MUST_FIX]: 'weight.mustFix',
  [FINDING_WEIGHT.REVIEW]: 'weight.review',
  [FINDING_WEIGHT.CLEARED]: 'weight.cleared',
} as const satisfies Record<FindingWeight, string>;

/**
 * One finding in S-08 (task 42.2; FR-42, UX-22) — its field named as the step names it, its weight, **the same three
 * parts the field shows** (`findingWords`), and the way to the field: **the field's address** (task 42.3,
 * `FindingLink`), which lands focus in it. A finding of inconsistency also links the field it conflicts with (FR-42
 * item 4), at that field's own address.
 *
 * No directive: drawn inside the panel's section, a client boundary already, and it reads its own words (task 158).
 */
export function FindingRow({
  reportId,
  module,
  entry,
}: {
  readonly reportId: string;
  /** The module the panel lists it under — the step it leads to. */
  readonly module: string;
  readonly entry: PanelFinding;
}) {
  const t = useTranslations(PANEL_MESSAGES);
  const tValidation = useTranslations(VALIDATION_MESSAGES);
  const format = useFormatter();
  // The country names by ISO code, the step's own source for them (task 36.9) — a record keyed by a value the read
  // supplies, which a translator call cannot take (`apps/web/CLAUDE.md`, task 158's third kind).
  const countries = useMessages().organization.countries as Readonly<Record<string, string>>;
  const { finding, weight } = entry;
  const words = findingWords({ t: tValidation, format, finding });
  const detail = fieldDetail({ field: finding.field, countries });

  return (
    <ValidationFinding
      field={finding.field.label ?? module}
      detail={
        detail === null ? undefined : detail.kind === FIELD_DETAIL.MEMBER ? detail.label : t('row', { position: detail.position })
      }
      weight={weight}
      weightLabel={t(WEIGHT_KEY[weight])}
      message={words === null ? null : words.join(' ')}
      actions={
        <>
          <TextLink asChild>
            <FindingLink reportId={reportId} module={module} field={finding.field}>
              {t('goToField')}
            </FindingLink>
          </TextLink>
          {finding.related.map((related) => {
            const relatedModule = related.modules[0];
            return relatedModule === undefined ? null : (
              <TextLink key={`${related.elementKey}\u0000${related.dimensionKey}\u0000${related.ordinal}`} asChild>
                <FindingLink reportId={reportId} module={relatedModule} field={related}>
                  {t('goToRelated', { module: relatedModule })}
                </FindingLink>
              </TextLink>
            );
          })}
        </>
      }
    />
  );
}
