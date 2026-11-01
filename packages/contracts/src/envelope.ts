import type { components } from './generated/v1';

/**
 * §6.8's success envelopes, as `apps/api`'s `GlobalResponseInterceptor` emits them.
 *
 * `ResultObject<T>` narrows the generated `ResultObjectDto` (every current route emits it, so
 * openapi-typescript carries it). `ResultList<T>` is **hand-authored against
 * `apps/api/src/app/dto/result-list.dto.ts`** because no list route exists yet, so the schema
 * has never reached the generated file — when the first one lands (task 29), re-derive this
 * from `components['schemas']['ResultListDto']` the way `ResultObject` is derived, and this
 * comment is the reminder.
 */
export type Message = components['schemas']['MessageDto'];

export type ResultObject<T> = Omit<components['schemas']['ResultObjectDto'], 'object'> & {
  object: T;
};

export interface ResultList<T> {
  htmlcode: number;
  objects: T[];
  total: number;
  totalpages: number;
  messages: Message[];
}
