# Hawala & FX Muhasebe Sistemi v2.0

## Kurulum

### 1. PostgreSQL
```sql
CREATE USER hawala_user WITH PASSWORD 'hawala_pass';
CREATE DATABASE hawala_db OWNER hawala_user;
```

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# .env içindeki DATABASE_URL ve SECRET_KEY'i düzenle
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Giriş
- URL: http://localhost:3000
- Email: admin@hawala.com
- Şifre: admin123

## Önemli Notlar
- EGP, NGN, SDG gibi egzotik kurlar → Kur Tablosu'nda manuel girin
- Otomatik kurlar her sabah 07:00'de güncellenir (Frankfurter API)
- "Şimdi Güncelle" butonu ile anında güncelleyebilirsiniz

## Kar Mantığı
- USD→EGP: Alış kuru (piyasadan aldığın) > Müşteri kuru → KAR
- EGP→USD: Müşteri kuru > Alış kuru → KAR
- Örnek: Alış=53, Müşteri=52.5 → Kar = 0.5 × 100,000 = 50,000 EGP ✓
