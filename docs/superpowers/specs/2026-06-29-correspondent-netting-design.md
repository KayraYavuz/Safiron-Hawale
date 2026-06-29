# Muhabir Netting & Tek-Tıkla Mutabakat — Tasarım

**Tarih:** 2026-06-29
**Durum:** Onaylandı (tasarım)

## Amaç

Hawala operatörünün her muhabir (correspondent / itimad) ile **net bakiyesini tek
ekranda** görmesi ve bakiyeyi **tek tıkla mutabakat** (settlement) ile GL'ye dengeli
bir kayıt üreterek kapatabilmesi. Bu, ürünün en güçlü farklılaştırıcısı: genel
muhasebe yazılımları muhabir netting'i yapmaz.

## Kapsam Kararları (onaylı)

- **Settlement = gerçek GL kaydı.** Posting engine ile dengeli yevmiye.
- **Tutar = kısmi + tam.** Varsayılan net bakiyenin tamamı; daha azı kapatılabilir.
- **Net pozisyon = USD net.** GL karşı-taraf satırları zaten USD; tutarlı.

## Mevcut Altyapı (yeniden kullanılacak)

- `services/partner_reports.py`: `partner_ledger` (cari ekstre + yürüyen bakiye),
  `aged_balance` (muhabir bazında net toplama mantığı).
- `services/posting.py`: `resolve_role`, `get_or_create_gl_for_till`,
  `period_is_closed`, `_persist_entry`, `_usd_line`, `void_for_source`.
- `models/accounting.py`: `AccountRole.{customer,supplier}_{receivable,payable}`,
  `JournalSourceType.settlement` (zaten mevcut).
- `models/master.py`: `Counterparty.type` (`CounterpartyType`).

## Bileşenler

### 1. Net pozisyon servisi
`partner_reports.correspondent_positions(db, company_id, as_of) -> dict`
- Posted yevmiye satırlarından `counterparty_id` taşıyanları muhabir bazında toplar:
  `net_usd = Σ(debit_usd − credit_usd)`.
- `net_usd > 0` → **receivable** (onlar bize borçlu); `< 0` → **payable** (biz onlara).
- Sıfır net olanlar elenir. İsme göre sıralanır.
- Döner: `{rows: [{counterparty_id, name, net_usd, direction}], total_receivable_usd,
  total_payable_usd}`.
- `aged_balance` ile aynı toplama mantığı, kova (bucket) olmadan.

### 2. Settlement posting
`posting.post_settlement(db, company_id, counterparty, till_account, amount_usd, user_id) -> JournalEntry`
- Yön, mevcut net'ten belirlenir (settle çağrısı net'i taze hesaplar).
- Kontrol hesabı rolü muhabir tipine göre:
  supplier/correspondent → `supplier_*`, müşteri → `customer_*`.
- **Borç kapama** (net < 0, biz öderiz):
  `debit` muhabir control (counterparty_id ile), `credit` kasa GL leaf → nakit çıkar.
- **Alacak tahsili** (net > 0):
  `debit` kasa GL leaf, `credit` muhabir control (counterparty_id ile) → nakit girer.
- `source_type = settlement`, `source_id = counterparty.id` + zaman damgalı (her
  settlement ayrı kayıt; idempotent değil). `memo` settlement açıklaması.
- Period-closed / mapping eksikliği posting engine'den HTTP-uyumlu hata olarak gelir.

### 3. Endpoint'ler (`api/statements.py`)
- `GET /api/statements/correspondent-positions` — net pozisyon listesi.
  Rol kapısı: `position` ile aynı (data_entry göremez). Tenant: `company_id` zorunlu.
- `POST /api/statements/settle` — body `{counterparty_id, till_account_id, amount_usd?}`.
  - `amount_usd` boş → tam net; dolu → `min(amount, |net|)`.
  - Doğrulama: counterparty ve till hesabı kullanıcının şirketine ait olmalı.
  - Net sıfırsa 400 ("kapatılacak bakiye yok").

### 4. Frontend
- Net pozisyon tablosu (Reports veya Counterparties sekmesi): muhabir, net USD,
  yön rozeti (yeşil alacak / kırmızı borç), **Mutabık Ol** butonu.
- Mutabakat modalı: kasa seç, tutar (varsayılan tam net), onayla.
- Başarıda toast + `correspondent-positions`, `position`, `transactions` invalidate.
- Satırdan mevcut `partner-ledger` (cari/mutabakat ekstresi) erişimi.

## Hata Yönetimi
- Eksik mapping / kapalı dönem → posting engine `PostingError` → 400.
- Cross-tenant counterparty/till → 403.
- Sıfır net → 400.

## Test Planı
- `correspondent_positions`: çok muhabirli toplama, sıfır eleme, yön doğruluğu.
- `post_settlement`: borç ve alacak yönü GL dengesi (Σdebit_usd == Σcredit_usd),
  kısmi tutar, kapalı dönem reddi, counterparty_id satırda mevcut.
- API: settle sonrası net bakiyenin azaldığı/sıfırlandığı (partner_ledger ile).

## YAGNI (dışarıda bırakılan)
- Para birimi kırılımı (USD-net yeterli).
- Otomatik mutabakat önerisi / toplu settle.
- Idempotency anahtarı (void mekanizması yeterli).
