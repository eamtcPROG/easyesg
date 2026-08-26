/**
 * `@easyesg/ui` — the design system (design_spec.md §11).
 *
 * Task 20 ships the first slice of the §11.5 inventory: the primitives, form controls,
 * feedback and archetype the identity screens (S-01, S-02) instantiate. The build order stays
 * `design/IMPLEMENTATION_PLAN.md`'s; the rest of Phase 1 lands with the screens that need it.
 *
 * Three rules that hold from the first component:
 *
 * - **Tier discipline (UX-78).** Components read tier 3 component tokens, and tier 2 semantic
 *   roles where no tier 3 token exists. A component that reads a tier 1 variable — `--pine-*`,
 *   `--slate-*`, `--space-*` excepted for layout, `--radius-*` — is a defect.
 * - **Swappability (UX-79).** Re-skinning edits tier 1 only. Components never change.
 * - **State completeness (UX-8, UX-90).** Every component documents its applicable §8.1 states
 *   in its docblock before any instance is designed. An undefined state is a defect.
 *
 * And one boundary: **this package owns no text and no router.** Every string arrives
 * localized as a prop (no internal identifier may reach a screen), and navigation arrives as
 * the app's own anchors through slots/render props — `ui-is-presentational` enforces the
 * dependency direction, these APIs are what make it workable.
 */

// primitives
export { BrandMark } from './primitives/brand-mark';
export { Button, type ButtonProps } from './primitives/button';
export { Panel } from './primitives/panel';
export { ProviderButton, type ProviderButtonProps } from './primitives/provider-button';
export { Spinner } from './primitives/spinner';
export { TextLink, type TextLinkProps } from './primitives/text-link';

// form controls
export { FormErrorSummary, type FormErrorSummaryItem, type FormErrorSummaryProps } from './form/form-error-summary';
export { PasswordField, type PasswordFieldProps } from './form/password-field';
export { Select, type SelectOption, type SelectProps } from './form/select';
export { RequirementList, type RequirementItem, type RequirementListProps } from './form/requirement-list';
export { TextField, type TextFieldProps } from './form/text-field';

// feedback
export { Callout, type CalloutProps } from './feedback/callout';
export {
  ConsequenceDialogue,
  type ConsequenceDialogueProps,
} from './feedback/consequence-dialogue';
export { EmptyState, type EmptyStateProps } from './feedback/empty-state';

// navigation
export { LanguageSwitcher, type LanguageSwitcherProps, type SwitcherLocale } from './navigation/language-switcher';
export { Pagination, type PaginationProps } from './navigation/pagination';
export {
  WorkspaceNav,
  type WorkspaceNavItem,
  type WorkspaceNavProps,
} from './navigation/workspace-nav';

// Data display — §11.5
export {
  COLUMN_ALIGN,
  DataTable,
  SORT_DIRECTION,
  nextSort,
  type DataTableColumn,
  type DataTableProps,
  type ColumnAlign,
  type DataTableSort,
  type SortDirection,
} from './data-display/data-table';
export {
  STATUS_TONE,
  StatusChip,
  type StatusChipProps,
  type StatusTone,
} from './data-display/status-chip';

// archetypes
export { FocusShell, type FocusShellProps } from './archetypes/focus-shell';
