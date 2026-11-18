import type { ConsoleRole } from '@easyesg/contracts';
import { Checkbox, Fieldset } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { CONSOLE_ROLE_LABEL, CONSOLE_ROLES } from '../../../tools/console-role-labels';

/**
 * The console roles to hold, as a checklist (task 67.13; FR-80 behaviour 10) — read by the invitation form and by the
 * record's role editor, which ask the same question of the same five roles. Each role says what it opens, so a choice
 * is made from what the person will be able to do rather than from a name.
 */
export function ConsoleRolesChoice({
  value,
  onChange,
  error,
  disabled = false,
}: {
  readonly value: readonly ConsoleRole[];
  readonly onChange: (next: readonly ConsoleRole[]) => void;
  /** Why the choice cannot be sent — no role for a Platform Administrator. */
  readonly error?: string;
  readonly disabled?: boolean;
}) {
  const t = useTranslations('platform.accounts.consoleRoles');

  return (
    <Fieldset legend={t('legend')}>
      {CONSOLE_ROLES.map((role) => (
        <Checkbox
          key={role}
          name="consoleRoles"
          value={role}
          checked={value.includes(role)}
          disabled={disabled}
          label={t(`roles.${CONSOLE_ROLE_LABEL[role]}.name`)}
          help={t(`roles.${CONSOLE_ROLE_LABEL[role]}.opens`)}
          onChange={(event) =>
            onChange(
              event.currentTarget.checked
                ? CONSOLE_ROLES.filter((candidate) => candidate === role || value.includes(candidate))
                : value.filter((candidate) => candidate !== role),
            )
          }
        />
      ))}
      {error === undefined ? null : (
        <p role="alert" className="t-caption text-[var(--state-error)]">
          {error}
        </p>
      )}
    </Fieldset>
  );
}
