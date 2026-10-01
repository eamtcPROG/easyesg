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
// The vocabularies come from their own directive-free modules, never through the client
// component: a re-export from a `'use client'` module is still a client reference, so a
// Server Component reading one gets `undefined`. See `primitives/button-vocabulary.ts`.
export {
  BUTTON_TONE,
  BUTTON_VARIANT,
  type ButtonTone,
  type ButtonVariant,
} from './primitives/button-vocabulary';
export { Button, type ButtonProps } from './primitives/button';
export { Panel } from './primitives/panel';
export { ProviderButton, type ProviderButtonProps } from './primitives/provider-button';
export { Skeleton, type SkeletonProps } from './primitives/skeleton';
// Directly, never through `skeleton.tsx` — a re-export routed through a component module is still
// a client reference the day that module gains a directive.
export { SKELETON_SHAPE, type SkeletonShape } from './primitives/skeleton-vocabulary';
export { Badge, type BadgeProps } from './primitives/badge';
export { BADGE_TONE, type BadgeTone } from './primitives/badge-vocabulary';
export { Spinner } from './primitives/spinner';
export { TextLink, type TextLinkProps } from './primitives/text-link';

export {
  FOCUS_MEASURE,
  FocusColumn,
  type FocusColumnProps,
  type FocusMeasure,
} from './archetypes/focus-column';

// form controls
export { FormErrorSummary, type FormErrorSummaryItem, type FormErrorSummaryProps } from './form/form-error-summary';
export {
  DisclosureField,
  FIELD_TONE,
  type DisclosureFieldProps,
  type FieldTone,
} from './disclosure/disclosure-field';
export { CodeField, type CodeFieldProps } from './form/code-field';
export { Checkbox, type CheckboxProps } from './form/checkbox';
export { DateField, type DateFieldProps } from './form/date-field';
export { Combobox, type ComboboxOption, type ComboboxProps } from './form/combobox';
export {
  RecordSection,
  RecordShell,
  type RecordSectionProps,
  type RecordShellProps,
} from './archetypes/record-shell';
// 28 Sep 2026: the Record's card form — the S-13 record artboard's one surface, foot bar and side column.
export {
  RecordCard,
  type RecordCardBack,
  type RecordCardProps,
} from './archetypes/record-card';
// 30 Sep 2026: the heading with its way back, out of `RecordCard` — S-14's Index and Record take S-13's conventions.
export { PageHeading, type PageBack, type PageHeadingProps } from './archetypes/page-heading';
export { WizardShell, type WizardShellProps } from './archetypes/wizard-shell';
// 30 Sep 2026 (task 179.1): S-07 drawn as its artboards — the bar, the step list's groups and rows, and the list below
// `wide`. The states are exported from their directive-free module, the package's rule for a vocabulary.
export { WizardBar, type WizardBarProps } from './archetypes/wizard-bar';
export { WizardModuleGroup, type WizardModuleGroupProps } from './archetypes/wizard-module-group';
export { WizardModuleItem, type WizardModuleItemProps } from './archetypes/wizard-module-item';
export {
  WizardModuleSwitcher,
  type WizardModuleSwitcherProps,
  type WizardSwitcherStep,
} from './archetypes/wizard-module-switcher';
export { WIZARD_STEP_STATE, type WizardStepState } from './archetypes/wizard-step-vocabulary';

export { PasswordField, type PasswordFieldProps } from './form/password-field';
export { Select, type SelectOption, type SelectProps } from './form/select';
export { RequirementList, type RequirementItem, type RequirementListProps } from './form/requirement-list';
export { TextField, type TextFieldProps } from './form/text-field';
export { Fieldset, type FieldsetProps } from './form/fieldset';
export { TextArea, type TextAreaProps } from './form/text-area';

// feedback
export { Banner, type BannerProps } from './feedback/banner';
export { CALLOUT_INTENT, Callout, type CalloutIntent, type CalloutProps } from './feedback/callout';
export {
  ConsequenceDialogue,
  type ConsequenceDialogueProps,
} from './feedback/consequence-dialogue';
export { EmptyState, type EmptyStateProps } from './feedback/empty-state';
export { ExpiringCallout, type ExpiringCalloutProps } from './feedback/expiring-callout';
export { useDismissible } from './feedback/use-dismissible';
// Task 170: a record or a form over a list, and its measure's vocabulary — directly, per the rule above.
export { Dialog, type DialogProps } from './feedback/dialog';
export { DIALOG_SIZE, type DialogSize } from './feedback/dialog-vocabulary';

// navigation
export {
  AccountMenu,
  type AccountMenuItem,
  type AccountMenuLanguage,
  type AccountMenuProps,
} from './navigation/account-menu';
export { GlobalBar, type GlobalBarProps } from './navigation/global-bar';
// Task 83.2: the band's organization region, made the control it was drawn as.
export {
  OrganizationSwitcher,
  type OrganizationSwitcherItem,
  type OrganizationSwitcherProps,
} from './navigation/organization-switcher';
export { SWITCHER_TONE, type SwitcherTone } from './navigation/language-switcher-vocabulary';
export {
  LanguageSwitcher,
  type LanguageSwitcherProps,
  type SwitcherLocale,
} from './navigation/language-switcher';
export { Pagination, type PaginationProps } from './navigation/pagination';
export {
  WorkspaceNav,
  type WorkspaceNavItem,
  type WorkspaceNavItemState,
  type WorkspaceNavProps,
} from './navigation/workspace-nav';
export { ChromeDrawer, type ChromeDrawerProps } from './navigation/chrome-drawer';
// Task 173: a section the reader's role may not open — the band, the drawer and `apps/web`'s account rail draw it.
export { LockedNavEntry, type LockedNavEntryProps } from './navigation/locked-nav-entry';
export { NotificationBell, type NotificationBellProps } from './navigation/notification-bell';
// 28 Sep 2026: the way back from a record to the section it lies beneath — S-13's record first.
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbStep } from './navigation/breadcrumb';
// Task 67.1: the console's side navigation, and the Global bar's tone that draws the console's band.
export { ConsoleNav } from './navigation/console-nav';
export {
  type ConsoleNavItem,
  type ConsoleNavItemState,
  type ConsoleNavProps,
  type ConsoleNavSection,
} from './navigation/console-nav-types';
// Task 170: the console navigation below `wide`, and a row's own actions behind ⋯.
export { ConsoleDrawer, type ConsoleDrawerProps } from './navigation/console-drawer';
export {
  OverflowMenu,
  type OverflowMenuItem,
  type OverflowMenuProps,
} from './navigation/overflow-menu';
export { GLOBAL_BAR_TONE, type GlobalBarTone } from './navigation/global-bar-vocabulary';
// 30 Sep 2026 (task 179.1): the square arrow out of `PageHeading`, now also the wizard's bar's way out.
export { BackArrow, type BackArrowProps } from './navigation/back-arrow';
export { type NavLinkComponent } from './navigation/nav-link';
export { ARIA_CURRENT, type AriaCurrent } from './navigation/nav-link-vocabulary';

// Data display — §11.5
export {
  COLUMN_ALIGN,
  COLUMN_SIZE,
  SORT_DIRECTION,
  type ColumnAlign,
  type ColumnSize,
  type SortDirection,
} from './data-display/data-table-vocabulary';
export {
  DataTable,
  nextSort,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
} from './data-display/data-table';
export {
  STATUS_TONE,
  StatusChip,
  type StatusChipProps,
  type StatusTone,
} from './data-display/status-chip';
// Task 143's inventory addition: the QR symbol beside the secret it encodes, and its loading arm.
export { EnrolmentCode, type EnrolmentCodeProps } from './data-display/enrolment-code';
export {
  EnrolmentCodeLoading,
  type EnrolmentCodeLoadingProps,
} from './data-display/enrolment-code-loading';

// archetypes
export { FocusShell, type FocusShellProps } from './archetypes/focus-shell';
export {
  IndexShell,
  type IndexPage,
  type IndexShellProps,
} from './archetypes/index-shell';

/**
 * Domain components — §11.5's own table, the ones that carry the product. `version-pin-indicator`
 * is the first; the folder held nothing but a `.gitkeep` until task 32.1.1.
 */
export {
  ReportingPeriodPicker,
  periodRangeIsOrdered,
  reportingPeriodFieldIds,
  type ReportingPeriodPickerProps,
  type ReportingPeriodValue,
} from './domain/reporting-period-picker';
export {
  VERSION_PIN_STANDING,
  type VersionPinStanding,
} from './domain/version-pin-indicator-vocabulary';
export {
  VersionPinIndicator,
  type VersionPinIndicatorProps,
} from './domain/version-pin-indicator';
export {
  SAVE_STATE,
  SaveStateIndicator,
  type SaveState,
  type SaveStateIndicatorProps,
} from './domain/save-state-indicator';
// §6.10's two, added by task 142: the counter beside an action and the gate after a refused one.
export { USAGE_STANDING, type UsageStanding } from './domain/usage-counter-vocabulary';
export { UsageCounter, type UsageCounterProps } from './domain/usage-counter';
export {
  EntitlementGate,
  meterExtent,
  type EntitlementGateProps,
} from './domain/entitlement-gate';
