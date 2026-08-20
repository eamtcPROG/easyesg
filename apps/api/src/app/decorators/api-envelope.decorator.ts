import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
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
