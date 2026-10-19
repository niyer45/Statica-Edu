import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { learnKey } from '../learn/progress'
import { beamBending } from '../learn/modules/beamBending'
import { ACCOUNT_SESSION_KEY, ACCOUNTS_KEY, createLocalAccountProvider, GUEST_LEARN_PREFIX, namespacedStorage, normalizeIdentifier, userKey, validateSignUp } from './localProvider'
import { constantTimeEqual, fromHex, hashPassword, toHex, verifyPassword, type CryptoLike } from './password'
import type { KeyValueStorage } from './types'

// Task 38: browser-local account provider (hashing, credentials, namespacing, guest migration,
// sign-out isolation and deletion). Node's WebCrypto stands in for the browser's.

const crypto = webcrypto as unknown as CryptoLike

function memory(initial: Record<string, string> = {}): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v) },
    removeItem: (k) => { map.delete(k) },
    keys: () => [...map.keys()],
  }
}

function provider(storage = memory()) {
  let n = 0
  const p = createLocalAccountProvider({
    storage,
    crypto,
    clock: () => '2026-10-18T00:00:00.000Z',
    newId: () => `user-000${++n}`,
    iterations: 1000,
  })
  return { p, storage }
}

const ana = { displayName: 'Ana', identifier: 'Ana@Example.com', password: 'correct horse' }
const ben = { displayName: 'Ben', identifier: 'ben', password: 'battery staple' }
const beamKey = 'ei:session:cantilever-beam-1:v1'
const torsionKey = 'ei:session:torsion-shaft-1:v1'

describe('password hashing', () => {
  it('derives a salted PBKDF2 hash that verifies only the same password', async () => {
    const a = await hashPassword(crypto, 'secret-pass', 1000)
    const b = await hashPassword(crypto, 'secret-pass', 1000)
    expect(a.algorithm).toBe('PBKDF2-SHA-256')
    expect(a.salt).toMatch(/^[0-9a-f]{32}$/)
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(a.salt).not.toBe(b.salt) // per-credential random salt
    expect(a.hash).not.toBe(b.hash)
    expect(await verifyPassword(crypto, 'secret-pass', a)).toBe(true)
    expect(await verifyPassword(crypto, 'secret-pasS', a)).toBe(false)
  })

  it('round-trips hex and compares strings of any length', () => {
    expect(toHex(fromHex('00ff10'))).toBe('00ff10')
    expect(() => fromHex('0g')).toThrow()
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('abc', 'ab')).toBe(false)
  })
})

describe('local account provider', () => {
  it('signs up, stores no plain-text password, and restores the session', async () => {
    const { p, storage } = provider()
    expect(p.scope).toBe('device')
    expect(p.currentUser()).toBeNull()
    const r = await p.signUp(ana)
    if (!r.ok) throw new Error(r.error.message)
    expect(r.value.user).toEqual({ id: 'user-0001', displayName: 'Ana', identifier: 'ana@example.com', createdAt: '2026-10-18T00:00:00.000Z' })
    expect(r.value.user).not.toHaveProperty('credential')
    const all = [...storage.map.values()].join('\n')
    expect(all).not.toContain(ana.password)
    expect(JSON.parse(storage.map.get(ACCOUNTS_KEY)!).accounts[0].credential).toMatchObject({ algorithm: 'PBKDF2-SHA-256', iterations: 1000 })
    expect(p.currentUser()).toEqual(r.value.user)
    // A fresh provider over the same storage (a reload) restores the signed-in user.
    const reloaded = createLocalAccountProvider({ storage, crypto, clock: () => '', newId: () => 'unused-id', iterations: 1000 })
    expect(reloaded.currentUser()?.id).toBe('user-0001')
  })

  it('validates fields', async () => {
    const { p } = provider()
    expect(validateSignUp({ displayName: ' ', identifier: 'a b', password: 'short' }).map((e) => e.field)).toEqual(['displayName', 'identifier', 'password'])
    const r = await p.signUp({ ...ana, password: 'short' })
    expect(r).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT', field: 'password' } })
    expect(normalizeIdentifier('  Ana@Example.COM ')).toBe('ana@example.com')
  })

  it('refuses a duplicate account regardless of case and spacing', async () => {
    const { p } = provider()
    expect((await p.signUp(ana)).ok).toBe(true)
    await p.signOut()
    const dup = await p.signUp({ ...ana, identifier: '  ANA@example.com ', displayName: 'Other' })
    expect(dup).toMatchObject({ ok: false, error: { code: 'DUPLICATE_ACCOUNT', field: 'identifier' } })
    expect(p.currentUser()).toBeNull()
  })

  it('rejects a wrong password or unknown account with the same message', async () => {
    const { p } = provider()
    await p.signUp(ana)
    await p.signOut()
    const wrong = await p.signIn({ identifier: ana.identifier, password: 'incorrect horse' })
    const unknown = await p.signIn({ identifier: 'nobody', password: 'incorrect horse' })
    expect(wrong).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIALS' } })
    expect(unknown).toEqual(wrong)
    expect(p.currentUser()).toBeNull()
    const right = await p.signIn({ identifier: 'ANA@EXAMPLE.COM', password: ana.password })
    expect(right.ok && right.value.id).toBe('user-0001')
  })

  it('namespaces progress per user and leaves guest keys unchanged', async () => {
    const { p, storage } = provider(memory({ [beamKey]: 'guest-beam' }))
    const a = await p.signUp(ana)
    if (!a.ok) throw new Error()
    const userStore = p.progressStorage(a.value.user)
    expect(userStore.getItem(beamKey)).toBeNull() // guest work is not visible without an explicit move
    userStore.setItem(beamKey, 'ana-beam')
    expect(storage.map.get('ei:user:user-0001:session:cantilever-beam-1:v1')).toBe('ana-beam')
    expect(storage.map.get(beamKey)).toBe('guest-beam')
    expect(userKey('u-1234567', torsionKey)).toBe('ei:user:u-1234567:session:torsion-shaft-1:v1')
    expect(() => userKey('u-1234567', 'other')).toThrow()
    const ns = namespacedStorage(storage, 'user-0001')
    ns.removeItem(beamKey)
    expect(storage.map.has('ei:user:user-0001:session:cantilever-beam-1:v1')).toBe(false)
  })

  it('moves guest progress into a new account only when asked', async () => {
    const learn = learnKey(beamBending)
    const { p, storage } = provider(memory({ [beamKey]: 'guest-beam', [torsionKey]: 'guest-torsion', [learn]: 'guest-learn', 'unrelated': 'x' }))
    const r = await p.signUp({ ...ana, importGuestProgress: true })
    if (!r.ok) throw new Error()
    expect(r.value).toMatchObject({ imported: 2, importFailed: false }) // challenges only; Learn moves too (task 67)
    const store = p.progressStorage(r.value.user)
    expect(store.getItem(beamKey)).toBe('guest-beam')
    expect(store.getItem(torsionKey)).toBe('guest-torsion')
    expect(store.getItem(learn)).toBe('guest-learn')
    expect(learn.startsWith(GUEST_LEARN_PREFIX)).toBe(true)
    expect(storage.map.has(learn)).toBe(false)
    expect(storage.map.has(beamKey)).toBe(false) // moved, so the guest starts fresh after sign-out
    expect(storage.map.get('unrelated')).toBe('x')

    const { p: p2, storage: s2 } = provider(memory({ [beamKey]: 'guest-beam' }))
    const r2 = await p2.signUp(ana)
    expect(r2.ok && r2.value.imported).toBe(0)
    expect(s2.map.get(beamKey)).toBe('guest-beam')
  })

  it('rolls back a guest move that cannot complete and keeps the guest data', async () => {
    const base = memory({ [beamKey]: 'guest-beam', [torsionKey]: 'guest-torsion' })
    let writes = 0
    const flaky: KeyValueStorage = { ...base, setItem: (k, v) => { if (k.startsWith('ei:user:') && ++writes === 2) throw new Error('quota'); base.setItem(k, v) } }
    const { p } = provider(flaky as typeof base)
    const r = await p.signUp({ ...ana, importGuestProgress: true })
    if (!r.ok) throw new Error()
    expect(r.value).toMatchObject({ imported: 0, importFailed: true })
    expect(base.map.get(beamKey)).toBe('guest-beam')
    expect(base.map.get(torsionKey)).toBe('guest-torsion')
    expect([...base.map.keys()].filter((k) => k.startsWith('ei:user:'))).toEqual([])
  })

  it('signing out returns to guest without exposing the previous user', async () => {
    const { p } = provider()
    const a = await p.signUp(ana)
    if (!a.ok) throw new Error()
    p.progressStorage(a.value.user).setItem(beamKey, 'ana-beam')
    await p.signOut()
    expect(p.currentUser()).toBeNull()
    expect(p.guestProgress().getItem(beamKey)).toBeNull()
    const b = await p.signUp(ben)
    if (!b.ok) throw new Error()
    expect(p.progressStorage(b.value.user).getItem(beamKey)).toBeNull() // another user never reads Ana's work
    await p.signOut()
    await p.signIn({ identifier: ana.identifier, password: ana.password })
    expect(p.progressStorage(p.currentUser()!).getItem(beamKey)).toBe('ana-beam')
  })

  it("deletes only the signed-in account and its progress, after the password is confirmed", async () => {
    const { p, storage } = provider(memory({ [beamKey]: 'guest-beam' }))
    const b = await p.signUp(ben)
    if (!b.ok) throw new Error()
    p.progressStorage(b.value.user).setItem(beamKey, 'ben-beam')
    await p.signOut()
    const a = await p.signUp(ana)
    if (!a.ok) throw new Error()
    p.progressStorage(a.value.user).setItem(beamKey, 'ana-beam')
    p.progressStorage(a.value.user).setItem(torsionKey, 'ana-torsion')

    expect(await p.deleteAccount('wrong password')).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIALS' } })
    expect(p.currentUser()?.id).toBe(a.value.user.id)
    expect(await p.deleteAccount(ana.password)).toEqual({ ok: true, value: undefined })
    expect(p.currentUser()).toBeNull()
    expect(storage.map.has(ACCOUNT_SESSION_KEY)).toBe(false)
    expect([...storage.map.keys()].filter((k) => k.startsWith(`ei:user:${a.value.user.id}:`))).toEqual([])
    expect(await p.signIn({ identifier: ana.identifier, password: ana.password })).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIALS' } })
    // Other users and guest progress are untouched.
    expect(storage.map.get(`ei:user:${b.value.user.id}:session:cantilever-beam-1:v1`)).toBe('ben-beam')
    expect(storage.map.get(beamKey)).toBe('guest-beam')
    expect(await p.deleteAccount(ana.password)).toMatchObject({ ok: false, error: { code: 'NOT_SIGNED_IN' } })
  })

  it('never overwrites unreadable account records', async () => {
    const { p, storage } = provider(memory({ [ACCOUNTS_KEY]: '{"broken"' }))
    expect(await p.signUp(ana)).toMatchObject({ ok: false, error: { code: 'CORRUPT_ACCOUNTS' } })
    expect(storage.map.get(ACCOUNTS_KEY)).toBe('{"broken"')
    expect(p.currentUser()).toBeNull()
  })

  it('treats a stale or malformed session as guest', () => {
    const { p } = provider(memory({ [ACCOUNT_SESSION_KEY]: JSON.stringify({ schemaVersion: 1, userId: 'missing-user', signedInAt: '' }) }))
    expect(p.currentUser()).toBeNull()
    const { p: p2 } = provider(memory({ [ACCOUNT_SESSION_KEY]: 'not json' }))
    expect(p2.currentUser()).toBeNull()
  })

  it('reports unavailable crypto or storage instead of failing silently', async () => {
    const noCrypto = createLocalAccountProvider({ storage: memory(), crypto: undefined, clock: () => '', newId: () => 'user-0001' })
    expect(await noCrypto.signUp(ana)).toMatchObject({ ok: false, error: { code: 'CRYPTO_UNAVAILABLE' } })
    const throwing: KeyValueStorage = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => {}, keys: () => [] }
    const blocked = createLocalAccountProvider({ storage: throwing, crypto, clock: () => '', newId: () => 'user-0001', iterations: 1000 })
    expect(blocked.currentUser()).toBeNull()
    expect(await blocked.signUp(ana)).toMatchObject({ ok: false, error: { code: 'STORAGE_UNAVAILABLE' } })
  })
})
