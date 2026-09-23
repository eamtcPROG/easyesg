import type { SameSet } from '../same-set';
import type { EventFrame } from './catalogue';

/**
 * The frame's gate (task 148; §12.5.6's task-148 row): **its fields are exactly these three**, so a tenant field — an
 * account, a count, a name — cannot join it without this line failing `typecheck`. Imported by nothing: it exists to be
 * type-checked, as `readable-path.proof.ts` does.
 */
export const FRAME_FIELDS_ARE_EXACTLY_THREE: SameSet<keyof EventFrame, 'event' | 'organizationId' | 'since'> = true;
