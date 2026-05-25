import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const LAST_UPDATED = '25 Mayıs 2026'

export default function KullanimSartlari() {
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
            Kullanım Şartları
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            Son güncelleme: {LAST_UPDATED}
          </p>
        </div>

        <Section title="1. Taraflar ve Kapsam">
          <p>Bu Kullanım Şartları, <strong>Safiron Global Solutions</strong> ("Şirket") tarafından <strong>safironpay.com</strong> alan adı üzerinde sunulan Safiron Havale yönetim platformu ("Platform") ile bu platformu kullanan işletme ve bireyler ("Kullanıcı") arasındaki hukuki ilişkiyi düzenlemektedir.</p>
          <p>Platforma erişim sağlayarak veya kullanarak bu şartları kabul etmiş sayılırsınız. Şartları kabul etmiyorsanız platformu kullanmayı bırakmanız gerekmektedir.</p>
        </Section>

        <Section title="2. Hizmetin Tanımı">
          <p>Safiron Havale; çok şubeli havale ofisleri ve döviz büroları için geliştirilmiş, aşağıdaki işlevleri sunan bir B2B yönetim yazılımıdır:</p>
          <ul>
            <li>Çok şubeli, çok para birimli havale işlemi yönetimi</li>
            <li>Gerçek zamanlı döviz kuru takibi ve güncelleme</li>
            <li>Muhatap (counterparty) hesap yönetimi</li>
            <li>Finansal raporlama ve nakit akışı analizi</li>
            <li>Yapay zeka destekli finansal analiz</li>
            <li>Telegram Bot entegrasyonu ile işlem bildirimleri</li>
            <li>Kullanıcı yönetimi ve rol tabanlı erişim kontrolü</li>
          </ul>
          <p>Platform, yalnızca Şirket tarafından yetkilendirilmiş işletmelere ve kullanıcılara sunulmaktadır.</p>
        </Section>

        <Section title="3. Kullanım Koşulları">
          <p>Platforma erişim için:</p>
          <ul>
            <li>Geçerli bir kullanıcı hesabına sahip olmanız gerekmektedir</li>
            <li>Hesabınızın Şirket tarafından onaylanmış olması gerekmektedir</li>
            <li>Giriş bilgilerinizi (e-posta, şifre) gizli tutmakla yükümlüsünüz</li>
            <li>Hesabınızı yalnızca yetkili personelin kullanması sağlanmalıdır</li>
            <li>Hesabınızda gerçekleşen tüm işlemlerden sorumlusunuz</li>
          </ul>
        </Section>

        <Section title="4. Kullanıcının Yükümlülükleri">
          <p>Kullanıcı, platform üzerinde aşağıdaki eylemlerde bulunmayacağını kabul eder:</p>
          <ul>
            <li>Yanlış, yanıltıcı veya sahte bilgi girmek</li>
            <li>Yasadışı finansal işlemleri kayıt altına almak veya aklamak</li>
            <li>Yetkisiz erişim sağlamaya çalışmak</li>
            <li>Sisteme zarar verecek yazılım veya kod çalıştırmak</li>
            <li>Platform verilerini izinsiz kopyalamak, dağıtmak veya satmak</li>
            <li>Üçüncü tarafların haklarını ihlal eden herhangi bir eylemin gerçekleştirilmesi</li>
          </ul>
        </Section>

        <Section title="5. Fikri Mülkiyet">
          <p>Platform üzerindeki tüm içerik, tasarım, kod ve materyaller Safiron Global Solutions'ın münhasır mülkiyetindedir ve telif hakkı yasalarıyla korunmaktadır.</p>
          <p>Kullanıcıya yalnızca bu şartlar çerçevesinde sınırlı, devredilemez ve geri alınabilir bir kullanım lisansı verilmektedir. Bu lisans, platformun yeniden satılması, kopyalanması veya türev çalışmaların oluşturulması için kullanılamaz.</p>
        </Section>

        <Section title="6. Sorumluluk Sınırlaması">
          <p>Şirket, aşağıdaki durumlardan kaynaklanan zararlardan sorumlu tutulamaz:</p>
          <ul>
            <li>Kullanıcı hatası veya yetkisiz kullanım sonucu oluşan kayıplar</li>
            <li>İnternet bağlantısı veya üçüncü taraf hizmetlerinden kaynaklanan kesintiler</li>
            <li>Mücbir sebep halleri (doğal afet, savaş, siber saldırı vb.)</li>
            <li>Dış kaynaklı döviz kuru değişikliklerinden doğan finansal kayıplar</li>
          </ul>
          <p>Her halükarda Şirket'in sorumluluğu, ilgili hizmet bedeli ile sınırlıdır.</p>
        </Section>

        <Section title="7. Gizlilik">
          <p>Platformun kullanımı sırasında işlenen kişisel veriler hakkında detaylı bilgi için <a href="/gizlilik-politikasi" style={{ color: '#C9A84C' }}>Gizlilik Politikamızı</a> inceleyiniz.</p>
        </Section>

        <Section title="8. Hizmet Değişiklikleri ve Sonlandırma">
          <p>Şirket, platformu önceden bildirimde bulunmaksızın güncelleme, değiştirme veya belirli özelliklerini kaldırma hakkını saklı tutar.</p>
          <p>Kullanım şartlarının ihlali durumunda Şirket, kullanıcının hesabını geçici olarak askıya alabilir veya kalıcı olarak kapatabilir.</p>
          <p>Kullanıcı, 30 günlük önceden bildirimde bulunmak kaydıyla hesabını kapatabilir.</p>
        </Section>

        <Section title="9. Uygulanacak Hukuk ve Yetki">
          <p>Bu Kullanım Şartları, <strong>Türkiye Cumhuriyeti hukuku</strong> kapsamında yorumlanır ve uygulanır.</p>
          <p>Taraflar arasında doğabilecek her türlü uyuşmazlıkta <strong>İstanbul Mahkemeleri ve İcra Müdürlükleri</strong> yetkilidir.</p>
        </Section>

        <Section title="10. Şartlardaki Değişiklikler">
          <p>Şirket, bu Kullanım Şartlarını dilediği zaman değiştirme hakkını saklı tutar. Önemli değişiklikler platform üzerinden veya e-posta yoluyla önceden duyurulacaktır. Değişikliğin yürürlüğe girmesinden sonra platformu kullanmaya devam etmeniz, yeni şartları kabul ettiğiniz anlamına gelir.</p>
        </Section>

        {/* CTA */}
        <div style={{
          marginTop: 48, padding: 24,
          background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 12,
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#fff' }}>Sorularınız mı var?</p>
          <p style={{ margin: 0, fontSize: 13.5, color: '#94A3B8' }}>
            Kullanım şartlarına ilişkin sorularınız için{' '}
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
