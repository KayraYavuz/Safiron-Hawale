FROM python:3.12-slim

WORKDIR /app

# Sistem bağımlılıkları (psycopg2-binary için gerekli libpq ve derleme araçları)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run PORT ortam değişkenini kullanır, varsayılan 8080
ENV PORT 8080
# Python buffering'i kapatarak logların anında görünmesini sağlayalım
ENV PYTHONUNBUFFERED 1

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
