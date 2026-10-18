import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Result } from '../../challenge/types'
import type { AccountError, AccountProvider, AccountUser, ProgressStorage, SignInInput, SignUpInput, SignUpOutcome, StorageScope } from '../../account/types'

// Account host (task 38). Holds the signed-in user from the injected AccountProvider and hands the
// matching progress storage to its child (the challenge host). The child is keyed by the user, so
// a sign-in, sign-out or deletion unmounts every store, notebook and saved-card state of the
// previous user before the next one mounts: nothing in memory crosses accounts.

export interface AccountContextValue {
  user: AccountUser | null
  scope: StorageScope
  signUp(input: SignUpInput): Promise<Result<SignUpOutcome, AccountError>>
  signIn(input: SignInInput): Promise<Result<AccountUser, AccountError>>
  signOut(): Promise<void>
  deleteAccount(password: string): Promise<Result<void, AccountError>>
  /** One-shot confirmation shown (and focused) on Home after a session change. */
  notice: string | null
  consumeNotice(): void
}

export const AccountContext = createContext<AccountContextValue | null>(null)

/** The account context, or null where accounts are not offered (isolated shell tests). */
export function useAccount(): AccountContextValue | null {
  return useContext(AccountContext)
}

export interface AccountHostProps {
  provider: AccountProvider
  /** Runs before the new user's workspace mounts (App uses it to land on Home). */
  onSessionChange?: () => void
  children: (storage: ProgressStorage, workspaceKey: string) => ReactNode
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function AccountHost({ provider, onSessionChange, children }: AccountHostProps) {
  const [user, setUser] = useState<AccountUser | null>(() => provider.currentUser())
  const [notice, setNotice] = useState<string | null>(null)

  const change = useCallback((next: AccountUser | null, message: string) => {
    onSessionChange?.()
    setNotice(message)
    setUser(next)
  }, [onSessionChange])

  const value = useMemo<AccountContextValue>(() => ({
    user,
    scope: provider.scope,
    notice,
    consumeNotice: () => setNotice(null),
    async signUp(input) {
      const r = await provider.signUp(input)
      if (r.ok) {
        const { user: created, imported, importFailed } = r.value
        let message = `Account created. Signed in as ${created.displayName}.`
        if (imported > 0) message += ` Guest progress for ${plural(imported, 'challenge')} moved into your account.`
        if (importFailed) message += ' Guest progress could not be moved; it is still available to guests on this device.'
        change(created, message)
      }
      return r
    },
    async signIn(input) {
      const r = await provider.signIn(input)
      if (r.ok) change(r.value, `Signed in as ${r.value.displayName}.`)
      return r
    },
    async signOut() {
      await provider.signOut()
      change(null, 'Signed out. You are using Statica as a guest.')
    },
    async deleteAccount(password) {
      const r = await provider.deleteAccount(password)
      if (r.ok) change(null, 'Account deleted. Its saved progress was removed from this device.')
      return r
    },
  }), [user, notice, provider, change])

  const storage = useMemo(() => (user ? provider.progressStorage(user) : provider.guestProgress()), [provider, user])

  return <AccountContext.Provider value={value}>{children(storage, user ? `user:${user.id}` : 'guest')}</AccountContext.Provider>
}
