# Production Deployment Kılavuzu

## Güvenlik Kontrol Listesi

### Backend
- [ ] `SECRET_KEY` değiştirildi (min 32 karakter, random)
- [ ] `DATABASE_URL` güçlü şifre ile ayarlandı
- [ ] `ALLOWED_ORIGINS` gerçek domain ile güncellendi
- [ ] `.env` dosyası git'e commit edilmedi (.gitignore'da)
- [ ] PostgreSQL dışarıdan erişime kapalı (firewall)
- [ ] HTTPS aktif (SSL/TLS)
- [ ] Rate limiting aktif (auth.py'de varsayılan 10/dk)

### Frontend
- [ ] `VITE_API_URL` production backend URL'si ile ayarlandı
- [ ] `npm run build` ile production build alındı
- [ ] Build dosyaları Nginx/Caddy ile serve ediliyor

## Hızlı Başlangıç (Production)

```bash
# Backend
cd backend
cp .env.example .env
# .env'yi düzenle
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# Frontend
cd frontend
npm install
npm run build
# dist/ klasörünü Nginx ile serve et
```

## Nginx Config (örnek)
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        root /var/www/hawala/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

## İlk Kullanım
- Admin: admin@hawala.com / admin123
- **İlk girişten sonra şifreyi değiştirin!**
