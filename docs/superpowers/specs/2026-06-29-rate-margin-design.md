# Kur Marj Yönetimi (MVP) — Tasarım

**Tarih:** 2026-06-29
**Durum:** Onaylı yön (kullanıcı "3" ile seçti); opt-in, düşük riskli kapsam.

## Amaç

Veri-giriş kur hatalarını azaltmak: operatör para birimi başına varsayılan
bir **marj yüzdesi** tanımlar; işlem formunda tek tıkla müşteri kuru, girilen
piyasa (supplier) kurundan marja göre otomatik doldurulur. Otomatik/sessiz
davranış yok — operatör butona basar, override edebilir (kritik giriş akışını
bozmaz).

## Yön mantığı (mevcut formdan)

Form zaten kâr yönünü biliyor:
- **Case A** (`destCur === 'USD'`): kâr için `customer > supplier` →
  `customer = supplier × (1 + marj)`.
- **Case B** (aksi): kâr için `supplier > customer` →
  `customer = supplier × (1 − marj)`.

Marj, operatörün girdiği `supplierRate`'e uygulanır — piyasa kuru çekmeye gerek
yok. Marj, USD-olmayan para birimine (`nonUsdCur`) göre seçilir.

## Veri modeli

`currency_margin` (master data):
`id, company_id, currency_code, margin_pct (Numeric(6,4)), updated_at`.
Tekil: `(company_id, currency_code)`. `margin_pct` ondalık (0.01 = %1).

## API — `api/master.py` (mevcut prefix `/api`)
- `GET /margins` → şirketin marjları (tüm roller okuyabilir; form için).
- `PUT /margins` body `{currency_code, margin_pct}` → upsert (admin).
  `margin_pct < 0` → 400.
- `DELETE /margins/{currency_code}` (admin).

## Frontend
- **Yönetim UI:** Rates sayfasına küçük "Kur Marjları" kartı — para birimi +
  marj% ekle/sil (admin).
- **TransactionForm:** `customerRate` alanının yanında opt-in **"Marj uygula"**
  butonu. Görünürlük: `supplierRate` girilmiş, `nonUsdCur` için marj tanımlı ve
  `!sameCur`. Tıklayınca `customerRate` yukarıdaki formülle doldurulur (yön
  forma göre). Operatör sonra elle değiştirebilir.
- `marginsApi` helper, TR/EN/AR locale anahtarları.

## Hata Yönetimi
- Negatif marj → 400. Bilinmeyen currency silme → 404.
- Marj yoksa buton görünmez (akış değişmez).

## Test Planı
- Model upsert + tekil kısıt.
- API: get/put/delete, negatif marj 400, admin-only yazma, tenant izolasyonu.
- (Frontend formül birim mantığı backend'de değil; manuel doğrulanır.)

## YAGNI
Otomatik piyasa-kuru çekip doldurma, yön başına ayrı marj, marj geçmişi.
