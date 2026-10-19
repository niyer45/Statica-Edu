'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

type Account = { name: string; email: string }
type AccountState = { user: Account | null; refreshSession: () => Promise<void>; clearSession: () => void }
const AccountContext = createContext<AccountState>({ user: null, refreshSession: async () => {}, clearSession: () => {} })

export function useAccount() { return useContext(AccountContext) }

export default function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null)
  const refreshSession = useCallback(async () => {
    const response = await fetch('/api/session', { cache: 'no-store' })
    if (!response.ok) throw new Error('Unable to check account status.')
    const result = await response.json()
    setUser(result.user)
  }, [])
  useEffect(() => { refreshSession().catch(() => {}) }, [refreshSession])
  return <AccountContext.Provider value={{ user, refreshSession, clearSession: () => setUser(null) }}>{children}</AccountContext.Provider>
}
