"""
Otomatik kur güncelleme — Frankfurter API (ücretsiz, key yok)
Her sabah 07:00'de çalışır.
"""
import httpx
import logging
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.transaction import ExchangeRate

logger = logging.getLogger(__name__)

# Frankfurter'dan çekilecek para birimleri (USD bazlı)
SYMBOLS = "EUR,GBP,SAR,AED,TRY,CNY,KWD,QAR,BHD,OMR,JOD,MAD,INR,PKR,CHF,RUB"

# EGP, NGN, SDG, LBP, ETB, USDT → manuel girilmeli (piyasa kuru ≠ resmi kur)

async def fetch_and_save_rates() -> dict:
    """Frankfurter'dan kurları çek, veritabanına kaydet."""
    try:
        url = f"https://api.frankfurter.dev/v2/latest?base=USD&symbols={SYMBOLS}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        rates = data.get("rates", {})
        if not rates:
            return {"saved": 0, "error": "API boş yanıt"}

        db: Session = SessionLocal()
        today = date.today()
        saved = 0

        try:
            for code, value in rates.items():
                existing = db.query(ExchangeRate).filter(
                    ExchangeRate.date == today,
                    ExchangeRate.currency_code == code,
                ).first()

                if existing:
                    existing.rate_per_usd = Decimal(str(value))
                    existing.source = "frankfurter_auto"
                else:
                    db.add(ExchangeRate(
                        date=today,
                        currency_code=code,
                        rate_per_usd=Decimal(str(value)),
                        source="frankfurter_auto",
                    ))
                saved += 1

            db.commit()
            logger.info(f"✅ {saved} kur güncellendi ({today})")
            return {"saved": saved, "date": str(today), "rates": rates}

        finally:
            db.close()

    except httpx.HTTPError as e:
        logger.error(f"Frankfurter API hatası: {e}")
        return {"saved": 0, "error": str(e)}
    except Exception as e:
        logger.error(f"Kur güncelleme hatası: {e}")
        return {"saved": 0, "error": str(e)}

def setup_scheduler():
    """Her sabah 07:00'de otomatik çalıştır."""
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            fetch_and_save_rates,
            CronTrigger(hour=7, minute=0),
            id="daily_fx",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("✅ Kur scheduler başlatıldı (07:00)")
        return scheduler
    except Exception as e:
        logger.warning(f"Scheduler başlatılamadı: {e}")
        return None
