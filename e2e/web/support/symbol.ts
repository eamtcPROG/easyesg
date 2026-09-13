import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, type Locator } from '@playwright/test';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';

/**
 * A camera's half of S-28's enrolment: what a phone authenticator reads off the symbol (task 143).
 *
 * **It decodes the pixels the browser drew**, from a screenshot of the element — never the prop, the
 * DOM or the Server Action's answer. Those are all the value *before* it became a symbol, and a symbol
 * encoding the secret instead of the URI, a truncated URI, or squares no scanner can find would pass
 * every one of them. This is the check that fails on those.
 *
 * **The decoder is handed the binary it ships with, and reaching the network is refused.**
 * `zxing-wasm`'s default loader downloads its wasm from jsDelivr on first use — in Node as well,
 * measured on 3.1.4 — so without the override every run would execute code fetched from a CDN at test
 * time, and would fail offline for a reason that has nothing to do with the screen. `fetch` is a
 * thrower while a decode runs, so an override that goes missing fails here, loudly, rather than
 * quietly downloading.
 */
const packaged = readFileSync(
  createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'),
);
prepareZXingModule({ overrides: { wasmBinary: new Uint8Array(packaged).buffer } });

/** The text of the one QR symbol drawn in `symbol`'s box. */
export async function readSymbol(symbol: Locator): Promise<string> {
  const pixels = await symbol.screenshot();

  const network = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('zxing-wasm reached for the network: the packaged binary was not handed to it');
  };
  try {
    // `tryInvert: false` — the decoder's default reads a reversed symbol, which is exactly the one
    // S-28's plate exists to avoid drawing (a scanner that omits reversal cannot read it), so a
    // plate that inverted would decode here and fail on a phone (task 143's gate-integrity review).
    const found = await readBarcodes(pixels, { formats: ['QRCode'], tryInvert: false });
    expect(found, 'exactly one readable QR symbol in the element').toHaveLength(1);
    return found[0].text;
  } finally {
    globalThis.fetch = network;
  }
}
