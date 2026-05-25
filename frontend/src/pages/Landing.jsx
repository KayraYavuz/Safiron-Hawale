import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion, useInView, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { authApi } from '../utils/api'
import { useAuthStore } from '../store'
import { useLang } from '../hooks/useLang'
import toast from 'react-hot-toast'

const NAV_H = 68

/* ── Çeviri tablosu ─────────────────────────────────────────────────────── */
const COPY = {
  tr: {
    dir:        'ltr',
    badge:      'Para Hizmetleri Yazılımı',
    heroH1a:    'Para Hizmet Servisleri İçin',
    heroH1b:    'Kurumsal Platform',
    heroSub:    'Havale, döviz alım-satım ve SWIFT işlemlerinizi tek ekranda yönetin. Çok şubeli mimari, gerçek zamanlı pozisyon takibi ve yapay zeka destekli finansal analiz.',
    heroCta:    'Platforma Giriş Yap',
    heroSec:    'Özellikleri İncele',
    txnLabel:   'Desteklenen İşlem Türleri',
    txnTypes:   ['Havale', 'Döviz Alım-Satım', 'SWIFT', 'Yatırma', 'Çekme', 'Virman'],
    statsLabel: ['İşlem Türü', 'Arayüz Dili', 'Anlık Bakiye', 'AI Analiz'],
    statsSub:   ['Havale · Döviz · SWIFT + 3 tür', 'Türkçe · العربية · English', 'USD konsolide pozisyon', 'Groq tabanlı finansal asistan'],
    aboutTag:   'Platform',
    aboutH2a:   'Sektörün ihtiyaçlarından',
    aboutH2b:   'doğan bir çözüm',
    aboutP1:    'Safiron Havale; havale ofisleri ve döviz bürolarının günlük operasyonlarını — çoklu kasa takibi, kur farkı hesaplama, müşteri ekstresi ve şubeler arası virman — tek bir profesyonel arayüzde birleştirir.',
    aboutP2:    'Türkiye, Körfez ülkeleri ve Orta Doğu pazarlarına yönelik çok dilli, çok para birimli mimari ile geliştirilmiştir. Her şirkete özel Telegram botu ile saha ekipleri anlık erişim sağlayabilir.',
    aboutChecks:['Çoklu şube ve lokasyon yönetimi', 'Havale · Döviz · SWIFT işlem türleri', 'Rol bazlı yetkilendirme ve denetim kaydı', 'PDF ve Excel raporlama'],
    featTag:    'Özellikler',
    featH2:     'Operasyonunuzu eksiksiz yönetin',
    featSub:    'Tek platformda muhasebe, raporlama, AI analizi ve entegrasyonlar.',
    features: [
      { title: 'Çok Şubeli Yönetim',     desc: 'Her şirket ve şube tamamen izole çalışır. Tüm lokasyonları konsolide USD bazında tek panelden izleyin.' },
      { title: 'Finansal Raporlama',      desc: 'Gelir tablosu, nakit akışı, lokasyon kâr/zarar ve müşteri ekstresi. PDF ve Excel export dahil.' },
      { title: 'Döviz Kuru Yönetimi',     desc: 'ECB/Frankfurter API ile otomatik kur güncellemesi. Spread hesaplama ve anlık kâr/zarar takibi.' },
      { title: 'Yapay Zeka Asistan',      desc: 'Groq tabanlı finansal chat asistanı. Verilerinizi sorgulayın, trend analizi ve rapor özetleri alın.' },
      { title: 'Güvenlik Altyapısı',      desc: '2FA e-posta doğrulama, rol bazlı yetkilendirme, denetim kaydı ve 30 dakika otomatik oturum kapatma.' },
      { title: 'Telegram Bot',            desc: 'Şirkete özel bot ile bakiye sorgulama, işlem açma ve müşteri kaydı. Türkçe, Arapça, İngilizce.' },
    ],
    howTag:     'Başlangıç',
    howH2:      '4 adımda operasyonel olun',
    howSub:     'Kurulumdan ilk işleme kadar sade ve hızlı.',
    steps: [
      { n: '01', title: 'Şirketi Kurun',         desc: 'Şirket profilinizi oluşturun, şubeler ve kasa hesaplarını tanımlayın.' },
      { n: '02', title: 'Ekibi Ekleyin',          desc: 'Kullanıcıları admin, muhasebe veya görüntüleyici rolüyle sisteme davet edin.' },
      { n: '03', title: 'İşlemleri Kaydedin',     desc: 'Havale, döviz, SWIFT, yatırma ve çekme işlemlerini anlık olarak girin.' },
      { n: '04', title: 'Raporları Takip Edin',   desc: 'Pozisyon, gelir tablosu ve AI destekli analizlere anında ulaşın.' },
    ],
    tgTag:      'Entegrasyon',
    tgH2a:      'Sahadan anlık erişim,',
    tgH2b:      'her şirkete özel bot',
    tgSub:      'Şubenizdeki yöneticiler Telegram üzerinden bakiye sorgulayabilir, işlem açabilir ve müşteri kaydedebilir. PIN ile güvenli bağlantı.',
    tgFeats:    [['Anlık Bakiye', 'Kasa bazında döviz pozisyonu'], ['Kâr/Zarar', 'Günlük ve haftalık PnL'], ['İşlem Oluştur', "Telegram'dan direkt kayıt"], ['Müşteri Ekle', 'Tam kayıt akışı'], ['Kur Sorgula', 'Güncel piyasa kurları'], ['Çok Dilli', 'TR · AR · EN']],
    ctaTag:     'İletişim',
    ctaH2:      'Sistemi inceleyin',
    ctaSub:     'Demo talebi, fiyat bilgisi veya mevcut sisteminizi Safiron\'a taşımak için iletişime geçin.',
    ctaBox:     'Platforma Başlayın',
    ctaBoxH:    'Operasyonunuzu dijitalleştirin',
    ctaBoxP:    'Demo hesabı oluşturmak veya mevcut sisteminizi Safiron\'a taşımak için yazın. Kurulum ve onboarding süreci 1 iş günü içinde tamamlanır.',
    ctaBoxList: ['Çoklu şube ve lokasyon desteği', 'Telegram bot entegrasyonu dahil', 'Türkçe, Arapça ve İngilizce arayüz', 'Tam teknik destek ve onboarding'],
    loginBtn:   'Giriş Yap',
    nav:        ['Platform', '#features', 'Hakkımızda', '#about', 'Nasıl Çalışır', '#how', 'İletişim', '#contact'],
    emailSub:   '1 iş günü içinde yanıt',
    tgSub2:     'Genellikle birkaç saat içinde',
    support:    'Destek Saatleri',
    days:       [['Pazartesi – Cuma', '09:00 – 18:00'], ['Cumartesi', '10:00 – 14:00'], ['Pazar', '—']],
    footerDesc: 'Havale, döviz ve para transferi operasyonları için geliştirilmiş profesyonel para hizmetleri yazılımı.',
    footerCols: [
      { title: 'Platform',  links: [['Özellikler', '#features'], ['Nasıl Çalışır', '#how'], ['Telegram Bot', '#features']] },
      { title: 'Şirket',    links: [['Hakkımızda', '#about'], ['İletişim', '#contact'], ['Gizlilik', '/gizlilik-politikasi']] },
    ],
    rights:     'Tüm hakları saklıdır.',
    privacy:    'Gizlilik Politikası',
    terms:      'Kullanım Şartları',
    position:   'TOPLAM POZİSYON',
    branchLabel:'Son İşlemler',
    online:     '● çevrimiçi',
    trustedBy:  'Entegrasyonlar & Standartlar',
  },
  ar: {
    dir:        'rtl',
    badge:      'برنامج خدمات الأموال',
    heroH1a:    'المنصة الاحترافية',
    heroH1b:    'لخدمات الأموال',
    heroSub:    'أدر عمليات الحوالة وصرف العملات والتحويلات SWIFT في شاشة واحدة. هيكل متعدد الفروع، تتبع المراكز الفورية، وتحليلات مالية بالذكاء الاصطناعي.',
    heroCta:    'الدخول إلى المنصة',
    heroSec:    'استعرض المميزات',
    txnLabel:   'أنواع المعاملات المدعومة',
    txnTypes:   ['حوالة', 'صرف عملات', 'سويفت', 'إيداع', 'سحب', 'تحويل داخلي'],
    statsLabel: ['نوع معاملة', 'لغات الواجهة', 'الرصيد الفوري', 'تحليل ذكي'],
    statsSub:   ['حوالة · صرف عملات · سويفت + 3 أنواع', 'عربي · تركي · إنجليزي', 'مركز موحد بالدولار', 'مساعد مالي بتقنية Groq'],
    aboutTag:   'المنصة',
    aboutH2a:   'حل نابع من احتياجات',
    aboutH2b:   'قطاع خدمات الأموال',
    aboutP1:    'تجمع Safiron العمليات اليومية لمكاتب الحوالة وصرافات العملات — تتبع الصناديق المتعددة، حساب فروق الصرف، كشف حساب العملاء، والتحويلات بين الفروع — في واجهة احترافية واحدة.',
    aboutP2:    'مصممة للأسواق التركية ودول الخليج والشرق الأوسط بهيكل متعدد اللغات ومتعدد العملات. يمكن لفرق الميدان الوصول الفوري عبر بوت Telegram خاص بكل شركة.',
    aboutChecks:['إدارة متعددة الفروع والمواقع', 'أنواع معاملات: حوالة · صرف عملات · سويفت', 'تحكم بالوصول حسب الدور وسجل تدقيق', 'تقارير PDF و Excel'],
    featTag:    'المميزات',
    featH2:     'كل ما تحتاجه لإدارة عملياتك',
    featSub:    'المحاسبة والتقارير وتحليل الذكاء الاصطناعي والتكاملات — كل ذلك في منصة واحدة.',
    features: [
      { title: 'إدارة متعددة الفروع',    desc: 'تعمل كل شركة وفرع بشكل مستقل تماماً. راقب جميع المواقع بمركز موحد بالدولار في لوحة تحكم واحدة.' },
      { title: 'التقارير المالية',         desc: 'قائمة الدخل، التدفق النقدي، الأرباح والخسائر حسب الموقع، وكشف حساب الطرف المقابل. يشمل تصدير PDF و Excel.' },
      { title: 'إدارة أسعار الصرف',       desc: 'تحديث تلقائي للأسعار عبر ECB API. حساب الهامش وتتبع الأرباح والخسائر في الوقت الفعلي.' },
      { title: 'مساعد مالي بالذكاء',       desc: 'مساعد محادثة مالي بتقنية Groq. استعلم عن بياناتك واحصل على تحليل الاتجاهات وملخصات التقارير.' },
      { title: 'البنية الأمنية',           desc: 'تحقق بخطوتين عبر البريد، تحكم بالوصول حسب الدور، سجل تدقيق كامل، وتسجيل خروج تلقائي بعد 30 دقيقة.' },
      { title: 'بوت تيليغرام',             desc: 'بوت خاص بكل شركة للاستعلام عن الأرصدة وإدخال المعاملات وتسجيل العملاء. متاح بالعربية والتركية والإنجليزية.' },
    ],
    howTag:     'البدء',
    howH2:      'ابدأ العمل في 4 خطوات',
    howSub:     'من الإعداد إلى أول معاملة — بسيط وسريع.',
    steps: [
      { n: '01', title: 'أنشئ شركتك',      desc: 'أنشئ ملف الشركة، وحدد الفروع وحسابات الصناديق.' },
      { n: '02', title: 'أضف فريقك',        desc: 'أضف المستخدمين بأدوار المدير أو المحاسبة أو المشاهد.' },
      { n: '03', title: 'سجّل المعاملات',    desc: 'أدخل معاملات الحوالة وصرف العملات والإيداع والسحب فوراً.' },
      { n: '04', title: 'تابع التقارير',     desc: 'اطّلع على تقارير المراكز وقوائم الدخل والتحليلات الذكية فوراً.' },
    ],
    tgTag:      'التكامل',
    tgH2a:      'وصول ميداني فوري،',
    tgH2b:      'بوت خاص لكل شركة',
    tgSub:      'يمكن لمدراء الفروع الاستعلام عن الأرصدة وفتح معاملات وتسجيل عملاء عبر تيليغرام. آمن بالتحقق برمز PIN.',
    tgFeats:    [['الرصيد الفوري', 'موقف العملات لكل صندوق'], ['تقرير ر/خ', 'الأرباح اليومية والأسبوعية'], ['معاملة جديدة', 'إدخال مباشر عبر تيليغرام'], ['إضافة عميل', 'تدفق تسجيل كامل'], ['أسعار الصرف', 'أسعار السوق الفورية'], ['متعدد اللغات', 'عربي · تركي · إنجليزي']],
    ctaTag:     'تواصل معنا',
    ctaH2:      'تواصل معنا',
    ctaSub:     'طلب عرض تجريبي، أو الحصول على معلومات الأسعار، أو نقل نظامك إلى Safiron.',
    ctaBox:     'ابدأ الآن',
    ctaBoxH:    'رقمنة عملياتك',
    ctaBoxP:    'تواصل معنا لإنشاء حساب تجريبي أو نقل نظامك الحالي إلى Safiron. يكتمل الإعداد في غضون يوم عمل واحد.',
    ctaBoxList: ['دعم متعدد الفروع والمواقع', 'تكامل بوت تيليغرام مدرج', 'واجهة بالعربية والتركية والإنجليزية', 'دعم فني كامل وتأهيل'],
    loginBtn:   'تسجيل الدخول',
    nav:        ['المنصة', '#features', 'عن الشركة', '#about', 'كيف يعمل', '#how', 'تواصل', '#contact'],
    emailSub:   'رد خلال يوم عمل واحد',
    tgSub2:     'عادةً في غضون ساعات',
    support:    'ساعات الدعم',
    days:       [['الاثنين – الجمعة', '09:00 – 18:00'], ['السبت', '10:00 – 14:00'], ['الأحد', '—']],
    footerDesc: 'برنامج احترافي لعمليات الحوالة وصرف العملات والتحويلات المالية.',
    footerCols: [
      { title: 'المنصة',  links: [['المميزات', '#features'], ['كيف يعمل', '#how'], ['بوت تيليغرام', '#features']] },
      { title: 'الشركة',  links: [['عن الشركة', '#about'], ['تواصل', '#contact'], ['الخصوصية', '/gizlilik-politikasi']] },
    ],
    rights:     'جميع الحقوق محفوظة.',
    privacy:    'سياسة الخصوصية',
    terms:      'شروط الاستخدام',
    position:   'إجمالي المركز المالي',
    branchLabel:'أحدث المعاملات',
    online:     '● متصل',
    trustedBy:  'التكاملات والمعايير',
  },
  en: {
    dir:        'ltr',
    badge:      'Money Services Software',
    heroH1a:    'The Professional Platform',
    heroH1b:    'for Money Services',
    heroSub:    'Manage your remittance, FX, and SWIFT operations on a single screen. Multi-branch architecture, real-time position tracking, and AI-powered financial analytics.',
    heroCta:    'Sign In to Platform',
    heroSec:    'Explore Features',
    txnLabel:   'Supported Transaction Types',
    txnTypes:   ['Remittance', 'FX (Forex)', 'SWIFT', 'Deposit', 'Withdrawal', 'Internal Transfer'],
    statsLabel: ['Transaction Types', 'Interface Languages', 'Live Balance', 'AI Analytics'],
    statsSub:   ['Remittance · FX · SWIFT + 3 more', 'Turkish · Arabic · English', 'USD consolidated position', 'Groq-powered financial assistant'],
    aboutTag:   'Platform',
    aboutH2a:   'Built from the ground up',
    aboutH2b:   'for money services',
    aboutP1:    'Safiron brings together the daily operations of hawala offices and currency exchange bureaus — multi-safe tracking, FX profit calculation, customer statements, and inter-branch transfers — into a single professional interface.',
    aboutP2:    'Designed for Turkey, Gulf countries, and Middle Eastern markets with a multilingual, multi-currency architecture. Branch teams access real-time data via a company-specific Telegram bot.',
    aboutChecks:['Multi-branch and location management', 'Remittance · FX · SWIFT transaction types', 'Role-based access control and audit log', 'PDF and Excel reporting'],
    featTag:    'Features',
    featH2:     'Everything you need to run your operations',
    featSub:    'Accounting, reporting, AI analysis, and integrations — all in one platform.',
    features: [
      { title: 'Multi-Branch Management',   desc: 'Each company and branch operates in full isolation. Monitor all locations with USD-consolidated position in one dashboard.' },
      { title: 'Financial Reporting',       desc: 'Income statement, cash flow, location P&L, and counterparty statement. Includes PDF and Excel export.' },
      { title: 'Exchange Rate Management',  desc: 'Automatic rate updates via ECB/Frankfurter API. Spread calculation and real-time profit/loss tracking.' },
      { title: 'AI Financial Assistant',    desc: 'Groq-powered chat assistant. Query your data, get trend analysis, and generate report summaries in natural language.' },
      { title: 'Security Infrastructure',   desc: '2FA email verification, role-based access (admin/accounting/viewer), full audit log, and 30-min auto logout.' },
      { title: 'Telegram Bot',              desc: 'Company-specific bot for balance queries, transaction entry, and customer registration. Available in TR, AR, and EN.' },
    ],
    howTag:     'Getting Started',
    howH2:      'Operational in 4 steps',
    howSub:     'From setup to first transaction — simple and fast.',
    steps: [
      { n: '01', title: 'Set Up Your Company',     desc: 'Create your company profile, define branches and safe accounts.' },
      { n: '02', title: 'Invite Your Team',         desc: 'Add users with admin, accounting, or viewer roles.' },
      { n: '03', title: 'Record Transactions',      desc: 'Enter remittance, FX, SWIFT, deposit, and withdrawal transactions in real time.' },
      { n: '04', title: 'Track Reports',            desc: 'Access position reports, income statements, and AI-powered insights instantly.' },
    ],
    tgTag:      'Integration',
    tgH2a:      'Real-time field access,',
    tgH2b:      'one bot per company',
    tgSub:      'Branch managers can query balances, open transactions, and register customers via Telegram. Secured with PIN authentication.',
    tgFeats:    [['Live Balance', 'Per-safe FX position'], ['P&L Report', 'Daily and weekly PnL'], ['New Transaction', 'Direct entry via Telegram'], ['Add Customer', 'Full registration flow'], ['Rate Query', 'Live market rates'], ['Multilingual', 'TR · AR · EN']],
    ctaTag:     'Contact',
    ctaH2:      'Get in touch',
    ctaSub:     'Request a demo, get pricing information, or migrate your existing system to Safiron.',
    ctaBox:     'Get Started',
    ctaBoxH:    'Digitise your operations',
    ctaBoxP:    'Contact us to create a demo account or migrate your existing system to Safiron. Setup and onboarding is completed within 1 business day.',
    ctaBoxList: ['Multi-branch and location support', 'Telegram bot integration included', 'Turkish, Arabic, and English UI', 'Full technical support and onboarding'],
    loginBtn:   'Sign In',
    nav:        ['Platform', '#features', 'About', '#about', 'How It Works', '#how', 'Contact', '#contact'],
    emailSub:   'Response within 1 business day',
    tgSub2:     'Usually within a few hours',
    support:    'Support Hours',
    days:       [['Monday – Friday', '09:00 – 18:00'], ['Saturday', '10:00 – 14:00'], ['Sunday', '—']],
    footerDesc: 'Professional money services software for remittance, FX, and payment transfer operations.',
    footerCols: [
      { title: 'Platform', links: [['Features', '#features'], ['How It Works', '#how'], ['Telegram Bot', '#features']] },
      { title: 'Company',  links: [['About', '#about'], ['Contact', '#contact'], ['Privacy', '/gizlilik-politikasi']] },
    ],
    rights:     'All rights reserved.',
    privacy:    'Privacy Policy',
    terms:      'Terms of Use',
    position:   'TOTAL POSITION',
    branchLabel:'Recent Transactions',
    online:     '● online',
    trustedBy:  'Integrations & Standards',
  },
}

/* ── Animasyon varyantları ───────────────────────────────────────────────── */
// Not: SectionReveal component-level transition kullandığı için burada transition yok
const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
}
const stagger = (delay = 0) => ({
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay } },
})
const slideLeft = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0 },
}
const slideRight = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0 },
}

/* ── AnimatedNumber bileşeni ─────────────────────────────────────────────── */
function AnimatedNumber({ value, suffix = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 80, damping: 20 })
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (inView && typeof value === 'number') {
      motionVal.set(value)
    }
  }, [inView, value, motionVal])

  useEffect(() => {
    return spring.on('change', v => setDisplay(Math.round(v).toString()))
  }, [spring])

  if (typeof value !== 'number') return <span ref={ref}>{value}{suffix}</span>
  return <span ref={ref}>{display}{suffix}</span>
}

/* ── Marquee bileşeni ────────────────────────────────────────────────────── */
function Marquee({ items }) {
  const doubled = [...items, ...items]
  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', gap: 0 }}>
        <motion.div
          animate={{ x: [0, `-${50}%`] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap' }}
        >
          {doubled.map((item, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '0 28px', fontSize: 12, fontWeight: 600,
              color: '#475569', letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#C9A84C', display: 'inline-block' }} />
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

/* ── Giriş Paneli ──────────────────────────────────────────────────────────── */
function LoginPanel({ open, onClose, syncLang }) {
  const [step,    setStep]    = useState('credentials')
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [otp,     setOtp]     = useState('')
  const [session, setSession] = useState('')
  const [hint,    setHint]    = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const { setToken, setUser } = useAuthStore()
  const { lang, setLang, t }  = useLang()
  const navigate  = useNavigate()
  const emailRef  = useRef(null)
  const otpRef    = useRef(null)
  const isRTL     = t.dir === 'rtl'

  useEffect(() => { if (syncLang) setLang(syncLang) }, [syncLang])
  useEffect(() => {
    if (open) setTimeout(() => (step === 'otp' ? otpRef : emailRef).current?.focus(), 350)
  }, [open, step])
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' }, [open])
  useEffect(() => {
    if (!open) { setStep('credentials'); setOtp(''); setSession(''); setHint('') }
  }, [open])

  const submitCredentials = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const { data } = await authApi.login(email, pass)
      if (!data.otp_required) {
        setToken(data.access_token)
        const { data: me } = await authApi.me()
        setUser(me)
        navigate('/companies')
      } else {
        setSession(data.session_token); setHint(data.email_hint); setStep('otp')
        setTimeout(() => otpRef.current?.focus(), 100)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || t.loginError)
    } finally { setLoading(false) }
  }

  const submitOtp = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const { data }     = await authApi.verifyOtp(session, otp)
      setToken(data.access_token)
      const { data: me } = await authApi.me()
      setUser(me)
      navigate(me?.role === 'super_admin' ? '/companies' : '/dashboard')
    } catch {
      toast.error(t.otpInvalid || 'Invalid or expired code.')
      setOtp(''); otpRef.current?.focus()
    } finally { setLoading(false) }
  }

  return (
    <AnimatePresence>
      <>
        <motion.div
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: open ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 900,
            background: 'rgba(2,8,18,0.82)', backdropFilter: 'blur(10px)',
            pointerEvents: open ? 'auto' : 'none',
          }}
        />
        <motion.aside
          dir={isRTL ? 'rtl' : 'ltr'}
          initial={{ x: '100%' }}
          animate={{ x: open ? 0 : '100%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 38 }}
          style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
            background: 'linear-gradient(180deg, #06101E 0%, #040D1C 100%)',
            zIndex: 1000,
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '-32px 0 80px rgba(0,0,0,0.65)',
            display: 'flex', flexDirection: 'column',
            fontFamily: isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : 'inherit',
          }}
        >
          {/* Başlık */}
          <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/emblem.png" alt="Safiron" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.05 }}>Safiron</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.5 }}>Global Solutions</div>
              </div>
            </div>
            <motion.button
              onClick={onClose}
              whileHover={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              whileTap={{ scale: 0.92 }}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                color: '#64748B', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >✕</motion.button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 28px' }}>
            {step === 'credentials' ? (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 6 }}>{t.loginPanelTitle}</h2>
                <p style={{ fontSize: 13.5, color: '#64748B', marginBottom: 28, lineHeight: 1.55 }}>{t.loginPanelSub}</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
                  {[['tr','TR'], ['ar','ع'], ['en','EN']].map(([l, lbl]) => (
                    <motion.button key={l} onClick={() => setLang(l)}
                      whileTap={{ scale: 0.94 }}
                      style={{
                        padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                        fontFamily: 'inherit', fontWeight: l === lang ? 700 : 500,
                        background: l === lang ? '#C9A84C' : 'rgba(255,255,255,0.04)',
                        color: l === lang ? '#0D1F3C' : '#64748B',
                        border: l === lang ? 'none' : '1px solid rgba(255,255,255,0.08)',
                        transition: 'all 0.15s',
                      }}>{lbl}</motion.button>
                  ))}
                </div>
                <form onSubmit={submitCredentials} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#94A3B8', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.email}</label>
                    <input ref={emailRef} type="email" autoComplete="email"
                      value={email} onChange={e => setEmail(e.target.value)} required
                      className="lp-input"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                      onFocus={e => e.target.style.borderColor = '#3B82F6'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#94A3B8', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.password}</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPwd ? 'text' : 'password'} autoComplete="current-password"
                        value={pass} onChange={e => setPass(e.target.value)} required
                        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 44px 11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                        onFocus={e => e.target.style.borderColor = '#3B82F6'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                      />
                      <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 14, padding: 0, fontFamily: 'inherit' }}>
                        {showPwd ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <motion.button type="submit" disabled={loading}
                    whileHover={!loading ? { scale: 1.01, boxShadow: '0 6px 24px rgba(201,168,76,0.45)' } : {}}
                    whileTap={!loading ? { scale: 0.97 } : {}}
                    style={{ marginTop: 4, padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg, #C9A84C, #E8C56B)', color: '#0D1F3C', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {loading ? <><Spinner /> {t.loggingIn}</> : <>{t.loginBtn} →</>}
                  </motion.button>
                </form>
              </>
            ) : (
              <>
                <button onClick={() => setStep('credentials')} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 13, padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>{t.otpBack}</button>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 6 }}>{t.otpTitle}</h2>
                <p style={{ fontSize: 13.5, color: '#64748B', marginBottom: 28, lineHeight: 1.6 }}>
                  {t.otpSentPre && <>{t.otpSentPre} </>}
                  <span style={{ color: '#C9A84C', fontWeight: 600 }}>{hint}</span>
                  {t.otpSentPost && <> {t.otpSentPost}</>}
                </p>
                <form onSubmit={submitOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#94A3B8', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.otpLabel}</label>
                    <input ref={otpRef} type="text" inputMode="numeric" maxLength={6}
                      value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 28, fontWeight: 800, outline: 'none', fontFamily: 'monospace', letterSpacing: '10px', textAlign: 'center', transition: 'border-color 0.15s' }}
                      onFocus={e => e.target.style.borderColor = '#3B82F6'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                  <motion.button type="submit" disabled={loading || otp.length < 6}
                    whileHover={!(loading || otp.length < 6) ? { scale: 1.01 } : {}}
                    whileTap={!(loading || otp.length < 6) ? { scale: 0.97 } : {}}
                    style={{ padding: '13px', borderRadius: 10, border: 'none', cursor: (loading || otp.length < 6) ? 'not-allowed' : 'pointer', background: (loading || otp.length < 6) ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg, #C9A84C, #E8C56B)', color: '#0D1F3C', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {loading ? <><Spinner /> {t.otpVerifying}</> : <>{t.loginBtn} →</>}
                  </motion.button>
                </form>
                <p style={{ fontSize: 12, color: '#475569', textAlign: isRTL ? 'right' : 'center', marginTop: 16, lineHeight: 1.65 }}>
                  {t.otpNoCode}
                </p>
              </>
            )}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '28px 0' }} />
            <p style={{ fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 1.6 }}>
              {t.loginSupport}<br />
              <a href="mailto:info@safironpay.com" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>info@safironpay.com</a>
            </p>
          </div>

          <div style={{ padding: '16px 28px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
            {[['6', t.panelTxn || 'Txn'], ['22+', t.panelCcy || 'CCY'], ['7/24', t.panelBot || 'Bot']].map(([v, l]) => (
              <div key={l} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#C9A84C', lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 10.5, color: '#475569', marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
        </motion.aside>
      </>
    </AnimatePresence>
  )
}

function Spinner() {
  return (
    <svg className="lp-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

/* ── SVG ikonlar ────────────────────────────────────────────────────────────── */
const ICONS = {
  branch:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>,
  report:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  fx:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  ai:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 8v4l3 3"/></svg>,
  security: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  telegram: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>,
  check:    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  arrow:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  login:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>,
}

const FEAT_ICONS  = [ICONS.branch, ICONS.report, ICONS.fx, ICONS.ai, ICONS.security, ICONS.telegram]
const FEAT_COLORS = ['#2B6CB0', '#0EA472', '#D97706', '#7C3AED', '#E53E3E', '#229ED9']
const FEAT_BG     = ['rgba(43,108,176,0.1)', 'rgba(14,164,114,0.1)', 'rgba(217,119,6,0.1)', 'rgba(124,58,237,0.1)', 'rgba(229,62,62,0.1)', 'rgba(34,158,217,0.1)']
const FEAT_GLOW   = ['rgba(43,108,176,0.25)', 'rgba(14,164,114,0.25)', 'rgba(217,119,6,0.25)', 'rgba(124,58,237,0.25)', 'rgba(229,62,62,0.25)', 'rgba(34,158,217,0.25)']

/* ── SectionReveal wrapper ───────────────────────────────────────────────── */
// transition burada tanımlanır; variant içinde olsaydı component-level delay override edilirdi
function SectionReveal({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const variant = direction === 'left' ? slideLeft : direction === 'right' ? slideRight : fadeUp
  return (
    <motion.div ref={ref} variants={variant} initial="hidden" animate={inView ? 'visible' : 'hidden'}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }} className={className}>
      {children}
    </motion.div>
  )
}

/* ── Ana Sayfa ──────────────────────────────────────────────────────────────── */
export default function Landing() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [scrolled,  setScrolled]  = useState(false)
  const [uiLang,    setUiLang]    = useState('tr')
  const c = COPY[uiLang]
  const isRTL = c.dir === 'rtl'

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const TICKER_ITEMS = ['SWIFT', 'ECB API', 'Frankfurter API', 'Groq AI', 'Telegram Bot', 'PDF Export', 'Excel Export', '2FA Auth', 'Multi-Branch', 'Real-Time FX']

  return (
    <div dir={c.dir} style={{ fontFamily: isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'DM Sans', -apple-system, 'Segoe UI', sans-serif", color: '#0F172A', lineHeight: 1, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..900;1,9..40,300..900&display=swap');
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        @keyframes lp-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.6; transform:scale(1.4); } }
        @keyframes lp-float { 0%,100% { transform:translateY(0px); } 50% { transform:translateY(-10px); } }
        @keyframes lp-glow  { 0%,100% { box-shadow:0 0 8px rgba(34,197,94,0.6); } 50% { box-shadow:0 0 18px rgba(34,197,94,1); } }
        @keyframes lp-shimmer { 0% { background-position:200% center; } 100% { background-position:-200% center; } }
        .lp-spin    { animation: lp-spin 0.85s linear infinite; }
        .lp-pulse   { animation: lp-pulse 2s ease-in-out infinite; }
        .lp-float   { animation: lp-float 4s ease-in-out infinite; }
        .lp-glow    { animation: lp-glow 2.5s ease-in-out infinite; }
        .lp-grad-text {
          background: linear-gradient(90deg, #C9A84C 0%, #F5D98C 45%, #C9A84C 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: lp-shimmer 3.5s linear infinite;
        }
        .lp-feat-card {
          transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s, border-color 0.25s;
          cursor: default;
        }
        .lp-feat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 40px rgba(13,31,60,0.11), 0 0 0 1.5px rgba(43,108,176,0.18);
          border-color: #CBD5E1 !important;
        }
        .lp-metric-card {
          transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s;
          cursor: default;
        }
        .lp-metric-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 32px rgba(13,31,60,0.11);
        }
        .lp-nav-link {
          color: #64748B; text-decoration: none;
          transition: color 0.15s;
          font-weight: 500;
        }
        .lp-nav-link:hover { color: #0D1F3C; }
        .lp-contact-link {
          display: flex; align-items: center; gap: 16;
          padding: 20px 22px; border-radius: 14px;
          text-decoration: none; transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .lp-contact-link:hover { transform: translateY(-2px); }
        .lp-footer-link {
          display: block; font-size: 13.5px; text-decoration: none;
          margin-bottom: 10px; transition: color 0.15s;
          color: #374151;
        }
        .lp-footer-link:hover { color: #94A3B8; }
        .lp-social-btn {
          width:34px;height:34px;border-radius:9px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
          display:flex;align-items:center;justify-content:center;
          font-size:14px;text-decoration:none;color:#64748B;
          transition:all 0.15s;
        }
        .lp-social-btn:hover { background:rgba(255,255,255,0.12); color:#CBD5E1; }
        .lp-nav-btn {
          transition: background 0.18s, transform 0.18s, box-shadow 0.18s;
        }
        .lp-nav-btn:hover {
          background: #1A3152 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(13,31,60,0.3) !important;
        }
        .lp-hero-cta {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .lp-hero-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(201,168,76,0.48) !important;
        }
        .lp-hero-ghost {
          transition: background 0.2s;
        }
        .lp-hero-ghost:hover { background: rgba(255,255,255,0.1) !important; }
        .lp-step-circle {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .lp-step-circle:hover {
          transform: scale(1.08);
        }
        .lp-cta-box-btn {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .lp-cta-box-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(201,168,76,0.42) !important;
        }
        @media (max-width: 900px) {
          .lp-hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .lp-about-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .lp-feat-grid  { grid-template-columns: 1fr 1fr !important; }
          .lp-tg-grid    { grid-template-columns: 1fr !important; gap: 48px !important; }
          .lp-contact-grid { grid-template-columns: 1fr !important; }
          .lp-footer-grid  { grid-template-columns: 1fr 1fr !important; }
          .lp-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .lp-hero-right { display: none !important; }
          .lp-nav-links  { display: none !important; }
          .lp-steps-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 600px) {
          .lp-feat-grid  { grid-template-columns: 1fr !important; }
          .lp-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .lp-steps-grid { grid-template-columns: 1fr !important; }
          .lp-metric-grid { grid-template-columns: 1fr !important; }
          .lp-panel aside { width: 100vw !important; }
        }
      `}</style>

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} syncLang={uiLang} />

      {/* ══ NAVBAR ════════════════════════════════════════════════════════════ */}
      <motion.nav
        initial={{ y: -NAV_H, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: NAV_H, zIndex: 800,
          background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: scrolled ? '1px solid #E2E8F0' : '1px solid transparent',
          boxShadow: scrolled ? '0 1px 24px rgba(0,0,0,0.07)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 max(5%, 32px)', transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
        }}
      >
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none' }}>
          <img src="/emblem.png" alt="Safiron" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0D1F3C', letterSpacing: '-0.5px', lineHeight: 1.05 }}>Safiron</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.4 }}>Global Solutions</div>
          </div>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13.5 }}>
          <div className="lp-nav-links" style={{ display: 'flex', gap: 28 }}>
            {[[c.nav[0], c.nav[1]], [c.nav[2], c.nav[3]], [c.nav[4], c.nav[5]], [c.nav[6], c.nav[7]]].map(([l, h]) => (
              <a key={l} href={h} className="lp-nav-link">{l}</a>
            ))}
          </div>

          {/* Dil toggle */}
          <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            {[['tr','TR'],['ar','ع'],['en','EN']].map(([l, lbl]) => (
              <button key={l} onClick={() => setUiLang(l)} style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: uiLang === l ? '#0D1F3C' : 'transparent',
                color: uiLang === l ? '#fff' : '#94A3B8',
                transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>{lbl}</button>
            ))}
          </div>

          <button onClick={() => setLoginOpen(true)} className="lp-nav-btn" style={{
            padding: '9px 20px', borderRadius: 9,
            background: '#0D1F3C', color: '#fff',
            fontWeight: 600, fontSize: 13.5, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: 'inherit',
            boxShadow: '0 2px 10px rgba(13,31,60,0.2)',
          }}>
            {ICONS.login} {c.loginBtn}
          </button>
        </div>
      </motion.nav>

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(155deg, #050C1A 0%, #0B1C37 50%, #0F2346 100%)',
        display: 'flex', alignItems: 'center',
        padding: `${NAV_H + 72}px max(5%, 32px) 88px`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Arka plan efektleri */}
        <div style={{ position: 'absolute', top: '10%', left: '0', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,108,176,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '0', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 60%)', pointerEvents: 'none' }} />
        {/* Izgara deseni */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />
        {/* Hareketli nokta ızgarası */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none', opacity: 0.6 }} />

        <div className="lp-hero-grid" style={{ maxWidth: 1160, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', position: 'relative' }}>
          {/* Sol — Metin */}
          <div>
            <motion.div variants={stagger(0)} initial="hidden" animate="visible" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32,
              padding: '6px 16px', borderRadius: 100,
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)',
              fontSize: 12, fontWeight: 700, color: '#E8C56B', letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              <span className="lp-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              {c.badge}
            </motion.div>

            <motion.h1 variants={stagger(0.1)} initial="hidden" animate="visible" style={{ fontSize: 'clamp(36px, 4.5vw, 62px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.8px', lineHeight: 1.06, marginBottom: 24 }}>
              {c.heroH1a}<br />
              <span className="lp-grad-text">{c.heroH1b}</span>
            </motion.h1>

            <motion.p variants={stagger(0.2)} initial="hidden" animate="visible" style={{ fontSize: 16.5, color: '#8899AA', lineHeight: 1.8, marginBottom: 40, maxWidth: 470 }}>
              {c.heroSub}
            </motion.p>

            <motion.div variants={stagger(0.3)} initial="hidden" animate="visible" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 52 }}>
              <button onClick={() => setLoginOpen(true)} className="lp-hero-cta" style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                background: 'linear-gradient(135deg, #C9A84C, #E8C56B)',
                color: '#0D1F3C', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(201,168,76,0.35)',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {c.heroCta} {ICONS.arrow}
              </button>
              <a href="#features" className="lp-hero-ghost" style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', color: '#CBD5E1',
                border: '1px solid rgba(255,255,255,0.12)',
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', fontFamily: 'inherit',
              }}>
                {c.heroSec}
              </a>
            </motion.div>

            <motion.div variants={stagger(0.4)} initial="hidden" animate="visible">
              <p style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{c.txnLabel}</p>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {c.txnTypes.map((item, i) => (
                  <motion.span key={item}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.06, duration: 0.3 }}
                    style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#8899AA', fontSize: 12, fontWeight: 500 }}
                  >{item}</motion.span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sağ — Dashboard önizleme */}
          <motion.div
            className="lp-hero-right"
            initial={{ opacity: 0, x: 40, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'relative' }}
          >
            {/* Live badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              style={{
                position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 100, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 12, fontWeight: 700, color: '#22C55E', zIndex: 2, whiteSpace: 'nowrap',
              }}
            >
              <span className="lp-glow" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              Live Dashboard
            </motion.div>

            <motion.div
              className="lp-float"
              style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, boxShadow: '0 40px 100px rgba(0,0,0,0.55)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <p style={{ fontSize: 10.5, color: '#475569', fontWeight: 700, marginBottom: 5, letterSpacing: '0.07em' }}>{c.position}</p>
                  <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-1.2px', lineHeight: 1 }}>$392,844</p>
                </div>
                <span style={{ padding: '5px 11px', borderRadius: 20, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 12, fontWeight: 700, color: '#22C55E' }}>▲ +2.4%</span>
              </div>
              {[
                { city: 'İstanbul', flag: '🇹🇷', usd: '$284,500', pnl: '+$1,240' },
                { city: 'Dubai',    flag: '🇦🇪', usd: '$95,000',  pnl: '+$760' },
                { city: 'Riyad',    flag: '🇸🇦', usd: '$13,344',  pnl: '+$88' },
              ].map((loc, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>{loc.flag} {loc.city}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{loc.usd}</div>
                    <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>{loc.pnl}</div>
                  </div>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' }} />
              <p style={{ fontSize: 10.5, color: '#475569', fontWeight: 700, marginBottom: 12, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{c.branchLabel}</p>
              {[
                { type: uiLang === 'tr' ? 'Havale' : uiLang === 'ar' ? 'حوالة' : 'Remittance', party: 'Al-Rashidi', amount: '+$8,200', color: '#22C55E' },
                { type: uiLang === 'tr' ? 'Döviz Al/Sat' : uiLang === 'ar' ? 'صرف عملات' : 'FX Trade', party: 'Hassan Bey', amount: '-$5,400', color: '#F59E0B' },
                { type: 'SWIFT', party: 'GCC Trading', amount: '+$12,000', color: '#60A5FA' },
              ].map((tx, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tx.color }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>{tx.type}</div>
                      <div style={{ fontSize: 11, color: '#475569' }}>{tx.party}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: tx.color }}>{tx.amount}</span>
                </div>
              ))}
            </motion.div>

            {/* AI chat balonu */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.0, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', bottom: -18, right: -16, background: '#0D1B2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', minWidth: 196, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 2 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span className="lp-glow" style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Safiron AI</span>
              </div>
              <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.65, margin: 0 }}>
                {uiLang === 'ar' ? (
                  <>ارتفع ربح الصرف <span style={{ color: '#22C55E', fontWeight: 700 }}>18%</span> هذا الشهر.<br />
                  <span style={{ color: '#E2E8F0' }}>التحليل التفصيلي جاهز ←</span></>
                ) : uiLang === 'en' ? (
                  <>FX profit up <span style={{ color: '#22C55E', fontWeight: 700 }}>18%</span> this month.<br />
                  <span style={{ color: '#E2E8F0' }}>Detailed analysis ready →</span></>
                ) : (
                  <>Bu ay FX kârı <span style={{ color: '#22C55E', fontWeight: 700 }}>%18</span> arttı.<br />
                  <span style={{ color: '#E2E8F0' }}>Detaylı analiz hazır →</span></>
                )}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══ MARQUEE / TİCKER ════════════════════════════════════════════════════ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #EDF2F7', padding: '16px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flexShrink: 0, padding: '0 20px 0 max(5%,32px)', fontSize: 10.5, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRight: '1px solid #EDF2F7', marginRight: 0 }}>
            {c.trustedBy}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Marquee items={TICKER_ITEMS} />
          </div>
        </div>
      </div>

      {/* ══ STATS ═════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#fff', borderBottom: '1px solid #EDF2F7' }}>
        <div className="lp-stats-grid" style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '0 max(5%, 32px)' }}>
          {[
            { val: 6,      suffix: '',    i: 0 },
            { val: 3,      suffix: '',    i: 1 },
            { val: 'Live', suffix: '',    i: 2 },
            { val: 'AI',   suffix: '',    i: 3 },
          ].map(({ val, suffix, i }) => (
            <SectionReveal key={i} delay={i * 0.08}>
              <div style={{ padding: '36px 20px', textAlign: 'center', borderRight: i < 3 ? '1px solid #EDF2F7' : 'none' }}>
                <div style={{ fontSize: 34, fontWeight: 900, color: '#0D1F3C', letterSpacing: '-1.5px', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
                  <AnimatedNumber value={val} suffix={suffix} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0D1F3C', marginBottom: 5 }}>{c.statsLabel[i]}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.55 }}>{c.statsSub[i]}</div>
              </div>
            </SectionReveal>
          ))}
        </div>
      </section>

      {/* ══ HAKKIMIZDA ════════════════════════════════════════════════════════ */}
      <section id="about" style={{ padding: '100px max(5%, 32px)', background: '#F8FAFD' }}>
        <div className="lp-about-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 88, alignItems: 'center' }}>
          <SectionReveal direction="left">
            <SectionTag color="#2B6CB0">{c.aboutTag}</SectionTag>
            <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 900, color: '#0D1F3C', letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 20 }}>
              {c.aboutH2a}<br />
              <span style={{ color: '#2B6CB0' }}>{c.aboutH2b}</span>
            </h2>
            <p style={{ fontSize: 15.5, color: '#64748B', lineHeight: 1.85, marginBottom: 16 }}>{c.aboutP1}</p>
            <p style={{ fontSize: 15.5, color: '#64748B', lineHeight: 1.85, marginBottom: 32 }}>{c.aboutP2}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {c.aboutChecks.map((item, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.09, duration: 0.4 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(43,108,176,0.1)', border: '1.5px solid rgba(43,108,176,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#2B6CB0' }}>
                    {ICONS.check}
                  </div>
                  <span style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{item}</span>
                </motion.div>
              ))}
            </div>
          </SectionReveal>

          {/* Sağ — metrik kartlar */}
          <SectionReveal direction="right">
            <div className="lp-metric-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { icon: ICONS.branch,   color: '#2B6CB0', rgb: '43,108,176',  title: uiLang === 'tr' ? 'Çok Şubeli' : uiLang === 'ar' ? 'متعدد الفروع' : 'Multi-Branch', desc: uiLang === 'tr' ? 'Tüm lokasyonlar tek panelde' : uiLang === 'ar' ? 'جميع المواقع في لوحة واحدة' : 'All locations in one panel' },
                { icon: ICONS.fx,       color: '#D97706', rgb: '217,119,6',   title: uiLang === 'tr' ? 'Döviz & FX' : uiLang === 'ar' ? 'صرف العملات' : 'FX & Forex', desc: uiLang === 'tr' ? 'Kur farkı ve spread analizi' : uiLang === 'ar' ? 'حساب الهامش وفرق الصرف' : 'Spread and FX profit analysis' },
                { icon: ICONS.security, color: '#E53E3E', rgb: '229,62,62',   title: uiLang === 'tr' ? 'Kurumsal Güvenlik' : uiLang === 'ar' ? 'أمان المؤسسة' : 'Enterprise Security', desc: uiLang === 'tr' ? '2FA ve denetim kaydı' : uiLang === 'ar' ? '2FA وسجل التدقيق' : '2FA and audit trail' },
                { icon: ICONS.ai,       color: '#7C3AED', rgb: '124,58,237',  title: uiLang === 'tr' ? 'AI Asistan' : uiLang === 'ar' ? 'مساعد ذكي' : 'AI Assistant', desc: uiLang === 'tr' ? 'Finansal trend analizi' : uiLang === 'ar' ? 'تحليل الاتجاهات المالية' : 'Financial trend analysis' },
              ].map((mc, i) => (
                <motion.div key={i}
                  className="lp-metric-card"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.45 }}
                  style={{ padding: '22px 20px', borderRadius: 14, background: '#fff', border: '1px solid #EDF2F7' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: `rgba(${mc.rgb},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: mc.color, marginBottom: 14 }}>
                    {mc.icon}
                  </div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0D1F3C', marginBottom: 5 }}>{mc.title}</h4>
                  <p style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.6 }}>{mc.desc}</p>
                </motion.div>
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ══ ÖZELLİKLER ═══════════════════════════════════════════════════════ */}
      <section id="features" style={{ padding: '100px max(5%, 32px)', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionReveal>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <SectionTag color="#2B6CB0">{c.featTag}</SectionTag>
              <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 900, color: '#0D1F3C', letterSpacing: '-1px', marginBottom: 16 }}>{c.featH2}</h2>
              <p style={{ fontSize: 16, color: '#64748B', maxWidth: 480, margin: '0 auto', lineHeight: 1.72 }}>{c.featSub}</p>
            </div>
          </SectionReveal>

          <div className="lp-feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {c.features.map((f, i) => (
              <motion.div key={i}
                className="lp-feat-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ boxShadow: `0 0 0 2px ${FEAT_GLOW[i]}, 0 16px 40px rgba(13,31,60,0.1)` }}
                style={{ padding: '28px 26px', borderRadius: 16, border: '1px solid #EDF2F7', background: '#FAFBFD' }}
              >
                <div style={{ width: 46, height: 46, borderRadius: 12, background: FEAT_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', color: FEAT_COLORS[i], marginBottom: 18 }}>
                  {FEAT_ICONS[i]}
                </div>
                <h3 style={{ fontSize: 15.5, fontWeight: 800, color: '#0D1F3C', marginBottom: 10, letterSpacing: '-0.2px' }}>{f.title}</h3>
                <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.72 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ NASIL ÇALIŞIR ═════════════════════════════════════════════════════ */}
      <section id="how" style={{ padding: '100px max(5%, 32px)', background: '#F8FAFD' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <SectionReveal>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <SectionTag color="#0EA472">{c.howTag}</SectionTag>
              <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 900, color: '#0D1F3C', letterSpacing: '-1px', marginBottom: 16 }}>{c.howH2}</h2>
              <p style={{ fontSize: 16, color: '#64748B', maxWidth: 400, margin: '0 auto', lineHeight: 1.72 }}>{c.howSub}</p>
            </div>
          </SectionReveal>

          <div style={{ position: 'relative' }}>
            {/* Bağlantı çizgisi */}
            <div style={{ position: 'absolute', top: 30, left: '12.5%', right: '12.5%', height: 2, zIndex: 0, overflow: 'hidden', borderRadius: 2, background: '#EDF2F7' }}>
              <motion.div
                initial={{ scaleX: 0, originX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #2B6CB0, #0EA472)', transformOrigin: 'left' }}
              />
            </div>
            <div className="lp-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, position: 'relative', zIndex: 1 }}>
              {c.steps.map((s, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ textAlign: 'center' }}
                >
                  <motion.div
                    className="lp-step-circle"
                    whileHover={{ boxShadow: '0 0 0 8px rgba(43,108,176,0.12), 0 6px 20px rgba(43,108,176,0.22)' }}
                    style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 20px', background: '#fff', border: '2px solid #2B6CB0', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 6px #F8FAFD, 0 4px 16px rgba(43,108,176,0.15)' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#2B6CB0', fontVariantNumeric: 'tabular-nums' }}>{s.n}</span>
                  </motion.div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0D1F3C', marginBottom: 8, lineHeight: 1.35 }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.68 }}>{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ TELEGRAM ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: '100px max(5%, 32px)', background: 'linear-gradient(155deg, #070F1F 0%, #050D1A 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '5%', right: '2%', width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,108,176,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '2%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,158,217,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div className="lp-tg-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', position: 'relative' }}>
          <SectionReveal direction="left">
            <SectionTag color="#229ED9" dark>{c.tgTag}</SectionTag>
            <h2 style={{ fontSize: 'clamp(26px, 3.2vw, 40px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1.2, marginBottom: 20 }}>
              {c.tgH2a}<br /><span style={{ color: '#229ED9' }}>{c.tgH2b}</span>
            </h2>
            <p style={{ fontSize: 15.5, color: '#64748B', lineHeight: 1.82, marginBottom: 32 }}>{c.tgSub}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {c.tgFeats.map(([title, desc], i) => (
                <motion.div key={title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.38 }}
                  style={{ display: 'flex', gap: 11, padding: '12px 14px', borderRadius: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#229ED9', flexShrink: 0, marginTop: 6 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E2E8F0', marginBottom: 2 }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: '#475569' }}>{desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </SectionReveal>

          {/* Telegram önizleme */}
          <SectionReveal direction="right">
            <div style={{ background: '#17212B', borderRadius: 20, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ background: '#232E3C', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #229ED9, #1279A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  {ICONS.telegram}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Safiron Bot</div>
                  <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>{c.online}</div>
                </div>
              </div>
              <div style={{ padding: '16px 14px', minHeight: 310 }}>
                <TgMsg bot>{uiLang === 'tr' ? "👋 Safiron Bot'a hoş geldiniz. Aşağıdan işlem seçin." : uiLang === 'ar' ? '👋 مرحباً بك في بوت Safiron. اختر إجراءً أدناه.' : '👋 Welcome to Safiron Bot. Please choose an action below.'}</TgMsg>
                <TgMsg user>{uiLang === 'tr' ? '💰 Bakiye' : uiLang === 'ar' ? '💰 الرصيد' : '💰 Balance'}</TgMsg>
                <TgMsg bot mono>
                  {uiLang === 'tr' ? (
                    <>💰 <strong>Kasa Bakiyeleri</strong><br />
                      <span style={{ color: '#C9A84C' }}>📍 İstanbul</span><br />
                      &nbsp;USD: 284,500 ≈ $284,500<br />
                      <span style={{ color: '#C9A84C' }}>📍 Dubai</span><br />
                      &nbsp;AED: 95,000 ≈ $25,000<br /><br />
                      💵 <strong>Toplam: $309,500</strong></>
                  ) : uiLang === 'ar' ? (
                    <>💰 <strong>أرصدة الصناديق</strong><br />
                      <span style={{ color: '#C9A84C' }}>📍 إسطنبول</span><br />
                      &nbsp;USD: 284,500 ≈ $284,500<br />
                      <span style={{ color: '#C9A84C' }}>📍 دبي</span><br />
                      &nbsp;AED: 95,000 ≈ $25,000<br /><br />
                      💵 <strong>الإجمالي: $309,500</strong></>
                  ) : (
                    <>💰 <strong>Safe Balances</strong><br />
                      <span style={{ color: '#C9A84C' }}>📍 Istanbul</span><br />
                      &nbsp;USD: 284,500 ≈ $284,500<br />
                      <span style={{ color: '#C9A84C' }}>📍 Dubai</span><br />
                      &nbsp;AED: 95,000 ≈ $25,000<br /><br />
                      💵 <strong>Total: $309,500</strong></>
                  )}
                </TgMsg>
              </div>
              <div style={{ background: '#232E3C', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {(uiLang === 'tr'
                  ? ['💰 Bakiye', '📊 Rapor', '📈 Kurlar', '➕ Yeni İşlem']
                  : uiLang === 'ar'
                  ? ['💰 الرصيد', '📊 تقرير', '📈 الأسعار', '➕ معاملة جديدة']
                  : ['💰 Balance', '📊 Report', '📈 Rates', '➕ New Txn']
                ).map(b => (
                  <div key={b} style={{ padding: '8px', borderRadius: 8, textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#8899AA', fontSize: 12, fontWeight: 600 }}>{b}</div>
                ))}
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ══ İLETİŞİM ══════════════════════════════════════════════════════════ */}
      <section id="contact" style={{ padding: '100px max(5%, 32px)', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <SectionReveal>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <SectionTag color="#2B6CB0">{c.ctaTag}</SectionTag>
              <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 900, color: '#0D1F3C', letterSpacing: '-1px', marginBottom: 16 }}>{c.ctaH2}</h2>
              <p style={{ fontSize: 16, color: '#64748B', maxWidth: 460, margin: '0 auto', lineHeight: 1.72 }}>{c.ctaSub}</p>
            </div>
          </SectionReveal>

          <div className="lp-contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, alignItems: 'start' }}>
            <SectionReveal direction="left" delay={0.1}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { icon: '✉', lbl: uiLang === 'tr' ? 'E-posta' : 'Email', val: 'info@safironpay.com', sub: c.emailSub, href: 'mailto:info@safironpay.com', border: '#DBEAFE', bg: '#EFF6FF', hc: '#2B6CB0' },
                  { icon: '✈', lbl: 'Telegram', val: '@safiron_support', sub: c.tgSub2, href: 'https://t.me/safiron_support', border: '#BAE6FD', bg: '#F0F9FF', hc: '#0284C7' },
                ].map(ct => (
                  <motion.a key={ct.lbl} href={ct.href}
                    whileHover={{ y: -2, boxShadow: `0 4px 20px ${ct.hc}22`, borderColor: ct.hc }}
                    className="lp-contact-link"
                    style={{ border: `1.5px solid ${ct.border}`, background: ct.bg }}
                  >
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: '#fff', border: `1px solid ${ct.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', color: ct.hc, fontStyle: 'normal' }}>{ct.icon}</div>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 700, marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{ct.lbl}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0D1F3C', marginBottom: 2 }}>{ct.val}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>{ct.sub}</div>
                    </div>
                  </motion.a>
                ))}
                <div style={{ padding: '18px 22px', borderRadius: 14, border: '1px solid #EDF2F7', background: '#F8FAFD' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1F3C', marginBottom: 10 }}>{c.support}</p>
                  {c.days.map(([d, h], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748B', padding: '6px 0', borderBottom: i < 2 ? '1px solid #EDF2F7' : 'none' }}>
                      <span>{d}</span><span style={{ fontWeight: 600, color: '#0D1F3C' }}>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionReveal>

            <SectionReveal direction="right" delay={0.15}>
              <div style={{ background: 'linear-gradient(155deg, #0C1D38 0%, #07101F 100%)', borderRadius: 20, padding: 34, boxShadow: '0 16px 48px rgba(13,31,60,0.22)' }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>{c.ctaBox}</p>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.25, marginBottom: 14 }}>{c.ctaBoxH}</h3>
                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8, marginBottom: 24 }}>{c.ctaBoxP}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {c.ctaBoxList.map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#CBD5E1' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(34,197,94,0.14)', border: '1.5px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#22C55E' }}>
                        {ICONS.check}
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <motion.button
                  onClick={() => setLoginOpen(true)}
                  whileHover={{ y: -1, boxShadow: '0 8px 28px rgba(201,168,76,0.44)' }}
                  whileTap={{ scale: 0.97 }}
                  style={{ width: '100%', padding: '13px', borderRadius: 10, fontSize: 14.5, fontWeight: 800, background: 'linear-gradient(135deg, #C9A84C, #E8C56B)', color: '#0D1F3C', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {c.loginBtn} {ICONS.arrow}
                </motion.button>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer style={{ background: '#060D1B', padding: '56px max(5%, 32px) 28px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="lp-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
                <img src="/emblem.png" alt="Safiron" style={{ width: 44, height: 44, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1.05 }}>Safiron</div>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.5 }}>Global Solutions</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.78, maxWidth: 280 }}>{c.footerDesc}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                {[{ icon: '✉', href: 'mailto:info@safironpay.com', title: 'Email' }, { icon: '✈', href: 'https://t.me/safiron_support', title: 'Telegram' }].map(s => (
                  <a key={s.title} href={s.href} title={s.title} className="lp-social-btn">{s.icon}</a>
                ))}
              </div>
            </div>
            {c.footerCols.map(col => (
              <div key={col.title}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 16 }}>{col.title}</p>
                {col.links.map(([l, h]) => (
                  <a key={l} href={h} className="lp-footer-link">{l}</a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 24 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 12.5, color: '#374151' }}>© {new Date().getFullYear()} Safiron Global Solutions. {c.rights}</p>
            <div style={{ display: 'flex', gap: 20, fontSize: 12.5 }}>
              <a href="/gizlilik-politikasi" className="lp-footer-link" style={{ marginBottom: 0 }}>{c.privacy}</a>
              <a href="/kullanim-sartlari" className="lp-footer-link" style={{ marginBottom: 0 }}>{c.terms}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── Yardımcı bileşenler ────────────────────────────────────────────────────── */
function SectionTag({ children, color = '#2B6CB0', dark = false }) {
  const rgb = color === '#229ED9' ? '34,158,217' : color === '#0EA472' ? '14,164,114' : '43,108,176'
  return (
    <div style={{
      display: 'inline-block', padding: '4px 14px', borderRadius: 100, marginBottom: 18,
      background: `rgba(${rgb},${dark ? '0.12' : '0.08'})`,
      border: `1px solid rgba(${rgb},0.22)`,
      fontSize: 11.5, fontWeight: 700, color, letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>{children}</div>
  )
}

function TgMsg({ children, bot, user, mono }) {
  return (
    <div style={{ marginBottom: 12, textAlign: user ? 'right' : 'left' }}>
      <div style={{
        background: user ? '#2B5278' : '#182533',
        borderRadius: user ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
        padding: '10px 14px', display: 'inline-block',
        maxWidth: '85%', fontSize: mono ? 12 : 13,
        color: '#CBD5E1', lineHeight: 1.65,
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {children}
      </div>
    </div>
  )
}
