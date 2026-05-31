/**
 * Blog content store (multi-language).
 *
 * Each post carries language-specific metadata + a structured `body` made of
 * typed blocks so BlogPost.jsx can render semantic HTML (h2/h3/p/ul) and we
 * can generate clean SEO metadata + BlogPosting JSON-LD per language.
 *
 * Block shapes:
 *   { t: 'p',  x: 'paragraph text' }
 *   { t: 'h2', x: 'Section heading' }
 *   { t: 'h3', x: 'Sub heading' }
 *   { t: 'ul', x: ['item one', 'item two'] }
 */

export const SITE = 'https://safironpay.com'

export const POSTS = [
  {
    slug: 'choosing-hawala-management-software',
    date: '2026-05-20',
    image: `${SITE}/og-blog.jpg`,
    en: {
      category: 'Guides',
      title: 'How to Choose Hawala Management Software',
      description: 'A practical checklist for selecting hawala management software: multi-branch support, currency handling, compliance, and automation.',
      keywords: 'hawala management software, choose hawala software, remittance software, money services software',
      excerpt: 'Picking the right platform shapes your daily operations for years. Here is a practical checklist for evaluating hawala management software.',
      readingTime: '5 min read',
      body: [
        { t: 'p', x: 'Hawala and currency exchange operators increasingly rely on dedicated software to manage transactions, balances, and compliance. The platform you choose shapes your daily workflow for years, so it pays to evaluate options against a clear checklist.' },
        { t: 'h2', x: 'Multi-Branch and Multi-Currency Support' },
        { t: 'p', x: 'If you operate more than one location, branch isolation with a consolidated view is essential. Each branch should manage its own safes and balances while head office monitors a single, consolidated position — ideally in a base currency such as USD.' },
        { t: 'ul', x: ['Per-branch safe and balance tracking', 'Consolidated head-office reporting', 'Support for the currencies you actually trade'] },
        { t: 'h2', x: 'Compliance and Audit Trails' },
        { t: 'p', x: 'Regulators expect a complete, tamper-evident record of every transaction. Look for role-based access control, two-factor authentication, and an audit log that captures who changed what and when.' },
        { t: 'h2', x: 'Automation and Integrations' },
        { t: 'p', x: 'Manual rate entry and spreadsheet reconciliation are slow and error-prone. Modern platforms pull live exchange rates, calculate spreads automatically, and offer integrations such as a Telegram bot for field teams.' },
        { t: 'h2', x: 'Where Safiron Fits' },
        { t: 'p', x: 'Safiron combines multi-branch hawala management, forex and SWIFT handling, AI-powered analysis, and a company-specific Telegram bot in one platform — built specifically for the workflows above.' },
      ],
    },
    tr: {
      category: 'Rehberler',
      title: 'Havale Yönetim Yazılımı Nasıl Seçilir',
      description: 'Havale yönetim yazılımı seçmek için pratik kontrol listesi: çok şubeli destek, para birimi yönetimi, uyum ve otomasyon.',
      keywords: 'havale yönetim yazılımı, havale yazılımı seçimi, para transferi yazılımı, para hizmetleri yazılımı',
      excerpt: 'Doğru platformu seçmek, yıllarca günlük operasyonunuzu şekillendirir. İşte havale yönetim yazılımı değerlendirmek için pratik bir kontrol listesi.',
      readingTime: '5 dk okuma',
      body: [
        { t: 'p', x: 'Havale ve döviz büroları işlemleri, bakiyeleri ve uyumu yönetmek için giderek daha çok özel yazılıma güveniyor. Seçtiğiniz platform yıllarca günlük iş akışınızı şekillendirir; bu yüzden seçenekleri net bir kontrol listesine göre değerlendirmek önemlidir.' },
        { t: 'h2', x: 'Çok Şubeli ve Çok Para Birimli Destek' },
        { t: 'p', x: 'Birden fazla lokasyon işletiyorsanız, konsolide görünümle birlikte şube izolasyonu şarttır. Her şube kendi kasalarını ve bakiyelerini yönetirken merkez tek bir konsolide pozisyonu — ideal olarak USD gibi bir baz para biriminde — izlemelidir.' },
        { t: 'ul', x: ['Şube bazında kasa ve bakiye takibi', 'Konsolide merkez raporlaması', 'Gerçekten işlem yaptığınız para birimlerine destek'] },
        { t: 'h2', x: 'Uyum ve Denetim Kayıtları' },
        { t: 'p', x: 'Düzenleyiciler her işlemin eksiksiz ve değiştirilemez bir kaydını bekler. Rol bazlı yetkilendirme, iki faktörlü doğrulama ve kimin neyi ne zaman değiştirdiğini yakalayan bir denetim kaydı arayın.' },
        { t: 'h2', x: 'Otomasyon ve Entegrasyonlar' },
        { t: 'p', x: 'Manuel kur girişi ve tablo mutabakatı yavaş ve hataya açıktır. Modern platformlar canlı kurları çeker, spread\'leri otomatik hesaplar ve saha ekipleri için Telegram bot gibi entegrasyonlar sunar.' },
        { t: 'h2', x: 'Safiron Buraya Nasıl Uyuyor' },
        { t: 'p', x: 'Safiron; çok şubeli havale yönetimini, döviz ve SWIFT işlemlerini, yapay zeka destekli analizi ve şirkete özel Telegram botunu tek platformda birleştirir — tam da yukarıdaki iş akışları için geliştirilmiştir.' },
      ],
    },
    ar: {
      category: 'أدلة',
      title: 'كيف تختار برنامج إدارة الحوالة',
      description: 'قائمة تحقق عملية لاختيار برنامج إدارة الحوالة: دعم متعدد الفروع، إدارة العملات، الامتثال، والأتمتة.',
      keywords: 'برنامج إدارة الحوالة، اختيار برنامج الحوالة، برنامج تحويل الأموال، برنامج خدمات الأموال',
      excerpt: 'اختيار المنصة المناسبة يشكّل عملياتك اليومية لسنوات. إليك قائمة تحقق عملية لتقييم برامج إدارة الحوالة.',
      readingTime: 'قراءة 5 دقائق',
      body: [
        { t: 'p', x: 'يعتمد مشغّلو الحوالة وصرف العملات بشكل متزايد على برمجيات مخصصة لإدارة المعاملات والأرصدة والامتثال. تشكّل المنصة التي تختارها سير عملك اليومي لسنوات، لذا من المفيد تقييم الخيارات وفق قائمة تحقق واضحة.' },
        { t: 'h2', x: 'دعم متعدد الفروع ومتعدد العملات' },
        { t: 'p', x: 'إذا كنت تدير أكثر من موقع، فإن عزل الفروع مع عرض موحّد أمر أساسي. ينبغي أن يدير كل فرع صناديقه وأرصدته بينما يراقب المركز الرئيسي مركزاً موحّداً واحداً — يفضّل بعملة أساس مثل الدولار.' },
        { t: 'ul', x: ['تتبع الصناديق والأرصدة لكل فرع', 'تقارير موحّدة للمركز الرئيسي', 'دعم العملات التي تتداولها فعلاً'] },
        { t: 'h2', x: 'الامتثال وسجلات التدقيق' },
        { t: 'p', x: 'يتوقع المنظّمون سجلاً كاملاً وغير قابل للتلاعب لكل معاملة. ابحث عن تحكم بالوصول حسب الدور، وتحقق بخطوتين، وسجل تدقيق يلتقط من غيّر ماذا ومتى.' },
        { t: 'h2', x: 'الأتمتة والتكاملات' },
        { t: 'p', x: 'إدخال الأسعار يدوياً ومطابقة الجداول بطيئان وعرضة للأخطاء. تسحب المنصات الحديثة الأسعار الحية وتحسب الهوامش تلقائياً وتوفّر تكاملات مثل بوت تيليغرام للفرق الميدانية.' },
        { t: 'h2', x: 'أين تتناسب Safiron' },
        { t: 'p', x: 'تجمع Safiron إدارة الحوالة متعددة الفروع وعمليات الصرف و SWIFT والتحليل بالذكاء الاصطناعي وبوت تيليغرام خاص بالشركة في منصة واحدة — مصممة خصيصاً لسير العمل أعلاه.' },
      ],
    },
  },
  {
    slug: 'swift-integration-best-practices',
    date: '2026-05-24',
    image: `${SITE}/og-blog.jpg`,
    en: {
      category: 'Payments',
      title: 'SWIFT Integration Best Practices for Money Transfer Platforms',
      description: 'Best practices for SWIFT integration in money transfer platforms: ISO 20022, reconciliation, and multi-currency accounts.',
      keywords: 'SWIFT integration, ISO 20022, money transfer platform, international transfers, payment reconciliation',
      excerpt: 'SWIFT remains the backbone of cross-border transfers. These practices keep your integration reliable, compliant, and easy to reconcile.',
      readingTime: '6 min read',
      body: [
        { t: 'p', x: 'SWIFT remains the backbone of cross-border payments. For platforms handling international transfers, a clean integration is the difference between smooth settlement and costly manual investigation.' },
        { t: 'h2', x: 'Adopt ISO 20022 Early' },
        { t: 'p', x: 'The industry is migrating to ISO 20022, a richer, structured messaging standard. Building around it now avoids painful retrofits and improves data quality for compliance screening.' },
        { t: 'h2', x: 'Reconcile Continuously' },
        { t: 'p', x: 'Match outgoing and incoming messages against your ledger in near real time. Continuous reconciliation surfaces breaks early, before they accumulate into end-of-day surprises.' },
        { t: 'ul', x: ['Track message status end to end', 'Flag unmatched items automatically', 'Keep an immutable audit trail'] },
        { t: 'h2', x: 'Separate Accounts by Currency' },
        { t: 'p', x: 'Multi-currency accounts let you hold and settle in the currency of the transfer, reducing conversion noise and making your position reporting accurate.' },
        { t: 'h2', x: 'How Safiron Handles SWIFT' },
        { t: 'p', x: 'Safiron offers ISO 20022-compliant transfer records, multi-currency accounts per branch, and a single screen to track the status of sent and received transfers.' },
      ],
    },
    tr: {
      category: 'Ödemeler',
      title: 'Para Transferi Platformları için SWIFT Entegrasyonu En İyi Uygulamaları',
      description: 'Para transferi platformlarında SWIFT entegrasyonu için en iyi uygulamalar: ISO 20022, mutabakat ve çok para birimli hesaplar.',
      keywords: 'SWIFT entegrasyonu, ISO 20022, para transferi platformu, uluslararası transferler, ödeme mutabakatı',
      excerpt: 'SWIFT, sınır ötesi transferlerin bel kemiği olmaya devam ediyor. Bu uygulamalar entegrasyonunuzu güvenilir, uyumlu ve kolay mutabık kılar.',
      readingTime: '6 dk okuma',
      body: [
        { t: 'p', x: 'SWIFT, sınır ötesi ödemelerin bel kemiği olmaya devam ediyor. Uluslararası transfer yöneten platformlar için temiz bir entegrasyon, sorunsuz mutabakat ile maliyetli manuel araştırma arasındaki farktır.' },
        { t: 'h2', x: 'ISO 20022\'yi Erken Benimseyin' },
        { t: 'p', x: 'Sektör, daha zengin ve yapılandırılmış bir mesajlaşma standardı olan ISO 20022\'ye geçiyor. Şimdiden bunun etrafında inşa etmek, zahmetli dönüşümleri önler ve uyum taraması için veri kalitesini artırır.' },
        { t: 'h2', x: 'Sürekli Mutabakat Yapın' },
        { t: 'p', x: 'Giden ve gelen mesajları defterinizle neredeyse gerçek zamanlı eşleştirin. Sürekli mutabakat, farkları gün sonu sürprizlerine dönüşmeden erken ortaya çıkarır.' },
        { t: 'ul', x: ['Mesaj durumunu uçtan uca izleyin', 'Eşleşmeyen kalemleri otomatik işaretleyin', 'Değiştirilemez bir denetim kaydı tutun'] },
        { t: 'h2', x: 'Hesapları Para Birimine Göre Ayırın' },
        { t: 'p', x: 'Çok para birimli hesaplar, transferin para biriminde tutmanıza ve mutabakat yapmanıza olanak tanır; dönüşüm gürültüsünü azaltır ve pozisyon raporlamanızı doğru kılar.' },
        { t: 'h2', x: 'Safiron SWIFT\'i Nasıl Yönetir' },
        { t: 'p', x: 'Safiron; ISO 20022 uyumlu transfer kayıtları, şube bazında çok para birimli hesaplar ve gönderilen ile alınan transferlerin durumunu izlemek için tek bir ekran sunar.' },
      ],
    },
    ar: {
      category: 'المدفوعات',
      title: 'أفضل ممارسات تكامل SWIFT لمنصات تحويل الأموال',
      description: 'أفضل الممارسات لتكامل SWIFT في منصات تحويل الأموال: ISO 20022، المطابقة، والحسابات متعددة العملات.',
      keywords: 'تكامل SWIFT، ISO 20022، منصة تحويل الأموال، التحويلات الدولية، مطابقة المدفوعات',
      excerpt: 'تبقى SWIFT العمود الفقري للتحويلات عبر الحدود. تحافظ هذه الممارسات على تكاملك موثوقاً وممتثلاً وسهل المطابقة.',
      readingTime: 'قراءة 6 دقائق',
      body: [
        { t: 'p', x: 'تبقى SWIFT العمود الفقري للمدفوعات عبر الحدود. بالنسبة للمنصات التي تتعامل مع التحويلات الدولية، يمثّل التكامل النظيف الفرق بين التسوية السلسة والتحقيق اليدوي المكلف.' },
        { t: 'h2', x: 'تبنَّ ISO 20022 مبكراً' },
        { t: 'p', x: 'يهاجر القطاع إلى ISO 20022، وهو معيار رسائل أغنى ومنظّم. البناء حوله الآن يتجنّب التعديلات المؤلمة ويحسّن جودة البيانات لفحص الامتثال.' },
        { t: 'h2', x: 'طابِق باستمرار' },
        { t: 'p', x: 'طابق الرسائل الصادرة والواردة مع دفترك في الوقت شبه الفعلي. المطابقة المستمرة تكشف الفروقات مبكراً قبل أن تتراكم إلى مفاجآت نهاية اليوم.' },
        { t: 'ul', x: ['تتبع حالة الرسالة من البداية للنهاية', 'وسم العناصر غير المتطابقة تلقائياً', 'الاحتفاظ بسجل تدقيق غير قابل للتغيير'] },
        { t: 'h2', x: 'افصل الحسابات حسب العملة' },
        { t: 'p', x: 'تتيح لك الحسابات متعددة العملات الاحتفاظ والتسوية بعملة التحويل، مما يقلل ضوضاء التحويل ويجعل تقارير مركزك دقيقة.' },
        { t: 'h2', x: 'كيف تتعامل Safiron مع SWIFT' },
        { t: 'p', x: 'توفّر Safiron سجلات تحويل متوافقة مع ISO 20022، وحسابات متعددة العملات لكل فرع، وشاشة واحدة لتتبع حالة التحويلات المرسلة والمستلمة.' },
      ],
    },
  },
  {
    slug: 'telegram-bot-for-hawala-operations',
    date: '2026-05-28',
    image: `${SITE}/og-blog.jpg`,
    en: {
      category: 'Automation',
      title: 'Telegram Bot for Hawala: How Automation Improves Operations',
      description: 'How a Telegram bot automates hawala operations: instant balance queries, transaction entry, and multilingual field access.',
      keywords: 'telegram bot hawala, hawala automation, money transfer bot, field operations, balance query bot',
      excerpt: 'A company-specific Telegram bot brings the back office to the field — instant balances, transaction entry, and customer registration, securely.',
      readingTime: '4 min read',
      body: [
        { t: 'p', x: 'Branch managers rarely sit in front of a dashboard all day. A Telegram bot brings core operations to where the work happens — on a phone, in the branch, with the customer in front of you.' },
        { t: 'h2', x: 'Instant Balances Without Logging In' },
        { t: 'p', x: 'A quick query returns the current safe position per currency, so staff can answer customers immediately instead of calling head office.' },
        { t: 'h2', x: 'Capture Transactions at the Source' },
        { t: 'p', x: 'Recording a transaction the moment it happens reduces end-of-day reconciliation work and keeps the consolidated position accurate in real time.' },
        { t: 'ul', x: ['Balance and P&L queries', 'New transaction entry', 'Customer registration', 'Live rate lookups'] },
        { t: 'h2', x: 'Secure and Multilingual' },
        { t: 'p', x: 'Access is protected with PIN authentication, and the interface is available in Turkish, Arabic, and English so every operator works in their own language.' },
        { t: 'h2', x: 'Safiron\'s Company-Specific Bot' },
        { t: 'p', x: 'Each Safiron company gets its own bot, wired to the same data as the dashboard — so the field and the back office always agree.' },
      ],
    },
    tr: {
      category: 'Otomasyon',
      title: 'Havale için Telegram Bot: Otomasyon Operasyonu Nasıl İyileştirir',
      description: 'Bir Telegram botunun havale operasyonlarını nasıl otomatikleştirdiği: anlık bakiye sorgusu, işlem girişi ve çok dilli saha erişimi.',
      keywords: 'telegram bot havale, havale otomasyonu, para transferi botu, saha operasyonları, bakiye sorgu botu',
      excerpt: 'Şirkete özel bir Telegram botu, arka ofisi sahaya taşır — anlık bakiye, işlem girişi ve müşteri kaydı, güvenli şekilde.',
      readingTime: '4 dk okuma',
      body: [
        { t: 'p', x: 'Şube yöneticileri nadiren tüm gün bir panelin başında oturur. Bir Telegram botu, çekirdek operasyonları işin gerçekleştiği yere taşır — telefonda, şubede, müşteri karşınızdayken.' },
        { t: 'h2', x: 'Giriş Yapmadan Anlık Bakiye' },
        { t: 'p', x: 'Hızlı bir sorgu, para birimi başına güncel kasa pozisyonunu döndürür; böylece personel merkezi aramak yerine müşterilere hemen yanıt verebilir.' },
        { t: 'h2', x: 'İşlemleri Kaynağında Yakalayın' },
        { t: 'p', x: 'Bir işlemi gerçekleştiği anda kaydetmek, gün sonu mutabakat yükünü azaltır ve konsolide pozisyonu gerçek zamanlı doğru tutar.' },
        { t: 'ul', x: ['Bakiye ve kâr/zarar sorguları', 'Yeni işlem girişi', 'Müşteri kaydı', 'Anlık kur sorgulama'] },
        { t: 'h2', x: 'Güvenli ve Çok Dilli' },
        { t: 'p', x: 'Erişim PIN doğrulamasıyla korunur ve arayüz Türkçe, Arapça ve İngilizce olarak sunulur; böylece her operatör kendi dilinde çalışır.' },
        { t: 'h2', x: 'Safiron\'un Şirkete Özel Botu' },
        { t: 'p', x: 'Her Safiron şirketi, panelle aynı verilere bağlı kendi botunu alır — böylece saha ve arka ofis her zaman uyumludur.' },
      ],
    },
    ar: {
      category: 'الأتمتة',
      title: 'بوت تيليغرام للحوالة: كيف تحسّن الأتمتة العمليات',
      description: 'كيف يؤتمت بوت تيليغرام عمليات الحوالة: استعلام الرصيد الفوري، إدخال المعاملات، والوصول الميداني متعدد اللغات.',
      keywords: 'بوت تيليغرام حوالة، أتمتة الحوالة، بوت تحويل الأموال، العمليات الميدانية، بوت استعلام الرصيد',
      excerpt: 'بوت تيليغرام خاص بالشركة ينقل المكتب الخلفي إلى الميدان — أرصدة فورية، وإدخال معاملات، وتسجيل عملاء، بأمان.',
      readingTime: 'قراءة 4 دقائق',
      body: [
        { t: 'p', x: 'نادراً ما يجلس مديرو الفروع أمام لوحة تحكم طوال اليوم. ينقل بوت تيليغرام العمليات الأساسية إلى حيث يحدث العمل — على الهاتف، في الفرع، والعميل أمامك.' },
        { t: 'h2', x: 'أرصدة فورية دون تسجيل دخول' },
        { t: 'p', x: 'يعيد استعلام سريع مركز الصندوق الحالي لكل عملة، فيتمكن الموظفون من الرد على العملاء فوراً بدلاً من الاتصال بالمركز الرئيسي.' },
        { t: 'h2', x: 'التقط المعاملات عند المصدر' },
        { t: 'p', x: 'تسجيل المعاملة لحظة حدوثها يقلل عمل المطابقة في نهاية اليوم ويبقي المركز الموحّد دقيقاً في الوقت الفعلي.' },
        { t: 'ul', x: ['استعلامات الرصيد والأرباح والخسائر', 'إدخال معاملة جديدة', 'تسجيل العملاء', 'استعلام الأسعار الفوري'] },
        { t: 'h2', x: 'آمن ومتعدد اللغات' },
        { t: 'p', x: 'الوصول محمي بالتحقق برمز PIN، والواجهة متاحة بالعربية والتركية والإنجليزية، فيعمل كل مشغّل بلغته.' },
        { t: 'h2', x: 'بوت Safiron الخاص بكل شركة' },
        { t: 'p', x: 'تحصل كل شركة في Safiron على بوت خاص بها، موصول بنفس بيانات لوحة التحكم — فيتفق الميدان والمكتب الخلفي دائماً.' },
      ],
    },
  },
]

/** All posts for a language, newest first, with slug + shared fields flattened. */
export function getPosts(lang = 'en') {
  const l = ['en', 'tr', 'ar'].includes(lang) ? lang : 'en'
  return [...POSTS]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((p) => ({ slug: p.slug, date: p.date, image: p.image, ...p[l] }))
}

/** Single post for a language, or null if the slug is unknown. */
export function getPost(slug, lang = 'en') {
  const l = ['en', 'tr', 'ar'].includes(lang) ? lang : 'en'
  const p = POSTS.find((post) => post.slug === slug)
  return p ? { slug: p.slug, date: p.date, image: p.image, ...p[l] } : null
}
