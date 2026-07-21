// v3.1 follow-up 10 — renders a receipt code as a scannable Code 39 barcode.
//
// Deliberately an inline SVG rather than a canvas: it prints at the printer's
// own resolution instead of the screen's, which matters a lot for a barcode —
// a canvas rasterised at 96dpi and scaled up to a 203dpi thermal head produces
// blurry bar edges that scanners reject.
//
// Colours are hardcoded black-on-white, not themed. A barcode is a physical
// artefact read by a laser, not UI: it must stay maximum-contrast even when the
// app is in dark mode and even if it's ever shown on screen.
import { encodeCode39 } from '../lib/barcode'

export default function Barcode({
  value,
  height = 46,
  unit = 1.6,
  className,
}: {
  value: string
  /** Bar height in px. Scanners want ~15% of the barcode's width, min ~10mm. */
  height?: number
  /** Width of one narrow bar in px. Below ~1.2 cheap scanners start failing. */
  unit?: number
  className?: string
}) {
  const geometry = encodeCode39(value)
  // Unencodable input falls back to nothing here; the caller still prints the
  // code as text beside it, so the information is never lost — a human can
  // always type it into the scan-receipt field.
  if (geometry === null) return null

  const width = geometry.totalWidth * unit

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${geometry.totalWidth} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={value}
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width={geometry.totalWidth} height={height} fill="#fff" />
      {geometry.bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y="0" width={bar.width} height={height} fill="#000" />
      ))}
    </svg>
  )
}
