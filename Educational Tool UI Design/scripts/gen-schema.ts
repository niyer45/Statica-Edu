// Writes schemas/challenge.schema.json from the zod challenge schema (D-13).
// Rendering lives in ./challengeSchema so tests can import it without writing files.
// Usage: pnpm run gen:schema
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderChallengeSchema } from './challengeSchema'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = resolve(root, 'schemas', 'challenge.schema.json')
writeFileSync(outFile, renderChallengeSchema(), 'utf8')
console.log(`Wrote ${outFile}`)
