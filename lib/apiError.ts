// Pulls a displayable message out of an axios error without an explicit `any`
// catch-clause annotation (@typescript-eslint/no-explicit-any flags those).
// `err` in a `catch` block is `unknown` by default — narrowed step by step
// with `in` + `typeof`, same style as the backend's `isAuthTokenPayload`.
//
// v3.1 follow-up 10g — translation. The backend now sends `{ error, code,
// params?, details? }` (backend/src/lib/errorCodes.ts). `error` stays English
// because it's what ends up in logs and in non-browser clients; `code` is what
// gets translated here, because the server can't know which language the user
// currently has selected — that's a client-side toggle, not a request header.
//
// The fallback chain matters and is deliberate:
//   1. a translation for the code, if we have one
//   2. the server's English text, if the code is one we don't know yet
//   3. the caller's own generic message
// Step 2 is what keeps a newly-added backend error from rendering as a blank
// box or as a raw code like "ORDER_NOT_FOUND" — worse than English prose.

export interface ApiErrorInfo {
  code: string | undefined
  message: string | undefined
  params: Record<string, string>
  /** Field-level Zod issues, when the failure was a validation error. */
  fieldErrors: Record<string, string[]>
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
}

function asStringMap(value: unknown): Record<string, string> {
  const record = asRecord(value)
  if (record === undefined) return {}
  const out: Record<string, string> = {}
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string') out[key] = item
  }
  return out
}

function asFieldErrors(value: unknown): Record<string, string[]> {
  const details = asRecord(value)
  const flattened = details === undefined ? undefined : asRecord(details.fieldErrors)
  if (flattened === undefined) return {}
  const out: Record<string, string[]> = {}
  for (const [field, issues] of Object.entries(flattened)) {
    if (Array.isArray(issues)) {
      const strings = issues.filter((i): i is string => typeof i === 'string')
      if (strings.length > 0) out[field] = strings
    }
  }
  return out
}

/** Everything the API told us about a failure, in one shape. */
export function extractApiError(err: unknown): ApiErrorInfo {
  const response = asRecord(asRecord(err)?.response)
  const data = asRecord(response?.data)
  const rawError = data?.error
  const rawCode = data?.code
  return {
    code: typeof rawCode === 'string' ? rawCode : undefined,
    message: typeof rawError === 'string' ? rawError : undefined,
    params: asStringMap(data?.params),
    fieldErrors: asFieldErrors(data?.details)
  }
}

/** Back-compat: the English server string only. Prefer `translateApiError`. */
export function extractApiErrorMessage(err: unknown): string | undefined {
  return extractApiError(err).message
}

/**
 * The message to actually show a user.
 *
 * `translate` is passed in rather than importing i18n here so this stays a
 * pure function — the same reason lib/elapsed.ts takes one.
 *
 * `fallback` is the caller's own context-specific line ("Couldn't save the
 * product"), used only when the server said nothing useful at all — which
 * covers the case this function most needs to handle well: a network failure,
 * where there is no response body to read.
 */
export function translateApiError(
  err: unknown,
  translate: (key: string, vars?: Record<string, string>) => string,
  fallback: string
): string {
  const info = extractApiError(err)

  if (info.code !== undefined) {
    const key = `errors.${info.code}`
    const translated = translate(key, info.params)
    // i18next returns the key itself when there's no entry for it.
    if (translated !== key) {
      // Validation failures are the one case where the code alone is too
      // vague to act on — "check the highlighted fields" doesn't say which.
      // Append the field names the server named.
      const fields = Object.keys(info.fieldErrors)
      return fields.length > 0 ? `${translated} (${fields.join(', ')})` : translated
    }
  }

  // No response body at all — almost always the network, not the API.
  if (info.message === undefined && info.code === undefined) {
    return isNetworkError(err) ? translate('errors.NETWORK') : fallback
  }

  return info.message ?? fallback
}

/**
 * Axios reports a failed request with no response as `code: 'ERR_NETWORK'` (or
 * `ECONNABORTED` on timeout). Worth distinguishing: "the shop's wifi dropped"
 * and "the server rejected this" need completely different reactions from the
 * person at the counter.
 */
export function isNetworkError(err: unknown): boolean {
  const record = asRecord(err)
  if (record === undefined) return false
  if ('response' in record && record.response !== undefined) return false
  const code = record.code
  return typeof code === 'string'
}
