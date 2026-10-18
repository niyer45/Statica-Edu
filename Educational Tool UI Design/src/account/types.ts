import type { Result } from '../challenge/types'

// Account provider contract (task 38, local-first). The UI talks only to this interface, so a
// real backend can replace the browser-local implementation (localProvider.ts) without UI or
// persistence changes. No React, DOM or storage globals here: storage and crypto are injected.

/** Synchronous key/value storage, the same shape the session persistence controller writes. */
export interface ProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Storage that can also enumerate its keys (needed for guest migration and account deletion). */
export interface KeyValueStorage extends ProgressStorage {
  keys(): string[]
}

/** Public account profile. Never carries credentials. */
export interface AccountUser {
  /** Opaque, storage-safe id used for namespacing. */
  readonly id: string
  readonly displayName: string
  /** Normalized email or username used to sign in. */
  readonly identifier: string
  readonly createdAt: string
}

export type AccountErrorCode =
  | 'INVALID_INPUT'
  | 'DUPLICATE_ACCOUNT'
  | 'INVALID_CREDENTIALS'
  | 'NOT_SIGNED_IN'
  | 'STORAGE_UNAVAILABLE'
  | 'CRYPTO_UNAVAILABLE'
  | 'CORRUPT_ACCOUNTS'

export type AccountField = 'displayName' | 'identifier' | 'password'

export interface AccountError {
  code: AccountErrorCode
  message: string
  /** The form field the error belongs to, when it is a validation error. */
  field?: AccountField
}

export interface SignUpInput {
  displayName: string
  identifier: string
  password: string
  /** Move this device's guest progress into the new account (explicit opt-in on sign-up). */
  importGuestProgress?: boolean
}

export interface SignInInput {
  identifier: string
  password: string
}

export interface SignUpOutcome {
  user: AccountUser
  /** Number of guest challenge sessions moved into the account. */
  imported: number
  /** True when the guest move was requested but could not be completed (guest data kept). */
  importFailed: boolean
}

/** Where account data and progress live; the UI states this honestly ('device' = this browser only). */
export type StorageScope = 'device' | 'cloud'

export interface AccountProvider {
  readonly scope: StorageScope
  /** The signed-in user from the cached session, or null for guest use. Never throws. */
  currentUser(): AccountUser | null
  signUp(input: SignUpInput): Promise<Result<SignUpOutcome, AccountError>>
  signIn(input: SignInInput): Promise<Result<AccountUser, AccountError>>
  /** Ends the session; guest progress is untouched and the user's progress stays in their namespace. */
  signOut(): Promise<void>
  /** Deletes the signed-in account and all of its progress after re-checking the password. */
  deleteAccount(password: string): Promise<Result<void, AccountError>>
  /** Storage for guest progress (the original `ei:session:...` keys). */
  guestProgress(): ProgressStorage
  /** Per-user progress storage: the same session keys, namespaced under the user's id. */
  progressStorage(user: AccountUser): ProgressStorage
}
