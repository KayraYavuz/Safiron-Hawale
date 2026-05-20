"""
Otomatik kur güncelleme — currencyapi.com (API key gerekli)
Fallback: Frankfurter API (ücretsiz, key yok)
Her sabah 07:00'de çalışır.
"""
import httpx
import logging
import os
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.transaction import ExchangeRate

logger = logging.getLogger(__name__)

# currencyapi.com destekli semboller (EGP, NGN, LBP artık otomatik gelir)
SYMBOLS = "EUR,GBP,SAR,AED,TRY,CNY,KWD,QAR,BHD,OMR,JOD,MAD,INR,PKR,CHF,RUB,EGP,NGN,LBP,ETB,SDG"

async def _fetch_currencyapi(api_key: str) -> dict:
    """currencyapi.com'dan USD bazlı kurları çek."""
    url = (
        f"https://api.currencyapi.com/v3/latest"
        f"?apikey={api_key}&base_currency=USD&currencies={SYMBOLS}"
    )
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    # Yanıt formatı: {"data": {"EUR": {"code": "EUR", "value": 0.92}, ...}}
    raw = data.get("data", {})
    return {code: info["value"] for code, info in raw.items()}


async def _fetch_open_er() -> dict:
    """open.er-api.com'dan USD bazlı kurları çek (ücretsiz, key yok)."""
    url = "https://open.er-api.com/v6/latest/USD"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    if data.get("result") != "success":
        raise ValueError(f"open.er-api hata döndürdü: {data}")
    all_rates = data.get("rates", {})
    # Sadece ihtiyaç duyduğumuz sembolleri filtrele
    wanted = set(SYMBOLS.split(","))
    return {k: v for k, v in all_rates.items() if k in wanted}


async def fetch_and_save_rates() -> dict:
    """Kurları çek ve veritabanına kaydet."""
    api_key = os.getenv("CURRENCY_API_KEY", "")
    source_name = "currencyapi"

    try:
        if api_key:
            rates = await _fetch_currencyapi(api_key)
        else:
            logger.warning("CURRENCY_API_KEY yok, open.er-api fallback kullanılıyor")
            rates = await _fetch_open_er()
            source_name = "open_er_auto"

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
                    existing.source = source_name
                else:
                    db.add(ExchangeRate(
                        date=today,
                        currency_code=code,
                        rate_per_usd=Decimal(str(value)),
                        source=source_name,
                    ))
                saved += 1

            db.commit()
            logger.info(f"✅ {saved} kur güncellendi ({today}) [{source_name}]")
            return {"saved": saved, "date": str(today), "rates": rates}

        finally:
            db.close()

    except httpx.HTTPError as e:
        logger.error(f"Kur API hatası: {e}")
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
