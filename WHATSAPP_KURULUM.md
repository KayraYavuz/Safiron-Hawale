# WhatsApp Bot Kurulum Kılavuzu

Safiron Hawale uygulamasını WhatsApp üzerinden yönetmek için aşağıdaki adımları takip edin.

---

## 1. Meta for Developers Hesabı Oluştur

1. https://developers.facebook.com adresine gidin
2. Sağ üstten **"My Apps"** → **"Create App"** tıklayın
3. Uygulama türü: **"Business"** seçin
4. Uygulama adı: `Safiron Hawale` (ya da dilediğiniz)
5. **WhatsApp** ürününü ekleyin

---

## 2. WhatsApp Business API Kurulumu

Meta Developer Console'da:

1. Sol menü → **WhatsApp** → **API Setup**
2. **"From"** bölümünde telefon numaranızı görürsünüz:
   - **Phone Number ID** → `.env`'ye `WHATSAPP_PHONE_ID` olarak kopyalayın
3. **Temporary Access Token**'ı kopyalayın → `.env`'ye `WHATSAPP_TOKEN` olarak yapıştırın
   > ⚠️ Geçici token 24 saat geçerlidir! Kalıcı token için Adım 5'e bakın.

---

## 3. .env Dosyasına Ekle

`backend/.env` dosyasını açın ve şu satırları ekleyin:

```env
# WhatsApp Cloud API
WHATSAPP_TOKEN=EAAxxxxxxxx...           # Meta'dan alınan access token
WHATSAPP_PHONE_ID=1234567890123         # Phone Number ID (rakamlardan oluşur)
WHATSAPP_APP_SECRET=abc123def456...     # App → Settings → Basic → App Secret
WHATSAPP_VERIFY_TOKEN=safiron_secret_2024  # Siz belirleyin, webhook'ta aynı olmalı
WHATSAPP_ALLOWED_NUMBERS=+905551234567,+905559876543  # Bot'u kullanabilecek numaralar
WHATSAPP_INTERNAL_SECRET=gizli_internal_anahtar_2024  # /notify endpoint güvenliği
```

---

## 4. Webhook URL Ayarla

### Lokal Geliştirme (ngrok ile)

```bash
# Terminalde:
ngrok http 8000

# Çıktıdaki URL'yi kopyalayın:
# https://abc123.ngrok.io
```

### Meta Panelde Webhook Ayarı

1. **WhatsApp** → **Configuration** → **Webhook** bölümü
2. **Edit** tıklayın:
   - **Callback URL:** `https://abc123.ngrok.io/api/whatsapp/webhook`
   - **Verify Token:** `.env`'deki `WHATSAPP_VERIFY_TOKEN` değeri
3. **Verify and Save** tıklayın ✓
4. **Webhook Fields** → `messages` alanını **subscribe** edin

---

## 5. Kalıcı Access Token Al (Production)

Geçici token 24 saatte dolar. Kalıcı token için:

1. **System Users** → Meta Business Manager'da
2. Sistem kullanıcısı oluştur → **WhatsApp Account** iznini ver
3. Token oluştur → Kalıcı token kopyala → `.env`'e yapıştır

---

## 6. Uygulamayı Yeniden Başlat

```bash
cd backend
uvicorn app.main:app --reload
```

---

## 7. Test Et

Telefonu WhatsApp Business numarasına mesaj gönderin:

| Mesaj | Yanıt |
|-------|-------|
| `?` | Komut listesi |
| `bakiye` | Tüm kasa bakiyeleri |
| `rapor` | Günlük özet |
| `kur` | Tüm döviz kurları |
| `kur USD` | USD kuru |
| `işlemler` | Son 10 işlem |
| `havale 1000 USD ali → mehmet` | İşlem önizlemesi |

---

## 8. Sistem Bildirimleri Gönder

Uygulama içinden WhatsApp bildirimi göndermek için:

```python
import httpx

httpx.post("http://localhost:8000/api/whatsapp/notify", json={
    "to": "+905551234567",
    "message": "⚠️ Limit aşıldı: Ali Karimov 50,000 USD",
    "secret": "gizli_internal_anahtar_2024"  # WHATSAPP_INTERNAL_SECRET
})
```

---

## Desteklenen Komutlar

```
bakiye / b       → Tüm kasa bakiyeleri
rapor / r        → Günlük özet rapor  
kur / k          → Tüm döviz kurları
kur TRY          → Belirli para birimi kuru
işlemler / i     → Son 10 işlem
yardım / ?       → Bu liste

havale 1000 USD ali → mehmet   → İşlem kaydı (Groq AI parse)
```

---

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| `403 Doğrulama başarısız` | Verify Token'ın .env ile Meta panelinde aynı olduğunu kontrol edin |
| `WHATSAPP_TOKEN eksik` | .env dosyasını backend/ klasöründe oluşturduğunuzdan emin olun |
| Mesaj gitmiyor | Phone Number ID'nin doğru olduğunu kontrol edin |
| `izinsiz numara` | WHATSAPP_ALLOWED_NUMBERS'a numaranızı ekleyin (+90...) |
| Ngrok çalışmıyor | `ngrok config add-authtoken <token>` komutuyla auth ekleyin |
