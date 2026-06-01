import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import api from '../utils/api'

const NAVY = '#0D1F3C'
const GOLD = '#C9A84C'

const T = {
  tr: {
    dir: 'ltr', title: 'Demo Talep Edin', sub: 'Size en uygun zamanı seçin; ekibimiz e-posta ile teyit eder.',
    name: 'Ad Soyad', email: 'E-posta', company: 'Şirket (opsiyonel)', phone: 'Telefon (opsiyonel)',
    date: 'Tercih edilen gün', time: 'Saat', message: 'Mesaj (opsiyonel)',
    submit: 'Randevu Talebi Gönder', sending: 'Gönderiliyor…',
    okTitle: 'Talebiniz alındı!', okBody: 'Ekibimiz seçtiğiniz zamanı e-posta ile teyit edecek. Teşekkürler.',
    close: 'Kapat', errName: 'Lütfen adınızı girin.', errEmail: 'Geçerli bir e-posta girin.',
    errDate: 'Bir gün ve saat seçin.', errSend: 'Gönderilemedi. Lütfen sales@safironpay.com adresine yazın.',
    pick: 'Seçin', locale: 'tr-TR',
  },
  ar: {
    dir: 'rtl', title: 'احجز عرضاً تجريبياً', sub: 'اختر الوقت الأنسب لك؛ سيؤكّد فريقنا عبر البريد الإلكتروني.',
    name: 'الاسم الكامل', email: 'البريد الإلكتروني', company: 'الشركة (اختياري)', phone: 'الهاتف (اختياري)',
    date: 'اليوم المفضل', time: 'الوقت', message: 'رسالة (اختياري)',
    submit: 'إرسال طلب الموعد', sending: 'جارٍ الإرسال…',
    okTitle: 'تم استلام طلبك!', okBody: 'سيؤكّد فريقنا الوقت الذي اخترته عبر البريد الإلكتروني. شكراً لك.',
    close: 'إغلاق', errName: 'يرجى إدخال اسمك.', errEmail: 'أدخل بريداً إلكترونياً صحيحاً.',
    errDate: 'اختر يوماً ووقتاً.', errSend: 'تعذّر الإرسال. يرجى مراسلة sales@safironpay.com.',
    pick: 'اختر', locale: 'ar',
  },
  en: {
    dir: 'ltr', title: 'Book a Demo', sub: 'Pick a time that suits you; our team confirms by email.',
    name: 'Full name', email: 'Email', company: 'Company (optional)', phone: 'Phone (optional)',
    date: 'Preferred day', time: 'Time', message: 'Message (optional)',
    submit: 'Send Booking Request', sending: 'Sending…',
    okTitle: 'Request received!', okBody: 'Our team will confirm your chosen time by email. Thank you.',
    close: 'Close', errName: 'Please enter your name.', errEmail: 'Enter a valid email.',
    errDate: 'Pick a day and time.', errSend: 'Could not send. Please email sales@safironpay.com.',
    pick: 'Select', locale: 'en-US',
  },
}

const TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']

/** Next 14 weekdays as { value: 'YYYY-MM-DD', label: localized } */
function useWeekdays(locale) {
  return useMemo(() => {
    const out = []
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    while (out.length < 14) {
      d.setDate(d.getDate() + 1)
      const day = d.getDay()
      if (day === 0 || day === 6) continue // skip weekends
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const label = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
      out.push({ value, label })
    }
    return out
  }, [locale])
}

export default function BookDemoModal({ open, onClose, lang = 'en' }) {
  const t = T[lang] || T.en
  const isRTL = t.dir === 'rtl'
  const days = useWeekdays(t.locale)

  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', date: '', time: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' }, [open])
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])
  useEffect(() => {
    if (!open) { setDone(false); setLoading(false); setForm({ name: '', email: '', company: '', phone: '', date: '', time: '', message: '' }) }
  }, [open])

  if (!open) return null

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.name.trim().length < 2) return toast.error(t.errName)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error(t.errEmail)
    if (!form.date || !form.time) return toast.error(t.errDate)
    setLoading(true)
    try {
      await api.post('/api/public/demo-request', {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        phone: form.phone.trim(),
        preferred_at: `${form.date} ${form.time}`,
        message: form.message.trim(),
        lang,
      })
      setDone(true)
    } catch {
      toast.error(t.errSend)
    } finally {
      setLoading(false)
    }
  }

  const field = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10, background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: NAVY, fontSize: 14, outline: 'none', fontFamily: 'inherit' }
  const label = { fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6, display: 'block' }

  return (
    <div
      onClick={onClose}
      dir={t.dir}
      style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(2,8,18,0.82)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 32px 80px rgba(0,0,0,0.5)', fontFamily: isRTL ? "'Segoe UI', Tahoma, sans-serif" : "'DM Sans', system-ui, sans-serif" }}
      >
        {/* header */}
        <div style={{ padding: '22px 26px', borderBottom: '1px solid #EEF2F6', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900, color: NAVY, letterSpacing: '-0.4px' }}>{t.title}</div>
            {!done && <div style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 1.5 }}>{t.sub}</div>}
          </div>
          <button onClick={onClose} aria-label={t.close} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#94A3B8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {done ? (
          <div style={{ padding: '36px 26px', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 8 }}>{t.okTitle}</div>
            <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, maxWidth: 320, margin: '0 auto 22px' }}>{t.okBody}</div>
            <button onClick={onClose} style={{ padding: '11px 28px', borderRadius: 10, border: 'none', cursor: 'pointer', background: NAVY, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>{t.close}</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: '20px 26px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>{t.name}</label>
              <input style={field} value={form.name} onChange={set('name')} autoFocus />
            </div>
            <div>
              <label style={label}>{t.email}</label>
              <input style={field} type="email" value={form.email} onChange={set('email')} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>{t.company}</label>
                <input style={field} value={form.company} onChange={set('company')} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>{t.phone}</label>
                <input style={field} value={form.phone} onChange={set('phone')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1.6 }}>
                <label style={label}>{t.date}</label>
                <select style={field} value={form.date} onChange={set('date')}>
                  <option value="">{t.pick}…</option>
                  {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>{t.time}</label>
                <select style={field} value={form.time} onChange={set('time')}>
                  <option value="">{t.pick}…</option>
                  {TIMES.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={label}>{t.message}</label>
              <textarea style={{ ...field, minHeight: 64, resize: 'vertical' }} value={form.message} onChange={set('message')} />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: 4, padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(201,168,76,0.5)' : `linear-gradient(135deg, ${GOLD}, #E8C56B)`, color: NAVY, fontSize: 15, fontWeight: 800, fontFamily: 'inherit' }}
            >
              {loading ? t.sending : t.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
