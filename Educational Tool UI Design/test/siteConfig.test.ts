import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Requirement 23.9: site.json must not enable analytics, custom scripts, or bypass links
// (bypass links inject an inline style, which the CSP forbids).
// Requirement 34.9: the document title is "Statica".

const SITE_JSON = fileURLToPath(new URL('../.figma/make/site.json', import.meta.url))

/** Returns one message per violation; each message names the offending key. */
function siteConfigViolations(config: unknown): string[] {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return ['site.json: top level must be a JSON object']
  }
  const c = config as Record<string, unknown>
  const violations: string[] = []
  const section = (key: string): Record<string, unknown> | undefined => {
    const v = c[key]
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined
  }

  const analytics = section('analytics')
  if (analytics && 'googleAnalyticsId' in analytics && analytics.googleAnalyticsId !== undefined) {
    violations.push('analytics.googleAnalyticsId must not be set')
  }
  if ('customScripts' in c) {
    violations.push('customScripts must not be present')
  }
  if (section('accessibility')?.addBypassLinks === true) {
    violations.push('accessibility.addBypassLinks must not be true')
  }
  if (c.title !== 'Statica') {
    violations.push(`title must be "Statica" (found ${JSON.stringify(c.title)})`)
  }
  return violations
}

describe('site configuration guard', () => {
  it('.figma/make/site.json has no analytics, custom scripts, or bypass links, and title is Statica', () => {
    const config: unknown = JSON.parse(readFileSync(SITE_JSON, 'utf8'))
    expect(siteConfigViolations(config)).toEqual([])
  })

  describe('siteConfigViolations', () => {
    const good = { title: 'Statica', accessibility: { addBypassLinks: false } }

    it('accepts a clean config', () => {
      expect(siteConfigViolations(good)).toEqual([])
    })

    it('flags addBypassLinks: true', () => {
      const bad = { ...good, accessibility: { addBypassLinks: true } }
      expect(siteConfigViolations(bad)).toEqual(['accessibility.addBypassLinks must not be true'])
    })

    it('flags analytics.googleAnalyticsId', () => {
      const bad = { ...good, analytics: { googleAnalyticsId: 'G-XXXX' } }
      expect(siteConfigViolations(bad)).toEqual(['analytics.googleAnalyticsId must not be set'])
    })

    it('flags any customScripts key, even if empty', () => {
      expect(siteConfigViolations({ ...good, customScripts: {} })).toEqual([
        'customScripts must not be present',
      ])
    })

    it('flags a wrong title', () => {
      expect(siteConfigViolations({ ...good, title: 'Other' })).toEqual([
        'title must be "Statica" (found "Other")',
      ])
    })

    it('flags a non-object config', () => {
      expect(siteConfigViolations(null)).toHaveLength(1)
    })
  })
})
