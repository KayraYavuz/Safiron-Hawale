import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const LAST_UPDATED = '25 Mayıs 2026'

export default function GizlilikPolitikasi() {
  const navigate = useNavigate()
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div style={{ background: '#070E1C', minHeight: '100vh', color: '#CBD5E1', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(7,14,28,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 max(5%,28px)', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={() => navigate('/')} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <img src="/emblem.png" alt="Safiron" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1 }}>Safiron</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Havale</div>
          </div>
        </button>
        <button onClick={() => navigate(-1)} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#94A3B8', borderRadius: 8, padding: '7px 16px',
          fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>← Geri</button>
      </nav>

      {/* İçerik */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px max(5%,28px) 80px' }}>
        {/* Başlık */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: 'inline-block', background: 'rgba(201,168,76,0.12)',
            border: '1px solid rgba(201,168,76,0.25)', borderRadius: 6,
            padding: '4px 12px', fontSize: 11.5, fontWeight: 700,
            color: '#C9A84C', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16,
          }}>Yasal</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>
            Gizlilik Politikası
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            Son güncelleme: {LAST_UPDATED}
          </p>
        </div>

        <Section title="1. Veri Sorumlusu">
          <p>Bu Gizlilik Politikası, <strong>Safiron Global Solutions</strong> ("Şirket", "biz") tarafından işletilen <strong>safironpay.com</strong> alan adlı web sitesi ve bu site üzerinden sunulan Safiron Havale platformu için geçerlidir.</p>
          <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu Safiron Global Solutions'dır.</p>
          <p>İletişim: <a href="mailto:info@safironpay.com" style={{ color: '#C9A84C' }}>info@safironpay.com</a></p>
        </Section>

        <Section title="2. Topladığımız Veriler">
          <p>Platform kullanımınız sırasında aşağıdaki kişisel veriler işlenebilmektedir:</p>
          <ul>
            <li><strong>Kimlik Bilgileri:</strong> Ad, soyad, e-posta adresi</li>
            <li><strong>İletişim Bilgileri:</strong> E-posta adresi, telefon numarası (opsiyonel)</li>
            <li><strong>Finansal İşlem Bilgileri:</strong> Havale tutarları, para birimleri, işlem tarihleri</li>
            <li><strong>Sistem Güvenlik Verileri:</strong> Oturum açma logları, IP adresi, kullanılan cihaz bilgisi</li>
            <li><strong>Analitik Veriler:</strong> Sayfa ziyaretleri, oturum süresi (yalnızca onay verilmesi halinde Google Analytics aracılığıyla)</li>
          </ul>
        </Section>

        <Section title="3. Verilerin İşlenme Amaçları">
          <p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
          <ul>
            <li>Platformun çalışması ve kullanıcı kimlik doğrulaması</li>
            <li>İki faktörlü kimlik doğrulama (2FA) e-postalarının iletilmesi</li>
            <li>Finansal işlem kayıtlarının tutulması ve raporlanması</li>
            <li>Hesap güvenliğinin sağlanması ve yetkisiz erişimin önlenmesi</li>
            <li>Yasal yükümlülüklerin yerine getirilmesi</li>
            <li>Platform performansının ve kullanıcı deneyiminin iyileştirilmesi (yalnızca onay halinde)</li>
          </ul>
        </Section>

        <Section title="4. Çerezler ve Google Analytics">
          <p>Web sitemiz, ziyaretçi istatistiklerini analiz etmek amacıyla <strong>Google Analytics</strong> hizmetini kullanmaktadır. Bu hizmet çerezler aracılığıyla anonim kullanım verisi toplar.</p>
          <p>Google Analytics çerezleri yalnızca <strong>açık onayınız</strong> alınması durumunda etkinleştirilir. Siteyi ilk ziyaret ettiğinizde gösterilen bildirim banner'ı aracılığıyla "Kabul Et" veya "Reddet" seçeneğini kullanabilirsiniz.</p>
          <p>Tercihlerinizi dilediğiniz zaman değiştirmek için tarayıcınızın çerez ayarlarını kullanabilir ya da <a href="mailto:info@safironpay.com" style={{ color: '#C9A84C' }}>info@safironpay.com</a> adresine e-posta gönderebilirsiniz.</p>
          <p>Google'ın gizlilik politikasına şu adresten ulaşabilirsiniz: <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: '#C9A84C' }}>policies.google.com/privacy</a></p>
        </Section>

        <Section title="5. Verilerin Paylaşımı">
          <p>Kişisel verileriniz, aşağıdaki durumlar dışında üçüncü taraflarla paylaşılmaz:</p>
          <ul>
            <li><strong>Hizmet Sağlayıcılar:</strong> Platform altyapısını destekleyen Google Cloud, Supabase gibi güvenilir iş ortakları (yalnızca hizmetin ifası amacıyla)</li>
            <li><strong>Yasal Zorunluluk:</strong> Yetkili kamu kurum ve kuruluşlarının yasal talepleri</li>
            <li><strong>Güvenlik:</strong> Dolandırıcılık veya suç faaliyetlerini önlemek amacıyla</li>
          </ul>
          <p>Kişisel verileriniz ticari amaçla hiçbir şekilde satılmaz veya kiralanmaz.</p>
        </Section>

        <Section title="6. Veri Güvenliği">
          <p>Verilerinizin güvenliği için aşağıdaki teknik ve idari önlemler alınmaktadır:</p>
          <ul>
            <li>HTTPS ile şifreli veri iletimi</li>
            <li>Şifreli parola saklama (bcrypt)</li>
            <li>İki faktörlü kimlik doğrulama (2FA)</li>
            <li>Rol tabanlı erişim kontrolü (RBAC)</li>
            <li>Detaylı işlem denetim kaydı (audit log)</li>
            <li>Otomatik oturum sona erme (30 dakika hareketsizlik)</li>
          </ul>
        </Section>

        <Section title="7. KVKK Kapsamındaki Haklarınız">
          <p>6698 sayılı KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
          <ul>
            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
            <li>İşlenmişse buna ilişkin bilgi talep etme</li>
            <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
            <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
            <li>Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme</li>
            <li>KVKK'da öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini isteme</li>
            <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
          </ul>
          <p>Bu haklarınızı kullanmak için <a href="mailto:info@safironpay.com" style={{ color: '#C9A84C' }}>info@safironpay.com</a> adresine yazabilirsiniz.</p>
        </Section>

        <Section title="8. Politika Güncellemeleri">
          <p>Bu Gizlilik Politikası zaman zaman güncellenebilir. Önemli değişiklikler olması halinde platform üzerinden veya e-posta yoluyla bilgilendirilirsiniz. Güncel politikaya her zaman bu sayfadan ulaşabilirsiniz.</p>
        </Section>

        {/* CTA */}
        <div style={{
          marginTop: 48, padding: 24,
          background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 12,
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#fff' }}>Sorularınız mı var?</p>
          <p style={{ margin: 0, fontSize: 13.5, color: '#94A3B8' }}>
            Gizlilik konusundaki her türlü soru ve talebiniz için{' '}
            <a href="mailto:info@safironpay.com" style={{ color: '#C9A84C' }}>info@safironpay.com</a> adresine ulaşabilirsiniz.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '20px max(5%,28px)', textAlign: 'center', fontSize: 12.5, color: '#374151' }}>
        © {new Date().getFullYear()} Safiron Global Solutions. Tüm hakları saklıdır.
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 17, fontWeight: 700, color: '#E2E8F0',
        margin: '0 0 14px', paddingBottom: 10,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>{title}</h2>
      <div style={{ fontSize: 14.5, lineHeight: 1.8, color: '#94A3B8' }}>
        {children}
      </div>
    </div>
  )
}
