import 'server-only';
import { env } from '@/lib/env';

/**
 * The typed client for the public API. **The only place that knows the wire conventions.**
 *
 * Three response shapes have to be told apart, and getting this wrong once means getting it
 * wrong everywhere — which is why it is written here and nowhere else (§6.8):
 *
 * 1. **Success is enveloped.** A global interceptor wraps every success in `ResultObjectDto<T>`
 *    (`htmlcode`, `object`, `messages`) or `ResultListDto<T>` (`htmlcode`, `objects`, `total`,
 *    `totalpages`, `messages`). There is no `error: boolean` field — it is omitted rather than
 *    shipped permanently false, because failures never travel this way.
 * 2. **Errors are not enveloped.** They leave as RFC 9457 `application/problem+json`, with what
 *    failed / what the consequence is / what action resolves it in the detail (NFR-79).
 * 3. **Four routes bypass both**: an explicit 204, and `StreamableFile`/`Buffer` responses.
 *    FR-53 requires a prior export to be re-downloadable byte-for-byte, so those bodies must
 *    pass through untouched — an envelope would corrupt the artefact.
 *
 * `messages[]` carries message **keys**, never literal sentences, resolved through the same
 * catalogue as everything else so FR-61/FR-62 and NFR-85 apply to them. A `MessageType` is
 * `SUCCESS` or `WARNING` only; `WARNING` is how AD-5's `allow_with_warning` reaches a caller who
 * still got what they asked for.
 *
 * Types come from `@easyesg/contracts`, generated from `apps/api`'s OpenAPI and diffed in CI
 * (P-5). `apps/api` produces that package and must never import it; this app consumes it.
 *
 * Not built.
 */
export const apiBaseUrl = env.apiBaseUrl;
export {};
