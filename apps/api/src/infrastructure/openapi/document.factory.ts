import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Builds the OpenAPI document that IS the API contract (P-5, DR-11).
 *
 * `setOpenAPIVersion('3.1.0')` is not optional decoration: DocumentBuilder emits 3.0 by
 * default, and architecture.md §6.8 specifies 3.1. Omit the call and the spec is silently
 * the wrong version — nothing fails, and the CI diff happily compares two wrong documents.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('easyesg API')
    .setDescription(
      'One versioned REST surface. Both front ends are ordinary clients of it and no ' +
        'privileged route exists (DR-11, NFR-16). The active organization comes from the ' +
        'session — never from a header, a path segment or a token claim.',
    )
    .setVersion('1')
    .setOpenAPIVersion('3.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  return SwaggerModule.createDocument(app, config);
}
