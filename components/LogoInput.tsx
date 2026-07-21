'use client'

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { safeImageUrl } from '../lib/safeImageUrl'

// v3.1 follow-up 10e — logo picker.
//
// Answers "where do I get a logo URL from?": you don't need one. Pick a file
// and this encodes it into the settings row as a `data:` URL, so the shop
// needs no image hosting, no S3 bucket, no CDN. Pasting an `https://` URL
// still works for anyone who does have somewhere to host it.
//
// The file never leaves the browser un-shrunk: it's drawn to a canvas scaled
// to MAX_EDGE and re-encoded as PNG before it becomes a string. A 4 MB phone
// photo lands around 30-60 KB, which is what makes storing it in a text
// column reasonable rather than a hack.

// 512px is well beyond what either consumer needs (the rail draws it at 28px,
// a thermal printer at ~200 dots) but leaves headroom for a hi-DPI screen and
// keeps the encode cheap.
const MAX_EDGE = 512
const BYTES_PER_KB = 1024
// The column accepts 256 KB of string. Refusing at 200 KB of encoded output
// leaves margin and, more usefully, catches the case where downscaling didn't
// help (a photo with no flat regions) here rather than at save time.
const MAX_ENCODED_KB = 200
// Raw-file ceiling, checked before the browser is asked to decode anything.
// Downscaling makes almost any photo fit, so this isn't about the end result —
// it's about not handing a 50 MB TIFF to canvas and freezing the tab.
const MAX_SOURCE_MB = 10
// Below this, upscaling to the rail's 34px (let alone a receipt's print width)
// would be visibly mushy. Better to say so than to render a blurry mark.
const MIN_EDGE = 32
const BYTES_PER_MB = 1024 * 1024
const EMPTY = ''
const NO_SCALE_UP = 1

function isTooLarge(dataUrl: string): boolean {
  return dataUrl.length / BYTES_PER_KB > MAX_ENCODED_KB
}

// Reasons a file is rejected, checked in the order that gives the most useful
// message: type first (a PDF isn't a near-miss), then raw size (cheap, avoids
// a hostile decode), then dimensions (needs the decode). Returns a
// translation key so the copy stays with the rest of the strings.
function sourceProblem(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'settings_page.logo.not_an_image'
  if (file.size / BYTES_PER_MB > MAX_SOURCE_MB) return 'settings_page.logo.file_too_large'
  return null
}

function isUploaded(value: string | null): boolean {
  return value !== null && value.startsWith('data:')
}

// Draw-to-canvas rather than reading the file's bytes straight through: the
// browser decodes whatever format it can display (png/jpg/webp/svg/gif) and we
// re-encode one predictable format out the other side, so neither the rail nor
// the receipt has to care what the shop happened to upload.
async function fileToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => { resolve(el) }
      el.onerror = () => { reject(new Error('decode-failed')) }
      el.src = objectUrl
    })

    if (Math.max(img.width, img.height) < MIN_EDGE) throw new Error('too-small')

    const scale = Math.min(NO_SCALE_UP, MAX_EDGE / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)

    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('no-canvas')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function LogoInput({
  value,
  onChange,
  label,
  hint,
}: {
  value: string | null
  onChange: (value: string | null) => void
  label: string
  hint?: string
}) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (file === undefined) return
    setError(null)

    const problem = sourceProblem(file)
    if (problem !== null) {
      setError(t(problem, { mb: MAX_SOURCE_MB }))
      if (fileRef.current !== null) fileRef.current.value = EMPTY
      return
    }

    setBusy(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      if (isTooLarge(dataUrl)) {
        setError(t('settings_page.logo.too_large', { kb: MAX_ENCODED_KB }))
        return
      }
      onChange(dataUrl)
    } catch (err) {
      setError(err instanceof Error && err.message === 'too-small'
        ? t('settings_page.logo.too_small', { px: MIN_EDGE })
        : t('settings_page.logo.unreadable'))
    } finally {
      setBusy(false)
      // Reset the input so re-picking the same file still fires `change`.
      if (fileRef.current !== null) fileRef.current.value = EMPTY
    }
  }

  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold text-stone-600">{label}</span>

      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
          {value === null || value === EMPTY
            ? <span className="text-[10px] text-stone-400">{t('settings_page.logo.none')}</span>
            /* eslint-disable-next-line @next/next/no-img-element -- next/image
               can't serve a `data:` URL without a custom loader, and this is a
               fixed 64px preview, so its optimisation buys nothing here. */
            : <img src={safeImageUrl(value) ?? ''} alt="" className="max-h-full max-w-full object-contain" />}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
              onClick={() => fileRef.current?.click()}>
              {busy ? t('settings_page.logo.working') : t('settings_page.logo.upload')}
            </button>
            {value !== null && value !== EMPTY && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onChange(null) }}>
                {t('settings_page.logo.remove')}
              </button>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { void pick(e.target.files?.[0]) }} />

          {/* The URL box stays: a shop that already hosts its logo shouldn't be
              pushed through the uploader, and it's how you'd paste a value
              someone sent you. Hidden behind a placeholder once a file is
              uploaded, since showing 60 KB of base64 in a text input helps
              nobody. */}
          <input
            value={isUploaded(value) ? EMPTY : value ?? EMPTY}
            placeholder={isUploaded(value)
              ? t('settings_page.logo.uploaded_placeholder')
              : 'https://…'}
            onChange={e => { onChange(e.target.value === EMPTY ? null : e.target.value) }}
          />

          {hint !== undefined && <p className="text-xs text-stone-400">{hint}</p>}
          <p className="text-xs text-stone-400">
            {t('settings_page.logo.limits', { mb: MAX_SOURCE_MB, px: MIN_EDGE })}
          </p>
          {error !== null && <p className="text-xs text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  )
}
