// v3.1 follow-up 10 — the printed receipt, driven by ShopSettings.
//
// Everything about its shape now comes from /settings rather than being fixed:
// paper width/height, font scale, custom header/footer text, an optional logo,
// and per-field toggles for the shop's own details and the order's metadata.
//
// Printing notes:
//   - width/height are set in millimetres on the container, so the browser's
//     print engine maps them to real paper rather than to CSS pixels scaled by
//     whatever zoom the screen happens to be at.
//   - `--receipt-scale` multiplies every font-size below rather than each one
//     being computed in JS, so the whole thing scales as a unit.
//   - the receipt is forced black-on-white by the @media print block in
//     globals.css, so none of this needs theme-aware colours.
//   - the barcode encodes the receipt code so an on-the-way delivery can be
//     confirmed by scanning the returned slip (POST /:id/scan-receipt) instead
//     of typing 8 characters by hand.
import { Order, ShopSettings } from '../lib/types'
import Barcode from './Barcode'

const MM = 'mm'
const DEFAULT_WIDTH_MM = 80
const DEFAULT_SCALE = 1

export default function Receipt({
  order,
  settings,
  cashierName,
  labels,
}: {
  order: Order
  /** Null while settings are still loading — the receipt falls back to sane
      defaults rather than blocking the print, since a cashier waiting on a
      settings fetch to hand over a slip is a worse failure than a plain one. */
  settings: ShopSettings | null
  cashierName?: string | null
  labels: {
    receiptTitle: string
    walkIn: string
    total: string
    receiptCode: string
    kg: string
    customer: string
    phone: string
    address: string
  }
}) {
  const widthMm = settings?.receiptWidthMm ?? DEFAULT_WIDTH_MM
  const heightMm = settings?.receiptHeightMm ?? null
  const scale = settings === null ? DEFAULT_SCALE : Number(settings.receiptFontScale)
  const show = {
    shopName: settings?.receiptShowShopName ?? true,
    phone: settings?.receiptShowPhone ?? false,
    address: settings?.receiptShowAddress ?? false,
    orderNo: settings?.receiptShowOrderNo ?? true,
    code: settings?.receiptShowCode ?? true,
    cashier: settings?.receiptShowCashier ?? false,
    dateTime: settings?.receiptShowDateTime ?? true,
    items: settings?.receiptShowItems ?? true,
    customer: settings?.receiptShowCustomer ?? true,
    customerAddress: settings?.receiptShowAddressOfCustomer ?? false,
  }

  // Per-order values win over the linked Customer record: a one-off delivery
  // address for this order is more correct than the customer's usual one.
  const nonEmpty = (v: string | null | undefined): string | null =>
    v === null || v === undefined || v === '' ? null : v
  const customerPhone = nonEmpty(order.customerRecord?.phone)
  const customerAddress = nonEmpty(order.deliveryAddress) ?? nonEmpty(order.customerRecord?.address)

  return (
    <div
      className="receipt-print-area receipt mx-auto bg-surface text-stone-900"
      style={{
        // `--receipt-scale` is consumed by the .receipt rules in globals.css.
        ['--receipt-scale' as string]: String(Number.isFinite(scale) ? scale : DEFAULT_SCALE),
        width: `${widthMm}${MM}`,
        maxWidth: '100%',
        ...(heightMm === null ? {} : { minHeight: `${heightMm}${MM}` }),
      }}
    >
      <div className="receipt-body">
        {settings?.receiptLogoUrl !== null && settings?.receiptLogoUrl !== undefined && settings.receiptLogoUrl !== '' && (
          // Plain <img>, not next/image: this is a user-supplied URL of unknown
          // origin and next/image would need it whitelisted in next.config.js,
          // which would mean a redeploy every time the logo moves.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.receiptLogoUrl} alt="" className="receipt-logo" />
        )}

        {show.shopName && <p className="receipt-shop">{settings?.shopName ?? labels.receiptTitle}</p>}
        {show.phone && settings?.shopPhone !== null && settings?.shopPhone !== undefined && settings.shopPhone !== '' && (
          <p className="receipt-meta tabular">{settings.shopPhone}</p>
        )}
        {show.address && settings?.shopAddress !== null && settings?.shopAddress !== undefined && settings.shopAddress !== '' && (
          <p className="receipt-meta">{settings.shopAddress}</p>
        )}

        {settings?.receiptHeaderText !== null && settings?.receiptHeaderText !== undefined && settings.receiptHeaderText !== '' && (
          <p className="receipt-free">{settings.receiptHeaderText}</p>
        )}

        <hr className="receipt-rule" />

        {show.orderNo && order.dailyNumber !== null && (
          <p className="receipt-meta tabular">#{order.dailyNumber}</p>
        )}
        {/* Labelled, so a bare line of Arabic text isn't ambiguous between the
            customer's name, the shop's address and a note. The label comes from
            the caller's `labels`, i.e. from i18n, so it follows the UI language.
            Phone and address fall back to the linked Customer record when the
            order itself doesn't carry them (a walk-in linked to a real customer
            has no per-order deliveryAddress). */}
        {show.customer && (
          <p className="receipt-meta">
            <span className="receipt-label">{labels.customer}:</span>{' '}
            {order.customer !== null && order.customer !== ''
              ? order.customer
              : order.customerRecord?.name ?? labels.walkIn}
          </p>
        )}
        {show.customer && customerPhone !== null && (
          <p className="receipt-meta">
            <span className="receipt-label">{labels.phone}:</span>{' '}
            <span className="tabular">{customerPhone}</span>
          </p>
        )}
        {show.customerAddress && customerAddress !== null && (
          <p className="receipt-meta">
            <span className="receipt-label">{labels.address}:</span> {customerAddress}
          </p>
        )}
        {show.dateTime && (
          <p className="receipt-meta tabular">{new Date(order.createdAt).toLocaleString()}</p>
        )}
        {show.cashier && cashierName !== null && cashierName !== undefined && cashierName !== '' && (
          <p className="receipt-meta">{cashierName}</p>
        )}

        <hr className="receipt-rule" />

        {show.items && (
        <table className="receipt-items">
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="receipt-item-name">{item.product?.name ?? ''}</td>
                <td className="receipt-item-kg tabular">{Number(item.kg).toFixed(3)} {labels.kg}</td>
                <td className="receipt-item-price tabular">{Number(item.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}

        <hr className="receipt-rule" />

        <p className="receipt-total">
          <span>{labels.total}</span>
          <span className="tabular">{Number(order.totalAmount).toFixed(2)}</span>
        </p>

        {show.code && order.receiptCode !== null && order.receiptCode !== '' && (
          <div className="receipt-code">
            <Barcode value={order.receiptCode} />
            {/* The human-readable code stays printed under the bars: it's the
                fallback when a scanner won't read a smudged thermal print, and
                the scan-receipt field accepts it typed. */}
            <p className="receipt-code-text tabular">
              {labels.receiptCode}: {order.receiptCode}
            </p>
          </div>
        )}

        {settings?.receiptFooterText !== null && settings?.receiptFooterText !== undefined && settings.receiptFooterText !== '' && (
          <p className="receipt-free">{settings.receiptFooterText}</p>
        )}
      </div>
    </div>
  )
}
