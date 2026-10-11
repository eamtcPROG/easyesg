import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import { PDF_RENDERER } from '@api/contracts/pdf-renderer.port';
import { HttpPdfRenderer } from './http-pdf-renderer';

/** The renderer service's client, for the worker's export job (task 44.2) — the only caller it has. */
@Module({
  providers: [
    {
      provide: PDF_RENDERER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => new HttpPdfRenderer(config.get('renderer', { infer: true })),
    },
  ],
  exports: [PDF_RENDERER],
})
export class RendererModule {}
