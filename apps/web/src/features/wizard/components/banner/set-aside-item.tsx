'use client';

import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { SetAsideWrite } from '../../tools/autosave-state';
import { SET_ASIDE_SUBJECT, setAsideSubject } from '../../tools/set-aside-subject';
import { StepLink } from '../shared/step-link';
import styles from './set-aside.module.css';

/**
 * One refused answer (task 218): what it is — its field named and led to, as a finding is — why the api refused it, in
 * the api's own words (NFR-79), and *Discard my change*, which lets it go and leaves the field as it is stored.
 */
export function SetAsideItem({
  item,
  reportId,
  onDiscard,
}: {
  readonly item: SetAsideWrite;
  readonly reportId: string;
  readonly onDiscard: (key: string) => void;
}) {
  const t = useTranslations('organization.wizard.queue');
  const subject = setAsideSubject({ reportId, item });
  const name =
    subject.kind === SET_ASIDE_SUBJECT.LINE
      ? t('setAsideLine')
      : subject.kind === SET_ASIDE_SUBJECT.INPUT
        ? t('setAsideInput')
        : [subject.label ?? t('setAsideField'), subject.memberLabel].filter((part) => part !== null).join(' — ');
  const href = subject.kind === SET_ASIDE_SUBJECT.INPUT ? null : subject.href;
  const why = item.refusal.detail ?? item.refusal.title ?? null;

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <span className={styles.name}>{href === null ? name : <StepLink href={href}>{name}</StepLink>}</span>
        {why === null ? null : <span className={styles.why}>{why}</span>}
      </span>
      <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => onDiscard(item.key)}>
        {t('discard')}
      </Button>
    </li>
  );
}
