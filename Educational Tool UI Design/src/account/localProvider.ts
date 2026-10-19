import { z } from 'zod'
import type { Result } from '../challenge/types'
import { DEFAULT_ITERATIONS, hashPassword, PASSWORD_ALGORITHM, verifyPassword, type CryptoLike, type PasswordCredential } from './password'
import type { AccountError, AccountProvider, AccountUser, KeyValueStorage, ProgressStorage, SignInInput, SignUpInput, SignUpOutcome } from './types'

// Browser-local account provider (task 38, local-first). Accounts, the signed-in session and
// per-user progress live in the injected key/value storage (localStorage in the app), on this
// device only. It separates people who share a browser profile; it is not a security boundary
// against someone with access to that profile, and it does not sync anywhere.
//
// Storage keys:
//   ei:accounts:v1                                 account records (profile + PBKDF2 credential)
//   ei:account-session:v1                          signed-in user id
//   ei:session:<challengeId>:v<version>            guest progress (unchanged from before accounts)
//   ei:user:<userId>:session:<challengeId>:v<n>    a user's progress (same envelope, namespaced)
//   ei:learn:<moduleId>:v<n> / ei:user:<userId>:learn:…   Learn module progress (task 67), same scoping

export const ACCOUNTS_KEY = 'ei:accounts:v1'
export const ACCOUNT_SESSION_KEY = 'ei:account-session:v1'
export const GUEST_SESSION_PREFIX = 'ei:session:'
/** Guest Learn progress (learn/progress.ts LEARN_KEY_PREFIX); moves with the sessions on sign-up. */
export const GUEST_LEARN_PREFIX = 'ei:learn:'
export const userPrefix = (userId: string) => `ei:user:${userId}:`

/** Maps an `ei:` key to the user's namespace: `ei:session:x:v1` → `ei:user:<id>:session:x:v1`. */
export function userKey(userId: string, key: string): string {
  if (!key.startsWith('ei:')) throw new Error('Only ei: keys can be namespaced')
  return userPrefix(userId) + key.slice(3)
}

/** Session storage scoped to one user; the persistence controller keeps using its normal keys. */
export function namespacedStorage(base: ProgressStorage, userId: string): ProgressStorage {
  return {
    getItem: (key) => base.getItem(userKey(userId, key)),
    setItem: (key, value) => base.setItem(userKey(userId, key), value),
    removeItem: (key) => base.removeItem(userKey(userId, key)),
  }
}

const USER_ID = /^[A-Za-z0-9-]{8,64}$/
const credentialSchema = z.object({
  algorithm: z.literal(PASSWORD_ALGORITHM),
  iterations: z.number().int().min(1).max(10_000_000),
  salt: z.string().regex(/^[0-9a-f]{32,128}$/),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict()
const accountSchema = z.object({
  id: z.string().regex(USER_ID),
  displayName: z.string().min(1).max(60),
  identifier: z.string().min(3).max(254),
  createdAt: z.string(),
  credential: credentialSchema,
}).strict()
const accountsSchema = z.object({ schemaVersion: z.literal(1), accounts: z.array(accountSchema) }).strict()
const sessionSchema = z.object({ schemaVersion: z.literal(1), userId: z.string().regex(USER_ID), signedInAt: z.string() }).strict()
type StoredAccount = z.infer<typeof accountSchema>

export const DISPLAY_NAME_MAX = 60
export const IDENTIFIER_MIN = 3
export const IDENTIFIER_MAX = 254
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 256
const CONTROL = /[\u0000-\u001f\u007f]/

export function normalizeIdentifier(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase()
}

function invalid(field: AccountError['field'], message: string): Result<never, AccountError> {
  return { ok: false, error: { code: 'INVALID_INPUT', field, message } }
}

/** Field validation shared by the provider and the forms; returns the first problem per field. */
export function validateSignUp(input: Pick<SignUpInput, 'displayName' | 'identifier' | 'password'>): AccountError[] {
  const errors: AccountError[] = []
  const name = input.displayName.trim()
  if (name.length === 0) errors.push({ code: 'INVALID_INPUT', field: 'displayName', message: 'Enter a display name.' })
  else if (name.length > DISPLAY_NAME_MAX || CONTROL.test(name)) errors.push({ code: 'INVALID_INPUT', field: 'displayName', message: `Use up to ${DISPLAY_NAME_MAX} ordinary characters.` })
  const id = normalizeIdentifier(input.identifier)
  if (id.length === 0) errors.push({ code: 'INVALID_INPUT', field: 'identifier', message: 'Enter an email address or username.' })
  else if (id.length < IDENTIFIER_MIN || id.length > IDENTIFIER_MAX || /\s/.test(id) || CONTROL.test(id)) errors.push({ code: 'INVALID_INPUT', field: 'identifier', message: `Use ${IDENTIFIER_MIN} to ${IDENTIFIER_MAX} characters with no spaces.` })
  if (input.password.length < PASSWORD_MIN) errors.push({ code: 'INVALID_INPUT', field: 'password', message: `Use at least ${PASSWORD_MIN} characters.` })
  else if (input.password.length > PASSWORD_MAX) errors.push({ code: 'INVALID_INPUT', field: 'password', message: `Use at most ${PASSWORD_MAX} characters.` })
  return errors
}

export interface LocalAccountProviderOptions {
  storage: KeyValueStorage
  /** WebCrypto; undefined (e.g. an insecure origin) makes sign-up and sign-in report CRYPTO_UNAVAILABLE. */
  crypto: CryptoLike | undefined
  clock: () => string
  newId: () => string
  /** PBKDF2 iterations for new credentials (tests lower it). */
  iterations?: number
}

const STORAGE_ERROR: AccountError = { code: 'STORAGE_UNAVAILABLE', message: 'This browser is not letting Statica save data, so accounts cannot be used here.' }
const CRYPTO_ERROR: AccountError = { code: 'CRYPTO_UNAVAILABLE', message: 'This browser cannot protect passwords on this connection, so accounts are unavailable. You can keep working as a guest.' }
const CORRUPT_ERROR: AccountError = { code: 'CORRUPT_ACCOUNTS', message: 'Saved accounts on this device could not be read. Nothing was changed.' }
const CREDENTIALS_ERROR: AccountError = { code: 'INVALID_CREDENTIALS', message: 'The email or username and password do not match an account on this device.' }

const publicUser = (a: StoredAccount): AccountUser => Object.freeze({ id: a.id, displayName: a.displayName, identifier: a.identifier, createdAt: a.createdAt })

export function createLocalAccountProvider({ storage, crypto, clock, newId, iterations = DEFAULT_ITERATIONS }: LocalAccountProviderOptions): AccountProvider {
  /** Reads account records: [] when absent, an error when unreadable (never overwritten). */
  function readAccounts(): Result<StoredAccount[], AccountError> {
    let raw: string | null
    try { raw = storage.getItem(ACCOUNTS_KEY) } catch { return { ok: false, error: STORAGE_ERROR } }
    if (raw === null) return { ok: true, value: [] }
    try {
      const parsed = accountsSchema.safeParse(JSON.parse(raw))
      return parsed.success ? { ok: true, value: parsed.data.accounts } : { ok: false, error: CORRUPT_ERROR }
    } catch {
      return { ok: false, error: CORRUPT_ERROR }
    }
  }
  function writeAccounts(accounts: StoredAccount[]): boolean {
    try { storage.setItem(ACCOUNTS_KEY, JSON.stringify({ schemaVersion: 1, accounts })); return true } catch { return false }
  }
  function sessionUserId(): string | null {
    try {
      const raw = storage.getItem(ACCOUNT_SESSION_KEY)
      if (raw === null) return null
      const parsed = sessionSchema.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data.userId : null
    } catch {
      return null
    }
  }
  function startSession(userId: string): boolean {
    try { storage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify({ schemaVersion: 1, userId, signedInAt: clock() })); return true } catch { return false }
  }
  function keysWithPrefix(prefix: string): string[] {
    try { return storage.keys().filter((k) => k.startsWith(prefix)) } catch { return [] }
  }

  /**
   * Moves every guest session and Learn record into the user's namespace; all-or-nothing (copies
   * roll back on failure). The count is the number of challenge sessions moved.
   */
  function moveGuestProgress(userId: string): Result<number, null> {
    const sessions = keysWithPrefix(GUEST_SESSION_PREFIX)
    const keys = [...sessions, ...keysWithPrefix(GUEST_LEARN_PREFIX)]
    const copied: string[] = []
    let movedSessions = 0
    try {
      for (const key of keys) {
        const value = storage.getItem(key)
        if (value === null) continue
        const target = userKey(userId, key)
        storage.setItem(target, value)
        copied.push(target)
        if (key.startsWith(GUEST_SESSION_PREFIX)) movedSessions++
      }
    } catch {
      for (const target of copied) { try { storage.removeItem(target) } catch { /* best effort */ } }
      return { ok: false, error: null }
    }
    for (const key of keys) { try { storage.removeItem(key) } catch { /* the copy is already in the account */ } }
    return { ok: true, value: movedSessions }
  }

  // A fixed dummy credential keeps unknown-identifier sign-ins about as slow as wrong passwords.
  let dummy: Promise<PasswordCredential> | undefined

  return {
    scope: 'device',

    currentUser() {
      const id = sessionUserId()
      if (id === null) return null
      const accounts = readAccounts()
      if (!accounts.ok) return null
      const account = accounts.value.find((a) => a.id === id)
      return account ? publicUser(account) : null
    },

    async signUp(input: SignUpInput): Promise<Result<SignUpOutcome, AccountError>> {
      const problems = validateSignUp(input)
      if (problems.length > 0) return { ok: false, error: problems[0]! }
      if (crypto === undefined) return { ok: false, error: CRYPTO_ERROR }
      const identifier = normalizeIdentifier(input.identifier)
      const before = readAccounts()
      if (!before.ok) return before
      if (before.value.some((a) => a.identifier === identifier)) {
        return { ok: false, error: { code: 'DUPLICATE_ACCOUNT', field: 'identifier', message: 'An account with this email or username already exists on this device. Sign in instead.' } }
      }
      let credential: PasswordCredential
      try { credential = await hashPassword(crypto, input.password, iterations) } catch { return { ok: false, error: CRYPTO_ERROR } }
      const id = newId()
      if (!USER_ID.test(id)) return { ok: false, error: STORAGE_ERROR }
      const account: StoredAccount = { id, displayName: input.displayName.trim(), identifier, createdAt: clock(), credential }
      // Re-read after the await so a concurrent sign-up in another tab is not overwritten.
      const latest = readAccounts()
      if (!latest.ok) return latest
      if (latest.value.some((a) => a.identifier === identifier)) {
        return { ok: false, error: { code: 'DUPLICATE_ACCOUNT', field: 'identifier', message: 'An account with this email or username already exists on this device. Sign in instead.' } }
      }
      if (!writeAccounts([...latest.value, account])) return { ok: false, error: STORAGE_ERROR }
      let imported = 0
      let importFailed = false
      if (input.importGuestProgress) {
        const moved = moveGuestProgress(id)
        if (moved.ok) imported = moved.value
        else importFailed = true
      }
      if (!startSession(id)) return { ok: false, error: STORAGE_ERROR }
      return { ok: true, value: { user: publicUser(account), imported, importFailed } }
    },

    async signIn({ identifier: rawIdentifier, password }: SignInInput): Promise<Result<AccountUser, AccountError>> {
      const identifier = normalizeIdentifier(rawIdentifier)
      if (identifier.length === 0) return invalid('identifier', 'Enter your email address or username.')
      if (password.length === 0) return invalid('password', 'Enter your password.')
      if (crypto === undefined) return { ok: false, error: CRYPTO_ERROR }
      const accounts = readAccounts()
      if (!accounts.ok) return accounts
      const account = accounts.value.find((a) => a.identifier === identifier)
      try {
        if (account === undefined) {
          dummy ??= hashPassword(crypto, 'statica-dummy-password', iterations)
          await verifyPassword(crypto, password, await dummy)
          return { ok: false, error: CREDENTIALS_ERROR }
        }
        if (!(await verifyPassword(crypto, password, account.credential))) return { ok: false, error: CREDENTIALS_ERROR }
      } catch {
        return { ok: false, error: CRYPTO_ERROR }
      }
      if (!startSession(account.id)) return { ok: false, error: STORAGE_ERROR }
      return { ok: true, value: publicUser(account) }
    },

    async signOut() {
      try { storage.removeItem(ACCOUNT_SESSION_KEY) } catch { /* nothing else to clear */ }
    },

    async deleteAccount(password: string): Promise<Result<void, AccountError>> {
      const id = sessionUserId()
      if (id === null) return { ok: false, error: { code: 'NOT_SIGNED_IN', message: 'Sign in to delete your account.' } }
      if (password.length === 0) return invalid('password', 'Enter your password to confirm.')
      if (crypto === undefined) return { ok: false, error: CRYPTO_ERROR }
      const accounts = readAccounts()
      if (!accounts.ok) return accounts
      const account = accounts.value.find((a) => a.id === id)
      if (account === undefined) return { ok: false, error: { code: 'NOT_SIGNED_IN', message: 'Sign in to delete your account.' } }
      try {
        if (!(await verifyPassword(crypto, password, account.credential))) return { ok: false, error: { code: 'INVALID_CREDENTIALS', field: 'password', message: 'That password is not correct.' } }
      } catch {
        return { ok: false, error: CRYPTO_ERROR }
      }
      const latest = readAccounts()
      if (!latest.ok) return latest
      if (!writeAccounts(latest.value.filter((a) => a.id !== id))) return { ok: false, error: STORAGE_ERROR }
      for (const key of keysWithPrefix(userPrefix(id))) { try { storage.removeItem(key) } catch { /* continue */ } }
      try { storage.removeItem(ACCOUNT_SESSION_KEY) } catch { /* continue */ }
      return { ok: true, value: undefined }
    },

    guestProgress: () => storage,
    progressStorage: (user: AccountUser) => namespacedStorage(storage, user.id),
  }
}
