import type { Finding } from '@easyesg/validation';
import { useFormatter, useTranslations } from 'next-intl';
import { findingWords } from '../../../tools/finding-words';
import { VALIDATION_MESSAGES } from '../../shared/validation-messages';
import styles from '../styles/step.module.css';

/**
 * **A field's findings in the reader's words** (task 42.1; FR-40 item 6, NFR-79; §12.5.6's task-42 row (2)): each one a
 * paragraph of its three parts — what happened, so what, what now — most severe first, as the field's message.
 *
 * **The same sentence S-08 shows for the same finding** (the artboard's *one sentence per problem, the same one twice*),
 * because both word it through `findingWords` from the one shared catalogue. A finding the catalogue does not word is
 * left out rather than shown as a key, which the api's publication rule makes unreachable for a rule set in force.
 *
 * No directive: it is drawn inside `StepField`, a client boundary already, and reads its own words (task 158).
 */
export function FindingMessages({ findings }: { readonly findings: readonly Finding[] }) {
  const t = useTranslations(VALIDATION_MESSAGES);
  const format = useFormatter();
  return findings.map((finding) => {
    const words = findingWords({ t, format, finding });
    return words === null ? null : (
      <p key={`${finding.rule}\u0000${finding.message}`} className={styles.finding}>
        {words.join(' ')}
      </p>
    );
  });
}
