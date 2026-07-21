// v3.1 follow-up 10b — "how long has this been like this" formatting.
//
// Shared by the dashboard's stale-order badge and the orders board's
// on-the-way timer, so the two never drift into showing the same duration two
// different ways.
import { Order, OrderStatus } from './types'

export const MS_PER_MINUTE = 60 * 1000
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24

/**
 * When the order *entered* the given status, from its audit trail — not when
 * the order was created. An order raised at 09:00 and dispatched at 14:00 has
 * been out for however long since 14:00, and `createdAt` cannot say that.
 *
 * Returns null if the trail isn't loaded or the status was never reached, so
 * callers can hide the timer rather than showing a wrong number. Reads the
 * LAST matching event: a delivery that came back and went out again should
 * time from the second dispatch.
 */
export function statusEnteredAt(order: Order, status: OrderStatus): Date | null {
  const events = order.statusEvents
  if (events === undefined) return null
  const matching = events.filter((e) => e.status === status)
  const last = matching.at(-1)
  return last === undefined ? null : new Date(last.createdAt)
}

/**
 * Minutes → a human duration. Raw minutes stop being readable past an hour —
 * "out for 312m" is a figure you have to do arithmetic on before it means
 * anything — so this steps up to hours and days.
 *
 * `translate` is passed in rather than importing i18n here, so this stays a
 * pure function and can be unit-tested without a translation runtime.
 */
export function formatElapsed(
  totalMinutes: number,
  translate: (key: string, vars?: Record<string, number>) => string
): string {
  if (totalMinutes < MINUTES_PER_HOUR) {
    return translate('dashboard_page.wait_minutes', { count: totalMinutes })
  }
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  if (hours < HOURS_PER_DAY) {
    const minutes = totalMinutes % MINUTES_PER_HOUR
    return minutes === 0
      ? translate('dashboard_page.wait_hours', { count: hours })
      : translate('dashboard_page.wait_hours_minutes', { hours, minutes })
  }
  return translate('dashboard_page.wait_days', { count: Math.floor(hours / HOURS_PER_DAY) })
}

export function minutesSince(from: Date, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - from.getTime()) / MS_PER_MINUTE))
}
