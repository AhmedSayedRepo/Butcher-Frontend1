// Next.js 16 removed the `next lint` command entirely — see
// https://nextjs.org/docs/app/api-reference/config/eslint. This is the flat
// config replacement, using the same eslint-config-next rule sets that
// `next lint` used to apply implicitly (this project never had its own
// eslint.config before — `next lint`'s built-in defaults were the only
// linting that ran).
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts'
  ])
])

export default eslintConfig
