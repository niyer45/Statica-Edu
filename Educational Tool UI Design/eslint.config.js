// ESLint flat config.
// Enforces the architecture boundaries from requirements 1.5–1.7 and the
// dangerouslySetInnerHTML ban from requirement 23.7.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Directories that hold pure domain code (no React, no Three.js, no UI/state).
const DOMAIN_DIRS = ['units', 'challenge', 'geometry', 'physics', 'evaluation'];

// Matches a relative (`./`, `../`), alias (`@/`) or root (`src/`) import whose
// path contains the given directory segment, e.g. `../ui/Panel`, `@/state`.
const localDir = (dir) => `^(\\.{1,2}/|@/|src/)(.*/)?${dir}(/|$)`;

const DOMAIN_RESTRICTED_PATTERNS = [
  {
    regex: '^react(-dom)?(/|$)',
    message: 'Domain modules must not import React (Req 1.5).',
  },
  {
    regex: '^three(/|$)',
    message: 'Domain modules must not import three (Req 1.5).',
  },
  {
    regex: '^@react-three/',
    message: 'Domain modules must not import @react-three/* (Req 1.5).',
  },
  {
    regex: localDir('ui'),
    message: 'Domain modules must not import from ui/ (Req 1.5).',
  },
  {
    regex: localDir('state'),
    message: 'Domain modules must not import from state/ (Req 1.5).',
  },
];

const PHYSICS_RESTRICTED_PATTERNS = [
  {
    regex: localDir('evaluation'),
    message: 'physics/ must not import from evaluation/ (Req 1.7).',
  },
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.figma/**', 'coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Downgraded: template code (vite.config.ts) and test casts trip this.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Req 23.7: never render raw HTML.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is banned (Req 23.7).',
        },
      ],
    },
  },
  // Domain module boundaries (Req 1.5, 1.6).
  {
    files: DOMAIN_DIRS.filter((d) => d !== 'physics').map((d) => `src/${d}/**/*.{ts,tsx}`),
    rules: {
      'no-restricted-imports': ['error', { patterns: DOMAIN_RESTRICTED_PATTERNS }],
    },
  },
  // physics/ gets the domain rules plus the evaluation ban (Req 1.7).
  // Flat config replaces rule options per block, so both lists are combined here.
  {
    files: ['src/physics/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...DOMAIN_RESTRICTED_PATTERNS, ...PHYSICS_RESTRICTED_PATTERNS] },
      ],
    },
  },
);
