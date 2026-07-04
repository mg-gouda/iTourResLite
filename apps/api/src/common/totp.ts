import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { result += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) result += ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

export function base32Decode(str: string): Buffer {
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const char of str.toUpperCase().replace(/=+$/, "")) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function computeTotp(secret: string, counterOffset = 0): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + counterOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(msg).digest();
  const offset = hmac[19] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/** Allows ±1 time-step drift. */
export function verifyTotp(token: string, secret: string): boolean {
  return [-1, 0, 1].some((w) => computeTotp(secret, w) === token.trim());
}

export function makeOtpauthUri(secret: string, email: string, issuer = "iTour"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
