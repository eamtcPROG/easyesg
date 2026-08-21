import { createHmac } from 'node:crypto';

/**
 * The authenticator app's half of RFC 6238, for the browser e2e to play the operator with.
 *
 * A deliberate small copy of `apps/api`'s `totp.ts` arithmetic rather than an import from its
 * `dist/`: this suite stands in for the HUMAN side of the exchange, and an implementation that
 * shared code with the verifier would prove only that one function agrees with itself. Both
 * copies pin RFC 6238's own vectors (the api's in `totp.spec.ts`, this one exercised against
 * the live verifier by every sign-in in the suite), which is what keeps them honest.
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(secret: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.toUpperCase().replace(/=+$/u, '')) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('the e2e TOTP secret must be base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** The six digits an authenticator shows for `secret` right now (SHA-1, 30 s step). */
export function currentTotpCode(secret: string): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = digest.readUInt32BE(offset) & 0x7fffffff;
  return (code % 1_000_000).toString().padStart(6, '0');
}
