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
