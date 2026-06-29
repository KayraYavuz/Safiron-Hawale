/**
 * ReceiptModal — yazdırılabilir müşteri işlem makbuzu.
 *
 * Makbuz, izole stil için bir iframe (srcDoc) içinde render edilir; "Yazdır"
 * yalnızca iframe içeriğini yazdırır (sayfanın geri kalanını değil). Tüm veri
 * mevcut transaction nesnesinden gelir — ek backend çağrısı yok.
 */
import { useRef } from 'react'
import { Modal, Btn, C } from './UI'
import { fmt } from '../utils/format'
import { useLang } from '../hooks/useLang'
import { useAuthStore } from '../store'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

function buildHtml(txn, companyName, t, lang) {
  const outs = (txn.legs || []).filter(l => l.leg_type === 'out')
  const ins  = (txn.legs || []).filter(l => l.leg_type === 'in')
  const dir  = lang === 'ar' ? 'rtl' : 'ltr'
  const cp   = txn.counterparty?.name || '—'
  const row = (label, value) =>
    `<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(value)}</td></tr>`
  const legLine = (l, sign, color) =>
    `<div class="amt" style="color:${color}">${sign}${esc(fmt(l.amount))} ${esc(l.account?.currency?.code || '')}</div>`

  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0D1B2E; margin:0; padding:24px; }
    .r { max-width: 360px; margin:0 auto; }
    .head { text-align:center; border-bottom:2px solid #0D1B2E; padding-bottom:12px; margin-bottom:14px; }
    .co { font-size:18px; font-weight:700; letter-spacing:-0.01em; }
    .ttl { font-size:12px; color:#5b6b80; margin-top:2px; text-transform:uppercase; letter-spacing:0.08em; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    td { padding:5px 0; vertical-align:top; }
    .lbl { color:#5b6b80; }
    .val { text-align:${lang === 'ar' ? 'left' : 'right'}; font-weight:600; }
    .amts { display:flex; justify-content:space-between; gap:12px; margin:14px 0; padding:12px; background:#f5f7fa; border-radius:8px; }
    .amts > div { flex:1; }
    .cap { font-size:10px; color:#5b6b80; text-transform:uppercase; letter-spacing:0.05em; }
    .amt { font-family:ui-monospace,Menlo,monospace; font-weight:700; font-size:15px; margin-top:2px; }
    .foot { text-align:center; font-size:11px; color:#5b6b80; margin-top:16px; border-top:1px solid #e2e8f0; padding-top:10px; }
    .num { font-family:ui-monospace,Menlo,monospace; }
  </style></head><body><div class="r">
    <div class="head">
      <div class="co">${esc(companyName || 'Safiron')}</div>
      <div class="ttl">${esc(t.receiptTitle)}</div>
    </div>
    <table>
      ${row(t.txnNo, txn.txn_number)}
      ${row(t.date, txn.txn_date)}
      ${row(t.counterparty, cp)}
      ${row(t.status, txn.status)}
    </table>
    <div class="amts">
      <div><div class="cap">${esc(t.receiptGiven)}</div>${outs.map(l => legLine(l, '−', '#c0392b')).join('') || '<div class="amt">—</div>'}</div>
      <div style="text-align:${lang === 'ar' ? 'left' : 'right'}"><div class="cap">${esc(t.receiptReceived)}</div>${ins.map(l => legLine(l, '+', '#1e7a52')).join('') || '<div class="amt">—</div>'}</div>
    </div>
    <div class="foot">
      ${esc(t.receiptThanks)}<br>
      <span class="num">${esc(new Date().toLocaleString())}</span>
    </div>
  </div></body></html>`
}

export default function ReceiptModal({ txn, onClose }) {
  const { t, lang } = useLang()
  const { user } = useAuthStore()
  const iframeRef = useRef(null)
  const html = buildHtml(txn, user?.company_name, t, lang)

  const handlePrint = () => {
    const w = iframeRef.current?.contentWindow
    if (w) { w.focus(); w.print() }
  }

  return (
    <Modal
      title={`${t.receipt} — ${txn.txn_number}`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>{t.cancel}</Btn>
          <Btn onClick={handlePrint}>{t.print}</Btn>
        </div>
      }
    >
      <iframe
        ref={iframeRef}
        title="receipt"
        srcDoc={html}
        style={{ width: '100%', height: 420, border: 'none', background: C.surface3 ?? '#f5f7fa' }}
      />
    </Modal>
  )
}
