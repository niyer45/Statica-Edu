// Password hashing for the browser-local account provider (task 38). WebCrypto PBKDF2-HMAC-SHA-256
// with a per-account random salt; only the derived hash and its parameters are stored, never the
// password. The SubtleCrypto implementation is injected so tests and other runtimes can supply one.

export const PASSWORD_ALGORITHM = 'PBKDF2-SHA-256'
/** OWASP (2023) recommendation for PBKDF2-HMAC-SHA-256. Stored per account so it can be raised later. */
export const DEFAULT_ITERATIONS = 600_000
export const SALT_BYTES = 16
export const HASH_BITS = 256

export interface PasswordCredential {
  algorithm: typeof PASSWORD_ALGORITHM
  iterations: number
  /** Hex-encoded random salt. */
  salt: string
  /** Hex-encoded derived key. */
  hash: string
}

/** The subset of the WebCrypto `Crypto` object this module and the provider need. */
export interface CryptoLike {
  readonly subtle: Pick<SubtleCrypto, 'importKey' | 'deriveBits'>
  getRandomValues<T extends ArrayBufferView>(array: T): T
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/.test(hex)) throw new Error('Invalid hex')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Compares two equal-purpose strings without an early exit on the first difference. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

async function derive(crypto: CryptoLike, password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, material, HASH_BITS)
  return toHex(new Uint8Array(bits))
}

/** Hashes a new password with a fresh random salt. */
export async function hashPassword(crypto: CryptoLike, password: string, iterations = DEFAULT_ITERATIONS): Promise<PasswordCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  return { algorithm: PASSWORD_ALGORITHM, iterations, salt: toHex(salt), hash: await derive(crypto, password, salt, iterations) }
}

/** Re-derives with the stored salt and iterations and compares in constant time. */
export async function verifyPassword(crypto: CryptoLike, password: string, credential: PasswordCredential): Promise<boolean> {
  const hash = await derive(crypto, password, fromHex(credential.salt), credential.iterations)
  return constantTimeEqual(hash, credential.hash)
}
