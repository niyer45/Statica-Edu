'use client'
import { useState } from 'react'
import Link from 'next/link'
import SiteIcon from './SiteIcon'

const content = {
  Students: {
    intro: 'Connect equations to physical behavior.',
    description: 'Reinforce what you learn in class by changing a design and seeing how stiffness, stress, and mass respond.',
    items: [['Undergraduates','Apply mechanics and materials concepts to testable design requirements.'],['High school students','Explore foundational principles through visual, accessible challenges.'],['Independent learners','Work at your own pace, with guided steps when you need structure.']],
    action: 'Explore challenges', href: '/workspace',
  },
  Educators: {
    intro: 'Bring a design problem into the classroom.',
    description: 'Use a challenge as a live demonstration or a design exercise alongside your existing course—not as a replacement for it.',
    items: [['Demonstrate a concept','Use the cantilever model to compare cross-sections and explain bending.'],['Structure an exercise','Ask students to predict, test, compare, and explain their results.'],['Classroom tools · Planned','Assignments, student submissions, and course-aligned learning paths.']],
    action: 'Try the workbench', href: '/workspace',
  },
  Investors: {
    intro: 'A focused platform for engineering education.',
    description: 'Statica is developing a structured engineering learning platform centered on physical simulation and iterative design.',
    items: [['Today','A working cantilever challenge, a validated first-order model, and the core learning workflow.'],['Next','Broader mechanics challenges, guided learning modules, and classroom workflows.'],['Long term','A connected curriculum across engineering disciplines, with increasingly independent design tools.']],
    action: 'View the roadmap', href: '#roadmap',
  },
}
export default function AudienceTabs(){
  const [active,setActive]=useState<keyof typeof content>('Students')
  const data=content[active]
  return <div className="overflow-hidden rounded-2xl border border-line bg-white">
    <div role="tablist" aria-label="Who Statica is for" className="flex border-b border-line bg-canvas p-2">{(Object.keys(content) as (keyof typeof content)[]).map((name,i)=><button role="tab" id={`audience-${name}`} aria-selected={active===name} aria-controls="audience-panel" key={name} onClick={()=>setActive(name)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition ${active===name?'bg-white text-forest shadow-sm':'text-muted hover:text-forest'}`}><SiteIcon name={i===0?'book':i===1?'users':'chart'}/>{name}</button>)}</div>
    <div id="audience-panel" role="tabpanel" aria-labelledby={`audience-${active}`} className="grid gap-8 p-7 md:grid-cols-2 md:p-10">
      <div><h3 className="font-display text-2xl font-semibold tracking-tight text-ink">{data.intro}</h3><p className="mt-4 max-w-md text-sm leading-7 text-muted">{data.description}</p><Link href={data.href} className="mt-6 inline-flex items-center gap-3 text-sm font-semibold text-forest">{data.action}<SiteIcon/></Link></div>
      <div className="space-y-5">{data.items.map(([title,text])=><div className="flex gap-3" key={title}><span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-sage text-olive"><SiteIcon name="check" className="size-3"/></span><div><h4 className="text-sm font-semibold text-ink">{title}</h4><p className="mt-1 text-sm leading-6 text-muted">{text}</p></div></div>)}</div>
    </div>
  </div>
}
