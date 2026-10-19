'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SiteIcon from './SiteIcon'
import { useAccount } from './AccountProvider'

export default function AuthForm({ signup = false }: { signup?: boolean }) {
  const router = useRouter()
  const { refreshSession } = useAccount()
  const [busy,setBusy]=useState(false)
  const [errors,setErrors]=useState<Record<string,string>>({})
  const [error,setError]=useState('')
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setErrors({})
    const data=Object.fromEntries(new FormData(event.currentTarget))
    try {
      const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,operation:signup?'signup':'login'})})
      const result=await response.json()
      if(!response.ok){setErrors(result.errors||{});setError(result.error||'Please check the highlighted fields.');return}
      await refreshSession()
      router.push('/workspace');router.refresh()
    } catch {setError('Unable to connect. Please try again.')}
    finally{setBusy(false)}
  }
  const inputClass='mt-2 w-full rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none transition focus:border-olive focus:ring-2 focus:ring-sage'
  return <form onSubmit={submit} className="space-y-5">
    {signup&&<label className="block text-sm font-medium text-ink">Full name<input name="name" autoComplete="name" required maxLength={80} className={inputClass} placeholder="Your name" aria-invalid={!!errors.name}/>{errors.name&&<span className="mt-1 block text-xs text-red-700">{errors.name}</span>}</label>}
    <label className="block text-sm font-medium text-ink">Email address<input name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} placeholder="you@example.com" aria-invalid={!!errors.email}/>{errors.email&&<span className="mt-1 block text-xs text-red-700">{errors.email}</span>}</label>
    <label className="block text-sm font-medium text-ink">Password<input name="password" type="password" autoComplete={signup?'new-password':'current-password'} required minLength={signup?10:1} maxLength={128} className={inputClass} placeholder={signup?'At least 10 characters':'Enter your password'} aria-invalid={!!errors.password}/>{errors.password&&<span className="mt-1 block text-xs text-red-700">{errors.password}</span>}</label>
    {signup&&<label className="block text-sm font-medium text-ink">I'm using Statica as a<select name="audience" defaultValue="student" className={inputClass}><option value="student">Student</option><option value="educator">Teacher or educator</option><option value="investor">Investor</option><option value="other">Independent learner / other</option></select>{errors.audience&&<span className="mt-1 block text-xs text-red-700">{errors.audience}</span>}</label>}
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p>}
    <button disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-lg bg-forest px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-forest-dark disabled:cursor-wait disabled:opacity-60">{busy?'Please wait…':signup?'Create account':'Sign in'}<SiteIcon/></button>
    <p className="text-center text-xs leading-relaxed text-muted">{signup?'Already have an account?':'New to Statica?'} <Link className="font-semibold text-forest underline underline-offset-4" href={signup?'/sign-in':'/create-account'}>{signup?'Sign in':'Create account'}</Link></p>
    <div className="border-t border-line pt-5 text-center"><Link href="/workspace" className="inline-flex items-center gap-2 text-sm text-forest">Continue as guest<SiteIcon/></Link><p className="mt-2 text-xs text-muted">No account needed to try a challenge.</p></div>
  </form>
}
