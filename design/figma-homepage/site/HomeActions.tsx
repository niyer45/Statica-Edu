'use client'
import Link from 'next/link'
import SiteIcon from './SiteIcon'
import { useAccount } from './AccountProvider'

export default function HomeActions({ hero = false, entryOnly = false }: { hero?: boolean; entryOnly?: boolean }) {
  const { user } = useAccount()
  if (entryOnly) return <Link href="/workspace" className="inline-flex shrink-0 items-center justify-center gap-3 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-forest transition hover:bg-sage">{user?'Open workspace':'Continue as guest'}<SiteIcon/></Link>
  if (hero) return <div className="mt-8 flex flex-wrap gap-3">
    <Link href={user?'/workspace':'/create-account'} className="inline-flex items-center justify-center gap-3 rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-dark">{user?'Open workspace':'Create account'}<SiteIcon/></Link>
    {!user&&<Link href="/workspace" className="inline-flex items-center justify-center gap-3 rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-forest transition hover:bg-sage">Continue as guest<SiteIcon/></Link>}
  </div>
  return <div className="flex shrink-0 items-center gap-3 sm:gap-5">
    {user?<span className="hidden text-xs text-muted sm:inline">Signed in as {user.name}</span>:<Link href="/sign-in" className="whitespace-nowrap text-xs font-medium text-forest sm:text-sm">Sign in</Link>}
    <Link href={user?'/workspace':'/create-account'} className="whitespace-nowrap rounded-lg bg-forest px-3 py-2.5 text-xs font-medium text-white transition hover:bg-forest-dark sm:px-4 sm:text-sm">{user?'Open workspace':'Create account'}<SiteIcon className="ml-2 hidden size-3.5 sm:inline"/></Link>
  </div>
}
