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
  {
    slug: 'multi-currency-accounting-for-hawala',
    date: '2026-05-30',
    image: `${SITE}/og-blog.jpg`,
    en: {
      category: 'Accounting',
      title: 'Multi-Currency Accounting for Hawala Operators',
      description: 'How multi-currency accounting works for hawala operators: per-currency safes, FX revaluation, and a consolidated base-currency position.',
      keywords: 'multi-currency accounting, hawala accounting, FX revaluation, currency exchange bookkeeping, base currency reporting',
      excerpt: 'Holding several currencies at once makes "how much are we worth today?" a surprisingly hard question. Here is how to answer it cleanly.',
      readingTime: '5 min read',
      body: [
        { t: 'p', x: 'A hawala operator rarely deals in a single currency. Cash, receivables, and obligations sit across several currencies at once, which makes a simple question — "how much are we worth today?" — surprisingly hard to answer.' },
        { t: 'h2', x: 'Track Each Currency Separately' },
        { t: 'p', x: 'Every currency should have its own safe and ledger. Mixing currencies into one balance hides the real exposure and makes reconciliation impossible.' },
        { t: 'h2', x: 'Revalue at Live Rates' },
        { t: 'p', x: 'To express your total position in a base currency such as USD, revalue each currency balance at the current market rate. The difference between cost and market value is your unrealised FX gain or loss.' },
        { t: 'ul', x: ['Per-currency opening and closing balances', 'Daily revaluation against a base currency', 'Separation of realised and unrealised gains'] },
        { t: 'h2', x: 'Report a Consolidated Position' },
        { t: 'p', x: 'Once each balance is revalued, a single consolidated figure tells you the true value of the business at a glance — across every branch and currency.' },
        { t: 'h2', x: 'How Safiron Helps' },
        { t: 'p', x: 'Safiron tracks per-currency safes, applies live exchange rates, and reports a consolidated USD position across all branches automatically.' },
      ],
    },
    tr: {
      category: 'Muhasebe',
      title: 'Havale Operatörleri için Çok Para Birimli Muhasebe',
      description: 'Havale operatörleri için çok para birimli muhasebe nasıl işler: para birimi başına kasalar, kur yeniden değerleme ve konsolide baz para birimi pozisyonu.',
      keywords: 'çok para birimli muhasebe, havale muhasebesi, kur yeniden değerleme, döviz bürosu muhasebesi, baz para birimi raporlama',
      excerpt: 'Aynı anda birkaç para birimi tutmak, "bugün ne kadar değerindeyiz?" sorusunu şaşırtıcı derecede zorlaştırır. İşte bunu temiz biçimde yanıtlamanın yolu.',
      readingTime: '5 dk okuma',
      body: [
        { t: 'p', x: 'Bir havale operatörü nadiren tek para biriminde işlem yapar. Nakit, alacaklar ve yükümlülükler aynı anda birkaç para biriminde durur; bu da basit bir soruyu — "bugün ne kadar değerindeyiz?" — şaşırtıcı derecede zorlaştırır.' },
        { t: 'h2', x: 'Her Para Birimini Ayrı İzleyin' },
        { t: 'p', x: 'Her para biriminin kendi kasası ve defteri olmalıdır. Para birimlerini tek bakiyede karıştırmak gerçek riski gizler ve mutabakatı imkansız kılar.' },
        { t: 'h2', x: 'Canlı Kurlarla Yeniden Değerleyin' },
        { t: 'p', x: 'Toplam pozisyonunuzu USD gibi bir baz para biriminde ifade etmek için her para birimi bakiyesini güncel piyasa kurundan yeniden değerleyin. Maliyet ile piyasa değeri arasındaki fark, gerçekleşmemiş kur kâr/zararınızdır.' },
        { t: 'ul', x: ['Para birimi başına açılış ve kapanış bakiyeleri', 'Baz para birimine karşı günlük yeniden değerleme', 'Gerçekleşen ve gerçekleşmeyen kazançların ayrımı'] },
        { t: 'h2', x: 'Konsolide Pozisyon Raporlayın' },
        { t: 'p', x: 'Her bakiye yeniden değerlendiğinde, tek bir konsolide rakam işletmenin gerçek değerini bir bakışta gösterir — her şube ve para birimi genelinde.' },
        { t: 'h2', x: 'Safiron Nasıl Yardımcı Olur' },
        { t: 'p', x: 'Safiron; para birimi başına kasaları izler, canlı kurları uygular ve tüm şubeler genelinde konsolide USD pozisyonunu otomatik raporlar.' },
      ],
    },
    ar: {
      category: 'المحاسبة',
      title: 'المحاسبة متعددة العملات لمشغّلي الحوالة',
      description: 'كيف تعمل المحاسبة متعددة العملات لمشغّلي الحوالة: صناديق لكل عملة، إعادة تقييم الصرف، ومركز موحّد بعملة الأساس.',
      keywords: 'المحاسبة متعددة العملات، محاسبة الحوالة، إعادة تقييم الصرف، مسك دفاتر صرف العملات، تقارير عملة الأساس',
      excerpt: 'الاحتفاظ بعدة عملات في آن واحد يجعل سؤال "كم تبلغ قيمتنا اليوم؟" صعباً بشكل مفاجئ. إليك كيف تجيب عليه بوضوح.',
      readingTime: 'قراءة 5 دقائق',
      body: [
        { t: 'p', x: 'نادراً ما يتعامل مشغّل الحوالة بعملة واحدة. النقد والذمم والالتزامات تقع عبر عدة عملات في آن واحد، مما يجعل سؤالاً بسيطاً — "كم تبلغ قيمتنا اليوم؟" — صعباً بشكل مفاجئ.' },
        { t: 'h2', x: 'تتبع كل عملة على حدة' },
        { t: 'p', x: 'ينبغي أن يكون لكل عملة صندوقها ودفترها الخاص. خلط العملات في رصيد واحد يخفي التعرّض الحقيقي ويجعل المطابقة مستحيلة.' },
        { t: 'h2', x: 'أعد التقييم بالأسعار الحية' },
        { t: 'p', x: 'للتعبير عن مركزك الإجمالي بعملة أساس مثل الدولار، أعد تقييم رصيد كل عملة بسعر السوق الحالي. الفرق بين التكلفة وقيمة السوق هو ربح أو خسارة الصرف غير المحققة.' },
        { t: 'ul', x: ['أرصدة افتتاحية وختامية لكل عملة', 'إعادة تقييم يومية مقابل عملة الأساس', 'الفصل بين الأرباح المحققة وغير المحققة'] },
        { t: 'h2', x: 'أبلغ عن مركز موحّد' },
        { t: 'p', x: 'بمجرد إعادة تقييم كل رصيد، يخبرك رقم موحّد واحد بالقيمة الحقيقية للأعمال في لمحة — عبر كل فرع وعملة.' },
        { t: 'h2', x: 'كيف تساعد Safiron' },
        { t: 'p', x: 'تتبع Safiron الصناديق لكل عملة، وتطبّق الأسعار الحية، وتُبلغ عن مركز موحّد بالدولار عبر جميع الفروع تلقائياً.' },
      ],
    },
  },
  {
    slug: 'mena-fintech-regulations-2026',
    date: '2026-05-31',
    image: `${SITE}/og-blog.jpg`,
    en: {
      category: 'Compliance',
      title: 'MENA Fintech Regulations in 2026: What Money Operators Should Know',
      description: 'An overview of MENA fintech regulation trends in 2026: licensing, AML/KYC expectations, and record-keeping for hawala and exchange operators.',
      keywords: 'MENA fintech regulations, AML KYC hawala, money services licensing, compliance 2026, currency exchange regulation',
      excerpt: 'Regulators across the MENA region keep raising the bar on AML, KYC, and record-keeping. Here is what money operators should keep in view in 2026.',
      readingTime: '6 min read',
      body: [
        { t: 'p', x: 'Across the MENA region, regulators continue to tighten expectations for money services businesses. While specifics vary by country, the direction of travel is consistent: more transparency, stronger controls, and better records.' },
        { t: 'p', x: 'This article is a general overview, not legal advice. Always confirm requirements with your local regulator and counsel.' },
        { t: 'h2', x: 'Licensing and Registration' },
        { t: 'p', x: 'Operating a money services business increasingly requires a formal license. Authorities want to know who owns the business, where it operates, and how funds move.' },
        { t: 'h2', x: 'AML and KYC Expectations' },
        { t: 'p', x: 'Know-Your-Customer checks and anti-money-laundering monitoring are now baseline. Operators are expected to identify customers, screen for risk, and report suspicious activity.' },
        { t: 'ul', x: ['Customer identification and verification', 'Transaction monitoring and risk scoring', 'Suspicious activity reporting'] },
        { t: 'h2', x: 'Record-Keeping and Auditability' },
        { t: 'p', x: 'A complete, retrievable record of every transaction — who, what, when — is no longer optional. Audit trails protect both the regulator and the operator.' },
        { t: 'h2', x: 'How Software Helps You Stay Compliant' },
        { t: 'p', x: 'A platform like Safiron bakes compliance into daily work: role-based access, two-factor authentication, and an immutable audit log of every transaction across every branch.' },
      ],
    },
    tr: {
      category: 'Uyum',
      title: '2026\'da MENA Fintech Düzenlemeleri: Para Operatörlerinin Bilmesi Gerekenler',
      description: '2026\'da MENA fintech düzenleme eğilimlerine genel bakış: lisanslama, AML/KYC beklentileri ve havale ile döviz operatörleri için kayıt tutma.',
      keywords: 'MENA fintech düzenlemeleri, AML KYC havale, para hizmetleri lisanslama, uyum 2026, döviz bürosu düzenlemesi',
      excerpt: 'MENA bölgesindeki düzenleyiciler AML, KYC ve kayıt tutma çıtasını sürekli yükseltiyor. 2026\'da para operatörlerinin göz önünde bulundurması gerekenler.',
      readingTime: '6 dk okuma',
      body: [
        { t: 'p', x: 'MENA bölgesi genelinde düzenleyiciler para hizmetleri işletmelerine yönelik beklentileri sıkılaştırmaya devam ediyor. Ayrıntılar ülkeye göre değişse de yön tutarlı: daha fazla şeffaflık, daha güçlü kontroller ve daha iyi kayıtlar.' },
        { t: 'p', x: 'Bu yazı genel bir bakıştır, hukuki tavsiye değildir. Gereklilikleri her zaman yerel düzenleyiciniz ve hukuk danışmanınızla teyit edin.' },
        { t: 'h2', x: 'Lisanslama ve Kayıt' },
        { t: 'p', x: 'Bir para hizmetleri işletmesi yürütmek giderek resmi bir lisans gerektiriyor. Otoriteler işletmenin sahibini, nerede faaliyet gösterdiğini ve fonların nasıl hareket ettiğini bilmek ister.' },
        { t: 'h2', x: 'AML ve KYC Beklentileri' },
        { t: 'p', x: 'Müşterini Tanı kontrolleri ve kara para aklamayı önleme izlemesi artık temel gerekliliktir. Operatörlerin müşterileri tanımlaması, risk taraması yapması ve şüpheli faaliyetleri bildirmesi beklenir.' },
        { t: 'ul', x: ['Müşteri tanımlama ve doğrulama', 'İşlem izleme ve risk puanlama', 'Şüpheli faaliyet bildirimi'] },
        { t: 'h2', x: 'Kayıt Tutma ve Denetlenebilirlik' },
        { t: 'p', x: 'Her işlemin eksiksiz ve erişilebilir bir kaydı — kim, ne, ne zaman — artık opsiyonel değil. Denetim kayıtları hem düzenleyiciyi hem operatörü korur.' },
        { t: 'h2', x: 'Yazılım Uyumlu Kalmanıza Nasıl Yardımcı Olur' },
        { t: 'p', x: 'Safiron gibi bir platform uyumu günlük işe gömer: rol bazlı erişim, iki faktörlü doğrulama ve her şubedeki her işlemin değiştirilemez denetim kaydı.' },
      ],
    },
    ar: {
      category: 'الامتثال',
      title: 'تنظيمات التكنولوجيا المالية في MENA لعام 2026: ما ينبغي لمشغّلي الأموال معرفته',
      description: 'نظرة عامة على اتجاهات تنظيم التكنولوجيا المالية في MENA لعام 2026: الترخيص، وتوقعات AML/KYC، وحفظ السجلات لمشغّلي الحوالة والصرافة.',
      keywords: 'تنظيمات التكنولوجيا المالية MENA، AML KYC حوالة، ترخيص خدمات الأموال، الامتثال 2026، تنظيم صرف العملات',
      excerpt: 'يواصل المنظّمون في منطقة MENA رفع سقف متطلبات AML و KYC وحفظ السجلات. إليك ما ينبغي لمشغّلي الأموال مراعاته في 2026.',
      readingTime: 'قراءة 6 دقائق',
      body: [
        { t: 'p', x: 'في أنحاء منطقة MENA، يواصل المنظّمون تشديد التوقعات على شركات خدمات الأموال. ورغم اختلاف التفاصيل بين دولة وأخرى، فإن الاتجاه ثابت: مزيد من الشفافية، وضوابط أقوى، وسجلات أفضل.' },
        { t: 'p', x: 'هذه المقالة نظرة عامة وليست استشارة قانونية. تحقّق دائماً من المتطلبات مع منظّمك المحلي ومستشارك القانوني.' },
        { t: 'h2', x: 'الترخيص والتسجيل' },
        { t: 'p', x: 'يتطلب تشغيل أعمال خدمات الأموال بشكل متزايد ترخيصاً رسمياً. تريد السلطات معرفة من يملك العمل، وأين يعمل، وكيف تتحرك الأموال.' },
        { t: 'h2', x: 'توقعات AML و KYC' },
        { t: 'p', x: 'أصبحت فحوص اعرف عميلك ومراقبة مكافحة غسل الأموال أساساً. يُتوقع من المشغّلين تحديد العملاء، وفحص المخاطر، والإبلاغ عن النشاط المشبوه.' },
        { t: 'ul', x: ['تحديد العميل والتحقق منه', 'مراقبة المعاملات وتقييم المخاطر', 'الإبلاغ عن النشاط المشبوه'] },
        { t: 'h2', x: 'حفظ السجلات وقابلية التدقيق' },
        { t: 'p', x: 'لم يعد السجل الكامل والقابل للاسترجاع لكل معاملة — من، وماذا، ومتى — اختيارياً. تحمي سجلات التدقيق كلاً من المنظّم والمشغّل.' },
        { t: 'h2', x: 'كيف يساعدك البرنامج على البقاء ممتثلاً' },
        { t: 'p', x: 'منصة مثل Safiron تدمج الامتثال في العمل اليومي: وصول حسب الدور، وتحقق بخطوتين، وسجل تدقيق غير قابل للتغيير لكل معاملة في كل فرع.' },
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

/** Up to `n` other posts (newest first) for internal linking from a post. */
export function getRelatedPosts(slug, lang = 'en', n = 2) {
  return getPosts(lang).filter((p) => p.slug !== slug).slice(0, n)
}
