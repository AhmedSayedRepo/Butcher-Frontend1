// Small helper to safely pull `{ error: string }` out of an axios error
// response (see CONTRACT.md for the shape the backend actually returns)
// without an explicit `any` catch-clause annotation, which
// @typescript-eslint/no-explicit-any flags. `err` in a `catch` block is
// `unknown` by default — narrowed step by step with `in` + `typeof` here,
// same style as the backend's `isAuthTokenPayload` (backend/src/middleware/auth.ts).
export function extractApiErrorMessage(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('response' in err)) return undefined
  const { response } = err
  if (typeof response !== 'object' || response === null || !('data' in response)) return undefined
  const { data } = response
  if (typeof data !== 'object' || data === null || !('error' in data)) return undefined
  const { error } = data
  return typeof error === 'string' ? error : undefined
}
