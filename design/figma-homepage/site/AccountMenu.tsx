'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAccount } from './AccountProvider'

export default function AccountMenu() {
  const { user, clearSession } = useAccount()
  const [error,setError] = useState('')
  return <div className="flex items-center gap-4 text-xs text-muted">
    {user?<><span>{user.name}</span><button type="button" onClick={async()=>{
      setError('')
      try{const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'logout'})});if(!response.ok)throw new Error();clearSession()}catch{setError('Could not sign out. Retry.')}
    }} className="font-medium text-forest">Sign out</button></>:<><span className="hidden sm:inline">Guest workspace</span><Link href="/sign-in" className="font-medium text-forest">Sign in</Link></>}
    <Link href="/" className="border-l border-line pl-4 text-muted">Home</Link>
    {error&&<span role="alert" className="text-red-700">{error}</span>}
  </div>
}
