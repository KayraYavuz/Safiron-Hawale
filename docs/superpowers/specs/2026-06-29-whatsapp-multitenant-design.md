# Multi-tenant WhatsApp Bot — Tasarım

**Tarih:** 2026-06-29
**Durum:** Onaylı.

## Amaç

WhatsApp bot'unun her şirket için ayrı çalışması — Telegram multi-bot ile aynı
izolasyon. Her şirket kendi WhatsApp Business numarasını bağlar; gelen mesaj,
**mesajı alan numaradan** (`phone_number_id`) doğru şirkete yönlendirilir ve tüm
veri o şirkete scope'lanır.

## Veri modeli (Company)
- `whatsapp_phone_id` (String, null) — şirketin WhatsApp Business Phone Number ID'si;
  webhook'ta gelen `metadata.phone_number_id` ile eşleşir = şirket kimliği.
- `whatsapp_token` (String, null) — şirkete özel gönderim token'ı; boşsa global
  `WHATSAPP_TOKEN`'a düşer (tek WABA altında çok numara senaryosu).

## Bileşenler

### Webhook — `api/whatsapp.py`
- Payload'dan `phone_number_id = value.metadata.phone_number_id` okunur.
- `Company.whatsapp_phone_id == phone_number_id` ile şirket çözülür.
  Eşleşme yoksa → 200 ile sessiz çık (yabancı numara).
- `handle_message(sender, text, db, company_id)` çağrılır.
- Yanıtlar `send_message(sender, reply, phone_id=company.whatsapp_phone_id,
  token=company.whatsapp_token or global)` ile o şirketin numarasından gönderilir.

### `services/whatsapp_client.send_message(to, text, phone_id=None, token=None)`
- Verilen `phone_id`/`token` kullanılır; yoksa global config'e düşer (geriye
  dönük uyumlu — mevcut bildirim çağrıları bozulmaz).

### `services/whatsapp_bot.handle_message(sender, text, db, company_id=None)`
- Tüm veri handler'ları (`_bakiye`, `_rapor`, `_son_islemler`, işlem kaydı)
  bu `company_id`'ye scope'lanır. `company_id` None ise `_company_id(db)`
  fallback'i (mevcut tek-tenant davranışı) korunur.

### `is_allowed_number`
- Global erişim gate'i değişmeden kalır (kim kullanabilir). Şirket, alan
  numaradan belirlenir.

### Migration — `core/migrations.py`
- `companies`'e `whatsapp_phone_id`, `whatsapp_token` `ADD COLUMN IF NOT EXISTS`.

## Hata Yönetimi
- Bilinmeyen `phone_number_id` → sessiz 200 (Meta retry'ı tetiklenmez).
- `phone_number_id` yoksa (eski/tek-tenant) → `_company_id` fallback.

## Test Planı
- Webhook: phone_number_id → doğru şirket; bilinmeyen id → işlenmez.
- `handle_message` company_id ile çağrıldığında diğer şirketin verisi görünmez.
- `send_message` verilen phone_id/token'ı kullanır, yoksa config'e düşer.

## YAGNI
Per-company allow-list, per-company şablon yönetimi, numara doğrulama akışı.
