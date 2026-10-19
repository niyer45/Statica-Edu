import Link from 'next/link'

export default function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" aria-label="Statica home" className={`inline-flex shrink-0 items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-forest'}`}>
    <svg width="27" height="31" viewBox="0 0 27 31" fill="currentColor" aria-hidden="true"><path d="M0 9 7 6v20l-7 3zm10-6 7-3v26l-7 3zm10 4 7-3v18l-7 3z"/></svg>
    statica<span className="-ml-2 text-olive">.</span>
  </Link>
}
