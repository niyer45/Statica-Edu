import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { PASSWORD_MIN, validateSignUp } from '../../account/localProvider'
import type { AccountError } from '../../account/types'
import Icon from '../icons/Icon'
import type { AccountView } from '../shell/routes'
import type { AccountContextValue } from './AccountContext'
import '../shell/home.css'

// Account page (task 38): create-account and sign-in forms for guests; profile, sign-out and
// account deletion for a signed-in user. Errors are tied to their fields (aria-invalid +
// aria-describedby), focus moves to the first problem, and form-level errors use role="alert".

export interface AccountPageProps {
  account: AccountContextValue
  view: AccountView
  onViewChange: (view: AccountView) => void
  /** Titles of challenges with guest work on this device, previewed before moving them. */
  guestWork: readonly string[]
  onBrowse: () => void
}

type FieldErrors = Partial<Record<'displayName' | 'identifier' | 'password' | 'confirm', string>>

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'password'
  autoComplete: string
  error?: string
  hint?: string
  inputRef?: RefObject<HTMLInputElement | null>
}

function Field({ label, value, onChange, type = 'text', autoComplete, error, hint, inputRef }: FieldProps) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')
  return (
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      {hint && <p id={`${id}-hint`} className="account-hint">{hint}</p>}
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        spellCheck={false}
        autoCapitalize="none"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="account-field-error">
          {error}
        </p>
      )}
    </div>
  )
}

function FormAlert({ message }: { message: string | null }) {
  return message === null ? null : (
    <div className="account-alert" role="alert">
      {message}
    </div>
  )
}

export const DEVICE_STORAGE_NOTE =
  'Accounts are stored only in this browser on this device. There is no cloud sync yet, so your progress will not appear on other devices or browsers, and clearing this site’s data removes it. An account keeps each person’s progress separate on a shared browser; it does not protect it from someone who can use this browser profile.'

function DeviceNote() {
  return (
    <p className="account-device-note">
      <Icon name="lock" size={15} />
      <span>{DEVICE_STORAGE_NOTE}</span>
    </p>
  )
}

function useFocusFirst() {
  const refs = {
    displayName: useRef<HTMLInputElement>(null),
    identifier: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    confirm: useRef<HTMLInputElement>(null),
  }
  const focusFirst = (errors: FieldErrors) => {
    for (const key of ['displayName', 'identifier', 'password', 'confirm'] as const) {
      if (errors[key]) { refs[key].current?.focus(); return }
    }
  }
  return { refs, focusFirst }
}

function fieldErrorsFrom(error: AccountError): FieldErrors {
  return error.field ? { [error.field]: error.message } : {}
}

function SignUpForm({ account, guestWork, onSwitch }: { account: AccountContextValue; guestWork: readonly string[]; onSwitch: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [moveGuest, setMoveGuest] = useState(true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [alert, setAlert] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { refs, focusFirst } = useFocusFirst()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const found: FieldErrors = {}
    for (const e of validateSignUp({ displayName, identifier, password })) if (e.field && !found[e.field]) found[e.field] = e.message
    if (!found.password && confirm !== password) found.confirm = 'The passwords do not match.'
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setAlert(`Check the form: ${Object.keys(found).length === 1 ? '1 field needs' : `${Object.keys(found).length} fields need`} attention.`)
      focusFirst(found)
      return
    }
    setAlert(null)
    setBusy(true)
    const r = await account.signUp({ displayName, identifier, password, importGuestProgress: guestWork.length > 0 && moveGuest })
    // On success the workspace remounts for the new account; this form is gone.
    if (r.ok) return
    setBusy(false)
    const fieldErrors = fieldErrorsFrom(r.error)
    setErrors(fieldErrors)
    setAlert(r.error.message)
    focusFirst(fieldErrors)
  }

  return (
    <form className="account-form panel" onSubmit={submit} noValidate aria-labelledby="account-title">
      <FormAlert message={alert} />
      <Field label="Display name" value={displayName} onChange={setDisplayName} autoComplete="nickname" error={errors.displayName} inputRef={refs.displayName} />
      <Field label="Email or username" value={identifier} onChange={setIdentifier} autoComplete="username" error={errors.identifier} hint="Used to sign in on this device. Nothing is sent anywhere." inputRef={refs.identifier} />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" error={errors.password} hint={`At least ${PASSWORD_MIN} characters.`} inputRef={refs.password} />
      <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} inputRef={refs.confirm} />
      {guestWork.length > 0 && (
        <fieldset className="account-migrate">
          <legend>Guest progress on this device</legend>
          <ul>
            {guestWork.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
          <label className="account-check">
            <input type="checkbox" checked={moveGuest} onChange={(e) => setMoveGuest(e.target.checked)} />
            <span>Move this guest progress into my new account</span>
          </label>
          <p className="account-hint">
            Moved work belongs to the account and no longer appears for guests. Leave this unchecked to keep it as guest
            progress.
          </p>
        </fieldset>
      )}
      <button type="submit" className="primary account-submit" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
      <p className="account-switch">
        Already have an account on this device?{' '}
        <button type="button" onClick={onSwitch}>
          Sign in
        </button>
      </p>
    </form>
  )
}

function SignInForm({ account, onSwitch }: { account: AccountContextValue; onSwitch: () => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [alert, setAlert] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { refs, focusFirst } = useFocusFirst()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const found: FieldErrors = {}
    if (identifier.trim() === '') found.identifier = 'Enter your email address or username.'
    if (password === '') found.password = 'Enter your password.'
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setAlert(`Check the form: ${Object.keys(found).length === 1 ? '1 field needs' : '2 fields need'} attention.`)
      focusFirst(found)
      return
    }
    setAlert(null)
    setBusy(true)
    const r = await account.signIn({ identifier, password })
    if (r.ok) return
    setBusy(false)
    setPassword('')
    const fieldErrors = fieldErrorsFrom(r.error)
    setErrors(fieldErrors)
    setAlert(r.error.message)
    if (Object.keys(fieldErrors).length > 0) focusFirst(fieldErrors)
    else refs.password.current?.focus()
  }

  return (
    <form className="account-form panel" onSubmit={submit} noValidate aria-labelledby="account-title">
      <FormAlert message={alert} />
      <Field label="Email or username" value={identifier} onChange={setIdentifier} autoComplete="username" error={errors.identifier} inputRef={refs.identifier} />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" error={errors.password} inputRef={refs.password} />
      <button type="submit" className="primary account-submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="account-switch">
        New to Statica?{' '}
        <button type="button" onClick={onSwitch}>
          Create an account
        </button>
      </p>
    </form>
  )
}

function DeleteAccountForm({ account }: { account: AccountContextValue }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [alert, setAlert] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (password === '') {
      setError('Enter your password to confirm.')
      setAlert('Enter your password to confirm deletion.')
      input.current?.focus()
      return
    }
    setBusy(true)
    const r = await account.deleteAccount(password)
    if (r.ok) return
    setBusy(false)
    setPassword('')
    setError(r.error.field ? r.error.message : undefined)
    setAlert(r.error.message)
    input.current?.focus()
  }

  return (
    <form className="account-form account-danger panel" onSubmit={submit} noValidate aria-labelledby="delete-title">
      <h2 id="delete-title">Delete account</h2>
      <p>
        Permanently deletes this account and all of its saved challenge progress from this browser. This cannot be
        undone. Guest progress on this device is not affected.
      </p>
      <FormAlert message={alert} />
      <Field label="Password to confirm deletion" type="password" value={password} onChange={setPassword} autoComplete="current-password" error={error} inputRef={input} />
      <button type="submit" className="account-delete" disabled={busy}>
        {busy ? 'Deleting…' : 'Delete account and progress'}
      </button>
    </form>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <section className="library-heading">
      <h1 id="account-title">{children}</h1>
    </section>
  )
}

export default function AccountPage({ account, view, onViewChange, guestWork, onBrowse }: AccountPageProps) {
  const [signingOut, setSigningOut] = useState(false)
  const user = account.user
  if (user === null) {
    return (
      <div className="account-page">
        <Heading>{view === 'sign-in' ? 'Sign in' : 'Create an account'}</Heading>
        <DeviceNote />
        {view === 'sign-in' ? (
          <SignInForm key="sign-in" account={account} onSwitch={() => onViewChange('sign-up')} />
        ) : (
          <SignUpForm key="sign-up" account={account} guestWork={guestWork} onSwitch={() => onViewChange('sign-in')} />
        )}
        <p className="account-guest">
          <button type="button" className="home-secondary" onClick={onBrowse}>
            Continue as guest
            <Icon name="arrow" size={15} />
          </button>
        </p>
      </div>
    )
  }
  return (
    <div className="account-page">
      <Heading>Your account</Heading>
      <section className="account-form panel" aria-labelledby="profile-title">
        <h2 id="profile-title">Signed in on this device</h2>
        <dl className="account-profile">
          <div>
            <dt>Display name</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div>
            <dt>Email or username</dt>
            <dd>{user.identifier}</dd>
          </div>
        </dl>
        <DeviceNote />
        <button
          type="button"
          className="primary account-submit"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true)
            void account.signOut()
          }}
        >
          Sign out
        </button>
      </section>
      <DeleteAccountForm account={account} />
    </div>
  )
}
