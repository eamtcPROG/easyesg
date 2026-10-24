#!/usr/bin/env node
/**
 * Draws the ring mark an email's band carries (task 225; `architecture.md` §12.5.6's task-225 row (5)) as a PNG, from
 * the logo's own geometry — `packages/ui/src/primitives/brand-mark.module.css` and `EasyESG Logo.dc.html`: a 28 px ring
 * whose arc runs 266° clockwise from twelve o'clock, a 16 px well inside it, a 6 px dot at the centre.
 *
 * **Generated rather than exported from a design tool**, so the image is a function of numbers this file states and the
 * committed PNG can be drawn again by anyone: `node tools/draw-email-mark.mjs`. A mail client cannot draw the CSS the
 * product's mark is made of, and SVG reaches neither Gmail nor Outlook, which is why there is a PNG at all.
 *
 * White on transparent, at twice the size it is shown, so it stays sharp on a dense screen; each pixel's alpha is its
 * coverage, sampled sixteen times.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../apps/api/src/infrastructure/adapters/email/assets/ring-mark.png');

const SCALE = 2;
const SIZE = 28 * SCALE;
const OUTER = 14 * SCALE;
const WELL = 8 * SCALE;
const DOT = 3 * SCALE;
const ARC_DEGREES = 266;
const SAMPLES = 4;

/** Whether a point, in pixels from the image's top-left corner, is inside the mark. */
function inside(x, y) {
  const dx = x - SIZE / 2;
  const dy = y - SIZE / 2;
  const radius = Math.hypot(dx, dy);
  if (radius <= DOT) return true;
  if (radius < WELL || radius > OUTER) return false;
  // Clockwise from twelve o'clock, as the CSS conic gradient measures it.
  const degrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return degrees <= ARC_DEGREES;
}

const rows = [];
for (let y = 0; y < SIZE; y += 1) {
  const row = Buffer.alloc(1 + SIZE * 4);
  for (let x = 0; x < SIZE; x += 1) {
    let covered = 0;
    for (let sy = 0; sy < SAMPLES; sy += 1) {
      for (let sx = 0; sx < SAMPLES; sx += 1) {
        if (inside(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES)) covered += 1;
      }
    }
    // `>>> 0` keeps the word unsigned: a bitwise OR in JavaScript answers a signed 32-bit integer.
    row.writeUInt32BE((0xffffff00 | Math.round((covered / (SAMPLES * SAMPLES)) * 255)) >>> 0, 1 + x * 4);
  }
  rows.push(row);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, check]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header.writeUInt8(8, 8); // bit depth
header.writeUInt8(6, 9); // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log(`${OUT}: ${SIZE}×${SIZE}, ${png.length} bytes`);
