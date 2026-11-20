import { DERIVATION_OPERAND_SOURCE, type DerivationSource } from '@easyesg/contracts';
import { derivationInputField } from '@easyesg/validation';
import { TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { writeKey } from '../../../tools/autosave-state';
import { fieldAnchor, fieldHref } from '../../../tools/field-anchor';
import { StepLink } from '../../shared/step-link';
import { FIELD_MESSAGES } from '../shared/step-messages';
import { useInputWords } from '../shared/use-input-words';
import styles from '../styles/step.module.css';

/**
 * **What a computed figure is waiting on, at the figure** (task 254; FR-29, UC-27; `design_spec.md` §6.2's amendment of
 * 20 Nov 2026, `architecture.md` §12.5.6's task-254 row (2)) — in the field's message line while the platform cannot yet
 * work the figure out: that it is worked out automatically, and from what, each operand a link to the box it is
 * answered in. A disclosure on this step and an input beneath the figure are fragments of this page, followed in place;
 * a disclosure on another step — B1's headcount — is that step's address, through `StepLink`, so leaving asks about
 * unsent work first, and focus lands in the field there (`FieldFocus`).
 *
 * **In place of a finding**, which a computed figure no longer carries: no reporter can type the figure, so the step
 * says where the answers it needs are instead of asking for it.
 *
 * No directive: drawn inside `StepField`, a client boundary already, and it reads its own words (task 158).
 */
export function DerivedFromNote({
  reportId,
  sources,
  onStep,
}: {
  readonly reportId: string;
  /** What the figure is worked out from — its field's `derivedFrom`. */
  readonly sources: readonly DerivationSource[];
  /** The element keys this step presents — a disclosure among them is a fragment of this page. */
  readonly onStep: ReadonlySet<string>;
}) {
  const t = useTranslations(FIELD_MESSAGES);
  const inputWords = useInputWords();

  return (
    <span className={styles.derivedFrom}>
      <span>{t('derivedFrom.waiting')}</span>
      <ul className={styles.derivedFromList}>
        {sources.map((source) => {
          if (source.source === DERIVATION_OPERAND_SOURCE.INPUT) {
            const anchor = fieldAnchor(writeKey({ elementKey: derivationInputField(source.key) }));
            return (
              <li key={source.key}>
                <TextLink href={`#${anchor}`}>
                  {t('derivedFrom.below', { name: inputWords[source.key]?.label ?? t('unnamed') })}
                </TextLink>
              </li>
            );
          }
          const name = source.label ?? t('unnamed');
          const field = { elementKey: source.key, dimensionKey: '', ordinal: 0 };
          return (
            <li key={source.key}>
              {onStep.has(source.key) || source.module === null ? (
                <TextLink href={`#${fieldAnchor(writeKey(field))}`}>{t('derivedFrom.here', { name })}</TextLink>
              ) : (
                <TextLink asChild>
                  <StepLink href={fieldHref({ reportId, module: source.module, field })}>
                    {t('derivedFrom.elsewhere', { name, module: source.module })}
                  </StepLink>
                </TextLink>
              )}
            </li>
          );
        })}
      </ul>
    </span>
  );
}
