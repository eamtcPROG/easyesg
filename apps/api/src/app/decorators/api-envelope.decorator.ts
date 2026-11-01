import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ResultListDto } from '../dto/result-list.dto';
import { ResultObjectDto } from '../dto/result-object.dto';

/**
 * Documents a success response **as it actually leaves** — inside `ResultObjectDto`.
 *
 * Without this, a controller annotated `@ApiOkResponse({ type: AccountDto })` emits a contract
 * saying the body *is* an `AccountDto`, while `GlobalResponseInterceptor` wraps it in the envelope
 * §6.8 fixes. The generated client in `@easyesg/contracts` would then be typed for a shape that
 * never arrives — and P-5's whole claim is that the spec is generated from source and therefore
 * cannot drift from it. A hand-annotated lie drifts on day one.
 *
 * `allOf` plus a narrowed `object` is the standard way to express a generic wrapper in OpenAPI,
 * which has no generics: the envelope's own members come from the `$ref`, and `object` is
 * overridden with the payload type. `ApiExtraModels` is required because neither type appears in a
 * handler signature that Swagger scans — without it, both `$ref`s dangle.
 *
 * Errors are deliberately not covered here. They are RFC 9457 problem documents and never travel
 * in the envelope (§6.8), so an error response is annotated on its own.
 */
export const ApiObjectResponse = <T extends Type<unknown>>(
  model: T,
  options: { status: number; description: string },
) =>
  applyDecorators(
    ApiExtraModels(ResultObjectDto, model),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResultObjectDto) },
          { properties: { object: { $ref: getSchemaPath(model) } } },
        ],
      },
    }),
  );

/**
 * One status, **several possible shapes**, discriminated — added 27 Aug 2026 for `POST /auth/session`.
 *
 * **Two `@ApiObjectResponse` decorators at the same status do not describe two shapes.** They
 * collapse: Swagger concatenates the descriptions and the second schema is silently dropped, so
 * `POST /auth/session` published a 201 that named `SessionResponseDto` alone while the route had
 * answered a factor challenge as well since task 27.3. The description even told readers to "branch
 * on `kind`" — on a schema carrying only one `kind`. `openapi:check` could not see it: it diffs the
 * emitted spec against its source and both were consistent, which is the same blind window that let
 * 27.3's change stay invisible to `apps/web` for four tasks.
 *
 * `oneOf` with a `discriminator` is how OpenAPI says this, and `openapi-typescript` turns it into a
 * genuine TypeScript union — which is what makes the consumer's `switch (body.kind)` a contract
 * rather than a hand-assembled guess.
 *
 * **The variants arrive keyed by their discriminator value**, so the `mapping` is derived from the
 * vocabulary rather than restated beside it (CLAUDE.md). Passing an array instead would leave the
 * mapping to schema names — `SessionResponseDto`, not `signed_in` — which is not what the wire
 * carries, and an implicit mapping would then be wrong in a way nothing reads.
 */
export const ApiObjectUnionResponse = <T extends Type<unknown>>(
  variants: Record<string, T>,
  options: { status: number; description: string; discriminator: string },
) => {
  const models = Object.values(variants);

  return applyDecorators(
    ApiExtraModels(ResultObjectDto, ...models),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResultObjectDto) },
          {
            properties: {
              object: {
                oneOf: models.map((model) => ({ $ref: getSchemaPath(model) })),
                discriminator: {
                  propertyName: options.discriminator,
                  mapping: Object.fromEntries(
                    Object.entries(variants).map(([value, model]) => [
                      value,
                      getSchemaPath(model),
                    ]),
                  ),
                },
              },
            },
          },
        ],
      },
    }),
  );
};

/**
 * The list half of the same argument, for a handler returning an array.
 *
 * `GlobalResponseInterceptor` wraps a bare array in `ResultListDto` as "one page containing all
 * of it", so a handler annotated `@ApiOkResponse({ type: [MemberDto] })` would publish a contract
 * saying the body IS an array — and `@easyesg/contracts` would generate a client that reads
 * `response[0]` where `response.objects[0]` arrives. Same drift as the object case, one level
 * further out, and equally invisible until a front end consumes it.
 */
export const ApiListResponse = <T extends Type<unknown>>(
  model: T,
  options: { status: number; description: string },
) =>
  applyDecorators(
    ApiExtraModels(ResultListDto, model),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResultListDto) },
          { properties: { objects: { type: 'array', items: { $ref: getSchemaPath(model) } } } },
        ],
      },
    }),
  );
