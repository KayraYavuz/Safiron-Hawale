# AML / Uyum Katmanı (MVP) — Tasarım

**Tarih:** 2026-06-29
**Durum:** Onaylandı (tasarım)

## Amaç

Formel döviz büroları / MSB'lerin gerçek uyum acısını çözen ilk katman:
işlemleri tutar eşiği, yaptırım/watchlist isim eşleşmesi ve structuring
(bölme) açısından tarayıp **risk bayrağı** üretmek ve bayraklı işlemlerin
ancak **yükseltilmiş onayla** tamamlanmasını sağlamak. CEO review'ün
"formel MSB'lerin para ödediği tek şey" önerisi.

## Kapsam Kararları (onaylı)

- **Zorlama:** bayrak + zorunlu yükseltilmiş onay (işlemi bloklamaz).
- **Watchlist:** şirketin yönettiği yerel liste + fuzzy isim eşleşmesi.
- **Kurallar:** tutar eşiği + watchlist eşleşmesi + structuring (üçü de).

## Veri Modeli

### Yeni tablolar
- `watchlist`: `id, company_id, name, name_ar (null), reason (null),
  is_active (bool), created_at`.
- `compliance_flags`: `id, company_id, transaction_id, rule
  (amount|watchlist|structuring), detail (text), status (open|cleared),
  created_at, cleared_by (null), cleared_at (null)`.
  `(transaction_id, rule)` tekil → idempotent yeniden tarama.

### Company alanları (commission_tax_rate kalıbı)
- `aml_threshold_usd` (Numeric(18,4), default 0 = kapalı).
- `aml_structuring_window_days` (Integer, default 1).

### Enum
`ComplianceRule(str, Enum)`: amount, watchlist, structuring.
`ComplianceStatus(str, Enum)`: open, cleared.

## Bileşenler

### Tarama servisi — `services/compliance.py`
- `_txn_usd(txn) -> Decimal`: işlemin USD değeri (pnl.usd_amount varsa o,
  yoksa bacakların max amount_usd'i).
- `_normalize(name)`, `_similar(a, b) -> float`: aksan/boşluk/küçük harf
  normalize; `difflib.SequenceMatcher` oranı (bağımlılık yok).
- `screen_transaction(db, company, txn) -> list[dict]`:
  - **amount:** `threshold > 0 ve usd >= threshold` → flag.
  - **watchlist:** karşı taraf adı (name + name_ar) aktif listeyle oran
    ≥ 0.85 → flag (eşleşen isim detayda).
  - **structuring:** aynı counterparty, son `window_days` içindeki eşik-altı
    işlemlerin (bu işlem dahil) toplamı ≥ threshold ve adet > 1 → flag.
- `evaluate_and_store(db, txn)`: `screen_transaction` çalıştırır, eksik
  `compliance_flags` satırlarını ekler (mevcut rule'u tekrar yazmaz),
  oluşturulan/var olan açık bayrak listesini döner.

### Zorlama akışı
- `api/transactions.create_transaction`: pnl'den sonra, commit'ten önce
  `evaluate_and_store` çağrılır (savunmacı try/except — uyum hatası işlem
  oluşturmayı bozmaz).
- `api/transactions.approve` (ve `approve-all`): işlemin açık bayrağı varsa
  yalnızca `admin|super_admin|manager|branch_manager` onaylayabilir
  (`accounting` ve aşağısı 403). Onayda ilgili açık bayraklar `cleared`
  yapılır (`cleared_by`, `cleared_at`) ve audit'e yazılır.

### API — `api/compliance.py` (prefix `/api/compliance`)
- `GET/POST/DELETE /watchlist` (admin) — liste yönetimi (soft delete).
- `GET /flags?status=&rule=` — uyum raporu (tenant-scoped, joinedload txn).
- `POST /flags/{id}/clear` (admin|manager) — not ile elle temizleme.
- `GET/PUT /settings` (admin) — `aml_threshold_usd`, `aml_structuring_window_days`.
- Tüm uçlar `data_entry` rolüne kapalı (bakiye/raporlar gibi).

### Frontend
- İşlem satırında **risk rozeti** (kırmızı ⚑) — `txn.compliance_flagged`
  (TransactionOut'a türetilmiş alan: açık bayrak var mı).
- Yeni **Uyum** sayfası (`/compliance`, nav girişi): açık bayraklar raporu
  (işlem, kural, detay, temizle), watchlist CRUD, eşik ayarı.
- TR/EN/AR locale anahtarları.

### Migration — `core/migrations.py`
- `watchlist` ve `compliance_flags` tablolarını `CREATE TABLE IF NOT EXISTS`.
- `companies`'e `aml_threshold_usd`, `aml_structuring_window_days`
  `ADD COLUMN IF NOT EXISTS`.
- `(transaction_id, rule)` için unique index.

## Hata Yönetimi
- Tarama hatası işlem oluşturmayı/asla onayı bozmaz (defensive).
- Eşik 0 ise amount/structuring kuralları çalışmaz (kapalı).
- Bilinmeyen flag id → 404; yetkisiz rol → 403.

## Test Planı
- Servis: amount eşiği (üst/alt sınır), watchlist fuzzy eşleşme + eşleşmeme,
  structuring (eşik-altı çoklu → bayrak; tek işlem → bayraksız), idempotency.
- Onay kapısı: bayraklı işlemi accounting onaylayamaz (403); manager
  onaylar ve bayraklar cleared olur.
- API: watchlist CRUD, flags raporu filtreleri, clear akışı, settings.
- `_txn_usd` pnl/leg fallback.

## YAGNI (sonraki faz)
Harici yaptırım API (OFAC/UN), PEP/risk skorlama, otomatik SAR/CTR
e-dosyalama, KYC belge saklama.
