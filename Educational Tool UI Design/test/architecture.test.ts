// Architecture test (fixture E6). Enforces Requirements 1.5, 1.6, 1.7, and 1.14
// alongside the ESLint `no-restricted-imports` rule in eslint.config.js.
//
// The scanners are exported pure functions so the synthetic cases at the bottom
// can prove they catch violations, not just that the current tree is clean.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_ROOT = path.join(PROJECT_ROOT, 'src')

export const DOMAIN_DIRS = ['units', 'challenge', 'geometry', 'physics', 'evaluation', 'learn'] as const // learn: task 67 (LRN-10)

const SOURCE_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const TEST_FILE = /\.test\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/

// ---------------------------------------------------------------------------
// Comment stripping
// ---------------------------------------------------------------------------

/**
 * Replaces `//` and `/* *\/` comments with spaces (newlines kept, so line
 * numbers stay valid) while leaving string and template literals intact.
 * Regex literals are not tracked; that is good enough for import and formula
 * scanning in this codebase.
 */
export function stripComments(source: string): string {
  let out = ''
  let i = 0
  const n = source.length
  while (i < n) {
    const c = source[i]
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') {
        out += ' '
        i++
      }
    } else if (c === '/' && next === '*') {
      out += '  '
      i += 2
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' '
        i++
      }
      if (i < n) {
        out += '  '
        i += 2
      }
    } else if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i++
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < n) {
          out += source[i] + source[i + 1]
          i += 2
          continue
        }
        // Plain quotes cannot span lines; bail out so a stray quote cannot swallow the file.
        if (quote !== '`' && source[i] === '\n') break
        out += source[i]
        i++
      }
      if (i < n && source[i] === quote) {
        out += quote
        i++
      }
    } else {
      out += c
      i++
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Import extraction and classification
// ---------------------------------------------------------------------------

const IMPORT_PATTERNS: readonly RegExp[] = [
  // import x from '...', import { a } from '...', import type X from '...',
  // export { a } from '...', export * from '...'
  /\b(?:import|export)\s+(?:type\s+)?[^;'"`]*?\bfrom\s*(['"])([^'"\n]+)\1/g,
  // import '...'  (side-effect import)
  /\bimport\s*(['"])([^'"\n]+)\1/g,
  // import('...')  (dynamic import)
  /\bimport\s*\(\s*(['"`])([^'"`\n]+)\1\s*\)/g,
  // require('...')
  /\brequire\s*\(\s*(['"`])([^'"`\n]+)\1\s*\)/g,
]

/** Returns every module specifier the source imports, re-exports, or requires. */
export function extractImportSpecifiers(source: string): string[] {
  const code = stripComments(source)
  const found = new Set<string>()
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of code.matchAll(pattern)) found.add(match[2])
  }
  return [...found]
}

const FORBIDDEN_PACKAGES: readonly { regex: RegExp; label: string }[] = [
  { regex: /^react(-dom)?(\/|$)/, label: 'react' },
  { regex: /^three(\/|$)/, label: 'three' },
  { regex: /^@react-three\//, label: '@react-three/*' },
]

const FORBIDDEN_LOCAL_DIRS = ['ui', 'state'] as const

/**
 * Resolves a local specifier to the top-level directory under `src/` it lands
 * in (e.g. `../ui/Panel` from `src/physics/x.ts` → `ui`). Returns null for
 * package imports and for paths that resolve outside `src/`.
 */
export function resolveSrcTopLevel(
  importerFile: string,
  specifier: string,
  srcRoot: string,
): string | null {
  let target: string
  if (specifier.startsWith('.')) {
    target = path.resolve(path.dirname(importerFile), specifier)
  } else if (specifier.startsWith('@/')) {
    target = path.resolve(srcRoot, specifier.slice(2))
  } else if (specifier.startsWith('src/')) {
    target = path.resolve(srcRoot, specifier.slice(4))
  } else if (path.isAbsolute(specifier)) {
    target = path.resolve(specifier)
  } else {
    return null
  }
  const rel = path.relative(srcRoot, target)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null
  const segments = rel.split(path.sep)
  const first = segments[0]
  // `../ui` and `../ui.ts` both mean the ui module.
  return segments.length === 1 ? first.replace(SOURCE_EXT, '') : first
}

/** The domain module a file belongs to, or null if it is not in one. */
export function domainModuleOf(file: string, srcRoot: string): string | null {
  const rel = path.relative(srcRoot, file)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  const first = rel.split(path.sep)[0]
  return (DOMAIN_DIRS as readonly string[]).includes(first) ? first : null
}

export interface ImportViolation {
  file: string
  specifier: string
  reason: string
}

/** Checks one file's imports against the domain boundary rules. */
export function findImportViolations(
  file: string,
  source: string,
  srcRoot: string,
): ImportViolation[] {
  const module = domainModuleOf(file, srcRoot)
  if (module === null) return []
  const violations: ImportViolation[] = []
  for (const specifier of extractImportSpecifiers(source)) {
    const pkg = FORBIDDEN_PACKAGES.find((p) => p.regex.test(specifier))
    if (pkg) {
      violations.push({
        file,
        specifier,
        reason: `domain module ${module}/ must not import ${pkg.label} (Req 1.5)`,
      })
      continue
    }
    const top = resolveSrcTopLevel(file, specifier, srcRoot)
    if (top !== null && (FORBIDDEN_LOCAL_DIRS as readonly string[]).includes(top)) {
      violations.push({
        file,
        specifier,
        reason: `domain module ${module}/ must not import ${top}/ (Req 1.5)`,
      })
    } else if (module === 'physics' && top === 'evaluation') {
      violations.push({ file, specifier, reason: 'physics/ must not import evaluation/ (Req 1.7)' })
    }
  }
  return violations
}

// ---------------------------------------------------------------------------
// Formula scan for code outside the domain modules (Req 1.14)
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate engineering math (section properties, mass,
 * deflection, stress, pass/fail) rather than drawing math. Plain `Math.PI`
 * is intentionally absent: the UI uses it for circles and camera angles.
 */
export const FORMULA_PATTERNS: readonly { name: string; regex: RegExp }[] = [
  { name: 'fourth power (second moment of a circle/tube)', regex: /\*\*\s*\(?\s*4\b/ },
  { name: 'cube (rectangle I, or L³ in deflection)', regex: /\*\*\s*\(?\s*3\b/ },
  { name: 'divide by 64 (πd⁴/64)', regex: /\/\s*64\b/ },
  { name: 'bh³/12', regex: /\)?\s*\/\s*12\b[^\n]*\*\*|\*\*[^\n]*\/\s*12\b/ },
  { name: 'divide by (3 * … (FL³/3EI)', regex: /\/\s*\(\s*3\s*\*/ },
  { name: 'circle area π·r² / π·d²', regex: /Math\.PI\s*\*[^;\n]*\*\*\s*\(?\s*2\b/ },
  { name: 'hard-coded aluminium density 2700', regex: /\b2_?700\b/ },
  { name: 'hard-coded elastic modulus 69 GPa', regex: /\b69e9\b|\b69_000_000_000\b|\b69000000000\b/ },
  { name: 'hard-coded stress limit', regex: /\b120e6\b|\b240e6\b/ },
  { name: 'hard-coded span cubed', regex: /\b0?\.6\s*\*\*/ },
  {
    name: 'constraint pass/fail comparison',
    regex: /[<>]=?\s*[\w.]*\b(maxDeflectionM|maxMassKg|maxStressPa)\b/,
  },
]

/**
 * Per-file exceptions, as `relative/path` → pattern names. Empty on purpose:
 * the template's BeamScene display curve `(x/330)**2*(3-x/330)/2` uses only a
 * square and none of the patterns above, so no exception is needed today.
 * Add an entry only with a comment explaining why the match is not physics.
 */
export const FORMULA_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {}

export interface FormulaMatch {
  pattern: string
  line: number
  text: string
}

/** Returns every formula-pattern hit in the source, ignoring comments. */
export function findFormulaMatches(source: string, allowed: readonly string[] = []): FormulaMatch[] {
  const lines = stripComments(source).split('\n')
  const matches: FormulaMatch[] = []
  lines.forEach((text, index) => {
    for (const { name, regex } of FORMULA_PATTERNS) {
      if (!allowed.includes(name) && regex.test(text)) {
        matches.push({ pattern: name, line: index + 1, text: text.trim() })
      }
    }
  })
  return matches
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else if (SOURCE_EXT.test(entry)) files.push(full)
  }
  return files.sort()
}

/** All source files in the domain modules, including their tests. */
function domainFiles(): string[] {
  return DOMAIN_DIRS.flatMap((d) => walk(path.join(SRC_ROOT, d)))
}

/**
 * Non-test source files outside the domain modules: `src/ui/**`, `src/state/**`,
 * and the template files still at the src root (App, Workspace, BeamScene,
 * TechnicalArt, main). Tests are skipped because they may assert on expected numbers.
 */
function nonDomainFiles(): string[] {
  return walk(SRC_ROOT).filter((f) => domainModuleOf(f, SRC_ROOT) === null && !TEST_FILE.test(f))
}

const rel = (file: string) => path.relative(PROJECT_ROOT, file).split(path.sep).join('/')

// ---------------------------------------------------------------------------
// Tests against the real tree
// ---------------------------------------------------------------------------

describe('architecture boundaries (E6)', () => {
  it('scans at least one domain file', () => {
    expect(domainFiles().length).toBeGreaterThan(0)
  })

  it('domain modules import no react, three, @react-three/*, ui/, or state/; physics/ imports no evaluation/', () => {
    const violations = domainFiles().flatMap((file) =>
      findImportViolations(file, readFileSync(file, 'utf8'), SRC_ROOT),
    )
    const report = violations.map((v) => `${rel(v.file)}: '${v.specifier}' — ${v.reason}`)
    expect(report).toEqual([])
  })

  it('the template prototype physics module is gone (Req 1.14)', () => {
    const leftovers = ['src/physics.ts', 'src/physics.test.ts'].filter((f) =>
      existsSync(path.join(PROJECT_ROOT, f)),
    )
    expect(leftovers).toEqual([])
  })

  it('code outside the domain modules computes no section properties, mass, deflection, stress, or pass/fail (Req 1.14)', () => {
    const files = nonDomainFiles()
    expect(files.map(rel)).toEqual(expect.arrayContaining(['src/ui/viewport/Fallback2D.tsx']))
    expect(existsSync(path.join(SRC_ROOT, 'BeamScene.tsx'))).toBe(false)
    const report = files.flatMap((file) =>
      findFormulaMatches(readFileSync(file, 'utf8'), FORMULA_ALLOWLIST[rel(file)] ?? []).map(
        (m) => `${rel(file)}:${m.line} [${m.pattern}] ${m.text}`,
      ),
    )
    expect(report).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Synthetic cases proving the scanners catch violations
// ---------------------------------------------------------------------------

describe('architecture scanner', () => {
  const src = '/repo/src'
  const at = (p: string) => path.join(src, p)
  const specs = (file: string, code: string) =>
    findImportViolations(at(file), code, src).map((v) => v.specifier)

  it('extracts every import form', () => {
    const code = [
      "import a from 'a'",
      "import { b, c } from \"b\"",
      "import type { T } from 't'",
      "import * as d from 'd'",
      "import 'side'",
      "export { e } from 'e'",
      "export * from 'star'",
      "const f = await import('dyn')",
      "const g = require('req')",
      'import {\n  multi,\n  line,\n} from "multi"',
    ].join('\n')
    expect(extractImportSpecifiers(code).sort()).toEqual(
      ['a', 'b', 't', 'd', 'side', 'e', 'star', 'dyn', 'req', 'multi'].sort(),
    )
  })

  it('ignores imports inside comments', () => {
    const code = "// import React from 'react'\n/* import '../ui/x'\n */\nexport const x = 1\n"
    expect(extractImportSpecifiers(code)).toEqual([])
  })

  it('keeps string contents that look like comments', () => {
    expect(extractImportSpecifiers("import u from 'http://x/y'")).toEqual(['http://x/y'])
  })

  it('flags react, react-dom, three, and @react-three/* in a domain file', () => {
    const code = [
      "import { useState } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import * as THREE from 'three'",
      "import { Canvas } from '@react-three/fiber'",
    ].join('\n')
    expect(specs('geometry/sections.ts', code)).toEqual([
      'react',
      'react-dom/client',
      'three',
      '@react-three/fiber',
    ])
  })

  it('names the file and import path in the violation', () => {
    const [v] = findImportViolations(at('geometry/x.ts'), "import 'react'", src)
    expect(v).toMatchObject({ file: at('geometry/x.ts'), specifier: 'react' })
  })

  it('flags relative, alias, and src/ imports of ui/ and state/', () => {
    const code = [
      "import a from '../ui/Panel'",
      "import b from '../../src/state/session'",
      "import c from '@/ui'",
      "import d from 'src/state/reducer'",
      "import e from '../ui.ts'",
    ].join('\n')
    expect(specs('units/units.ts', code)).toEqual([
      '../ui/Panel',
      '../../src/state/session',
      '@/ui',
      'src/state/reducer',
      '../ui.ts',
    ])
  })

  it('resolves relative paths instead of matching substrings', () => {
    const code = [
      "import a from './ui-helpers'", // src/geometry/ui-helpers: fine
      "import b from '../geometry/ui/x'", // src/geometry/ui/x: fine
      "import c from './state'", // src/challenge/state: fine
      "import d from 'some-ui-lib'", // package: fine
      "import e from './nested/../../ui/x'", // resolves to src/ui/x: forbidden
    ].join('\n')
    expect(specs('challenge/x.ts', code)).toEqual(['./nested/../../ui/x'])
  })

  it('flags physics importing evaluation, but allows other domain modules to', () => {
    const code = "import { evaluate } from '../evaluation/x'\nexport { y } from '@/evaluation'"
    expect(specs('physics/beam.ts', code)).toEqual(['../evaluation/x', '@/evaluation'])
    expect(specs('physics/nested/deep.ts', "import '../../evaluation/types'")).toEqual([
      '../../evaluation/types',
    ])
    expect(specs('challenge/x.ts', code)).toEqual([])
  })

  it('allows test-framework and sibling-domain imports in domain tests', () => {
    const code = [
      "import { describe } from 'vitest'",
      "import fc from 'fast-check'",
      "import { assertProperty } from '../../test/pbt'",
      "import { mToMm } from '../units/units'",
      "import { z } from 'zod'",
    ].join('\n')
    expect(specs('physics/beam.test.ts', code)).toEqual([])
  })

  it('ignores files outside the domain modules', () => {
    expect(specs('ui/App.tsx', "import 'react'")).toEqual([])
  })

  it('flags engineering formulas in UI code', () => {
    const cases = [
      'const I = Math.PI * d ** 4 / 64',
      'const I = (b * h ** 3) / 12',
      'const delta = (F * L ** 3) / (3 * E * I)',
      'const delta = F * L * L * L / (3 * E * I)',
      'const A = Math.PI * r ** 2',
      'const mass = 2700 * A * L',
      'const E = 69e9',
      'const E = 69_000_000_000',
      'const L3 = 0.6 ** 3',
      'const ok = stress <= challenge.maxStressPa',
    ]
    for (const line of cases) {
      expect(findFormulaMatches(line), line).not.toEqual([])
    }
  })

  it('does not flag drawing math', () => {
    const code = [
      'const angle = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, value))',
      'const ring = Array.from({length:32},(_,i)=>[Math.cos(i*Math.PI/16)*b/2, 0])',
      'const y = 42*(x/330)**2*(3-x/330)/2',
      'const deg = Math.atan2(dy, dx) * 180 / Math.PI',
      'setZoom((v) => Math.max(0.6, v - 0.1))',
      '// I = Math.PI * d ** 4 / 64 explained in a comment',
    ].join('\n')
    expect(findFormulaMatches(code)).toEqual([])
  })

  it('reports the line number and honours the allowlist', () => {
    const code = 'const a = 1\nconst I = Math.PI * d ** 4 / 64'
    const hits = findFormulaMatches(code)
    expect(hits.every((h) => h.line === 2)).toBe(true)
    const all = FORMULA_PATTERNS.map((p) => p.name)
    expect(findFormulaMatches(code, all)).toEqual([])
  })
})
