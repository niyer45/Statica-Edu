import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
it('all application source uses escaped React rendering without raw HTML injection', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
  const files: string[] = []
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (/\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file)) files.push(file)
    }
  }
  visit(root)
  expect(files.filter((file) => readFileSync(file, 'utf8').includes('dangerously' + 'SetInnerHTML'))).toEqual([])
})
