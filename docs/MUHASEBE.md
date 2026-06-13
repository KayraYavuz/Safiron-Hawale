# Muhasebe Modülü — Hesap Planı & Defter (Operatör Kılavuzu)

Bu belge, Safiron platformuna eklenen **Hesap Planı (Chart of Accounts)** ve **çift taraflı kayıt Defteri (double-entry General Ledger)** modülünü açıklar. Modül; işlemleri otomatik muhasebeleştirir ve **Mizan**, **Bilanço**, **Gelir Tablosu** üretir.

## Genel Bakış

- **Şema seçimi (şirket başına):** Türkiye **Tekdüzen Hesap Planı (THP, 1–9 sınıf)** veya **Uluslararası/IFRS (1000–6999)**.
- **Fonksiyonel para:** USD. Her satır hem orijinal para birimini hem USD karşılığını taşır; tablolar USD bazında raporlar.
- **Çok kiracılı (multi-tenant):** Her şirket yalnızca kendi hesap planını ve defterini görür.
- **Üç dilli:** TR / AR / EN.

## Ekranlar

| Menü | Yol | İşlev |
|---|---|---|
| Hesap Planı | `/chart-of-accounts` | Şema başlatma, hesap ağacı CRUD, rol→hesap eşleştirme |
| Yevmiye Defteri | `/journal` | Fişleri görüntüleme, manuel fiş, fiş iptali (ters kayıt) |
| Mali Tablolar | `/financial-statements` | Mizan / Bilanço / Gelir Tablosu / Defter-i Kebir + Dönemler |

## İlk Kurulum (şirket bazında)

1. **Hesap Planı** ekranını aç. Plan boşsa şema seçici çıkar.
2. **Tekdüzen (TR)** veya **Uluslararası** seç → **Başlat**. Bu işlem:
   - Hesap ağacını oluşturur (`backend/app/data/coa_thp.json` / `coa_intl.json` şablonlarından).
   - 14 muhasebe rolünü ilgili hesaplara eşler (kasa, banka, müşteri/tedarikçi alacak/borç, kur kârı/zararı, komisyon, geçmiş yıl kârları, vb.).
   - İdempotenttir: planı zaten olan şirkette tekrar çağrılırsa hiçbir şey yapmaz.

> Rol eşleştirmelerini Hesap Planı ekranının altındaki **Rol Eşleştirmeleri** panelinden değiştirebilirsin. Otomatik muhasebeleştirme bu eşleştirmeleri kullanır.

## Otomatik Muhasebeleştirme (nasıl çalışır)

Bir işlem **onaylandığında** (`pending → completed`) motor tek bir **dengeli** yevmiye fişi üretir:

- Her **gelen** bacak → ilgili kasanın GL hesabına **borç**; her **giden** bacak → **alacak**.
  - Kasanın GL alt hesabı ilk kullanımda otomatik açılır (ör. `100.01 USD Kasa — İstanbul`).
- **Gelir tanıma:** `net_pnl_usd`, komisyon (`602 Komisyon Gelirleri`) ve kur farkı (`601 Kur Kârı` / `656 Kur Zararı`) olarak ayrıştırılır.
- **Karşı taraf dengesi:** kalan fark, müşteri/tedarikçi alacak/borç hesabına yazılır — böylece **Σborç_usd == Σalacak_usd** her zaman tutar.

**İptal/silme:** Onaylı bir işlem silinince fiş **silinmez**; ters (ayna) bir fiş üretilir ve orijinali `void` olur (denetim güvenli).

**Dönem kilidi:** Kapalı bir döneme ait tarihe muhasebeleştirme/iptal **reddedilir**.

> Not: Şirketin henüz hesap planı yoksa veya bir rol eşleşmemişse, muhasebeleştirme **sessizce atlanır** — işlem akışı asla engellenmez.

## Manuel Fiş

**Yevmiye Defteri → Manuel Fiş**: tarih, açıklama ve en az iki satır (her satır: hesap + borç **veya** alacak USD). Σborç == Σalacak olana kadar kaydet butonu kapalıdır. Sadece **işlem yapılabilir (postable)** hesaplara satır girilebilir.

## Mali Tablolar

- **Mizan:** Her hesabın borç/alacak/bakiye toplamı; Σborç = Σalacak.
- **Bilanço:** Varlıklar = Yükümlülükler + Özkaynaklar + Dönem Net Kârı.
- **Gelir Tablosu:** Tarih aralığı için Gelirler − Giderler = Net.
- **Defter-i Kebir:** Tek hesabın tarih aralığındaki hareketleri + yürüyen bakiye.

## Dönem Kapanışı

**Mali Tablolar → Dönemler**: tarih aralığı seçip **Dönemi Kapat**. Kapanış:
- Gelir/gider hesaplarını sıfırlayan dengeli bir **kapanış fişi** atar; net kâr/zarar **Geçmiş Yıllar Kârları**na (`570`) aktarılır.
- Dönemi `closed` işaretler → o aralığa artık muhasebeleştirme yapılamaz.
- **Yeniden Aç** ile geri alınabilir. Çakışan (overlap) kapanış reddedilir.

## Operasyon / Dağıtım (DevOps)

Veritabanı şeması ve geçmiş veri için (üretim ortamı):

```bash
cd backend
./venv/bin/python migrate.py            # COA/journal tabloları + kolonları oluşturur (additive, idempotent)
./venv/bin/python backfill_gl.py --scheme thp   # geçmiş tamamlanmış işlemleri deftere işler (idempotent)
```

- `migrate.py` **tek transaction** içinde çalışır: hata olursa kısmi değişiklik bırakmaz.
- `backfill_gl.py` idempotenttir: tekrar çalıştırmak kayıt çoğaltmaz; planı olmayan şirkete `--scheme` ile varsayılan şema seeder.

## Testler

```bash
cd backend && ./venv/bin/python -m pytest tests/ -q
```

İlgili test dosyaları: `test_accounting_*`, `test_journal_*`, `test_posting_engine`, `test_backfill`, `test_statements*`, `test_period*`.

## Geliştirici Notları / Tuzaklar

- **PostgreSQL enum adı:** SQLAlchemy, Python enum sınıf adından native PG enum tipi adını türetir. Aynı ada sahip iki enum (ör. iki `AccountType`) çakışır. Yeni bir `Enum` kolonu eklerken çakışma varsa **mutlaka `name=` ver** (bkz. `chart_of_accounts.account_type` → `coa_account_type`). SQLite adlandırılmış enum tipi kullanmadığından bunu testler yakalamaz; yalnızca prod migrate yakalar.
- Tasarım/uygulama detayları: `docs/superpowers/specs/2026-06-12-chart-of-accounts-general-ledger-design.md` ve `docs/superpowers/plans/2026-06-12-chart-of-accounts-phase{1..5}.md`.

## Bilinçli Kapsam Dışı (v1) — olası sonraki adımlar

- Yeni şirket oluşturulurken hesap planının otomatik başlatılması (varsayılan şema kararı gerekir).
- Tedarikçi uzlaşmalarının ayrı muhasebeleştirilmesi (karşı taraf dengesi zaten yazıldığından çift sayımı önlemek için ele alınmalı).
- KDV/vergi alt defteri otomasyonu, amortisman, konsolide çok-şirket tabloları.
- Mali tablo CSV/PDF dışa aktarımı.
