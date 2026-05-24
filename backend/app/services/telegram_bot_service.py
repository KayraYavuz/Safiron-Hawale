"""
Telegram Bot Servisi — Çift Mod
================================
ADMİN modu  → TELEGRAM_ALLOWED_IDS listesindeki kullanıcılar
              Tüm kasalar, raporlar, kur bilgileri
              Müşteri bağlama: "bağla MÜŞTERİ_KODU 905551234567"

MÜŞTERİ modu → counterparties.telegram_id ile eşleşen kullanıcılar
               Sadece kendi hesap ekstresi, bakiyesi, işlemleri

Komutlar:
  /start            → Giriş
  bakiye            → Admin: tüm kasalar | Müşteri: net bakiyesi
  işlemler          → Admin: son 10 genel | Müşteri: kendi son işlemleri
  rapor             → Admin: günlük özet
  kur / kur TRY     → Admin + Müşteri
  bağla KOD ID      → Admin: müşteriyi Telegram'a bağla
  bağla KOD         → Müşteri: kendi kendine bağlanır (kod ile)
  ?                 → Yardım
"""
import asyncio
import logging
import threading
from decimal import Decimal
from datetime import date
from typing import Optional

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

logger = logging.getLogger(__name__)

_bot_thread: Optional[threading.Thread] = None
_app_instance: Optional[Application] = None

ZERO = Decimal("0")


# ─────────────────────────────────────────────────────────────────────────────
# Kullanıcı tipi tespiti
# ─────────────────────────────────────────────────────────────────────────────

def _is_admin(user_id: int) -> bool:
    from app.core.config import settings
    raw = getattr(settings, "TELEGRAM_ALLOWED_IDS", "") or ""
    allowed = {i.strip() for i in raw.split(",") if i.strip()}
    return str(user_id) in allowed


def _get_counterparty(user_id: int, db):
    """Telegram ID'ye bağlı müşteriyi döndür."""
    from app.models.master import Counterparty
    return (db.query(Counterparty)
              .filter(Counterparty.telegram_id == str(user_id),
                      Counterparty.is_active == True)
              .first())


# ─────────────────────────────────────────────────────────────────────────────
# /start
# ─────────────────────────────────────────────────────────────────────────────

async def _start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id

    if _is_admin(uid):
        await update.message.reply_text(
            "👋 *Safiron Hawale — Yönetici Paneli*\n\n"
            "📊 *Sorgulama:*\n"
            "• `bakiye` → Tüm kasa bakiyeleri\n"
            "• `rapor` → Günlük özet\n"
            "• `kur` → Döviz kurları\n"
            "• `işlemler` → Son 10 işlem\n\n"
            "🔗 *Müşteri bağlama:*\n"
            "• `bağla ALI-001 905551234567`\n\n"
            "ℹ️ Yardım: `?`",
            parse_mode="Markdown",
        )
        return

    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        cp = _get_counterparty(uid, db)
    finally:
        db.close()

    if cp:
        await update.message.reply_text(
            f"👋 *Hoş geldiniz, {cp.name}!*\n\n"
            "📊 *Hesabınız:*\n"
            "• `bakiye` → Net bakiyeniz\n"
            "• `işlemler` → Son işlemleriniz\n"
            "• `kur` → Döviz kurları\n\n"
            "ℹ️ Yardım: `?`",
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text(
            "👋 Merhaba!\n\n"
            "Hesabınıza erişmek için müşteri kodunuzu yazın:\n"
            "`bağla MUSTERI_KODUNUZ`\n\n"
            "Müşteri kodunuzu operatörünüzden öğrenebilirsiniz.",
            parse_mode="Markdown",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Genel mesaj yönlendirici
# ─────────────────────────────────────────────────────────────────────────────

async def _handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid      = update.effective_user.id
    username = update.effective_user.username or str(uid)
    text     = (update.message.text or "").strip()
    cmd      = text.lower()

    logger.info(f"Telegram: @{username} ({uid}) → {text[:50]!r}")

    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        if _is_admin(uid):
            reply = _admin_handler(cmd, text, db)
        else:
            cp = _get_counterparty(uid, db)
            if cp:
                reply = _customer_handler(cmd, text, cp, db)
            else:
                # Bilinmeyen kullanıcı — sadece bağlanma komutuna izin ver
                reply = _unknown_user_handler(cmd, text, uid, db)
    except Exception as exc:
        logger.exception(f"Bot hata: {exc}")
        reply = "❌ Sunucu hatası. Lütfen tekrar deneyin."
    finally:
        db.close()

    for i in range(0, len(reply), 4096):
        await update.message.reply_text(reply[i:i+4096], parse_mode="Markdown")


# ─────────────────────────────────────────────────────────────────────────────
# Admin komutları
# ─────────────────────────────────────────────────────────────────────────────

def _admin_handler(cmd: str, raw: str, db) -> str:
    # Yardım
    if cmd in ("?", "yardım", "yardim", "help"):
        return (
            "🔧 *Yönetici Komutları*\n\n"
            "📊 *Raporlar:*\n"
            "• `bakiye` → Tüm kasa bakiyeleri\n"
            "• `rapor` → Günlük özet\n"
            "• `kur` / `kur TRY` → Döviz kurları\n"
            "• `işlemler` → Son 10 işlem\n\n"
            "🔗 *Müşteri yönetimi:*\n"
            "• `bağla KOD TELEGRAM_ID` → Müşteri bağla\n"
            "• `bağla KOD` → Bağlı ID'yi göster\n"
            "• `çöz KOD` → Bağlantıyı kaldır\n"
            "• `müşteri KOD` → Müşteri bakiyesi"
        )

    # Bakiye
    if cmd in ("b", "bakiye", "bakiyeler", "kasa"):
        from app.services.whatsapp_bot import _bakiye
        return _bakiye(db)

    # Rapor
    if cmd in ("r", "rapor", "özet", "ozet", "günlük", "gunluk"):
        from app.services.whatsapp_bot import _rapor
        return _rapor(db)

    # Kurlar
    if cmd in ("k", "kur", "kurlar", "döviz", "doviz"):
        from app.services.whatsapp_bot import _kurlar
        return _kurlar(db)
    if cmd.startswith("kur "):
        from app.services.whatsapp_bot import _tek_kur
        return _tek_kur(db, cmd.split()[1].upper())

    # Son işlemler
    if cmd in ("i", "işlemler", "islemler", "txn", "son"):
        from app.services.whatsapp_bot import _son_islemler
        return _son_islemler(db)

    # Müşteri bakiyesi (admin olarak)
    if cmd.startswith("müşteri ") or cmd.startswith("musteri "):
        parts = raw.split()
        if len(parts) >= 2:
            return _admin_musteri_bakiye(parts[1].upper(), db)

    # Müşteri bağlama: "bağla KOD TELEGRAM_ID"
    if cmd.startswith("bağla ") or cmd.startswith("bagla "):
        parts = raw.split()
        if len(parts) == 3:
            return _admin_bagla(parts[1].upper(), parts[2], db)
        elif len(parts) == 2:
            return _admin_bagla_goster(parts[1].upper(), db)
        return "❓ Kullanım: `bağla MÜŞTERİ_KODU TELEGRAM_ID`"

    # Bağlantı kaldır: "çöz KOD"
    if cmd.startswith("çöz ") or cmd.startswith("coz "):
        parts = raw.split()
        if len(parts) >= 2:
            return _admin_coz(parts[1].upper(), db)

    # Havale / işlem
    if cmd.startswith("havale") or cmd.startswith("fx ") or cmd.startswith("transfer"):
        from app.services.whatsapp_bot import _islem_kaydet
        return _islem_kaydet(db, raw)

    return (
        "❓ Komut tanınmadı.\n\n"
        "Yardım için `?` yazın."
    )


def _admin_bagla(kod: str, telegram_id: str, db) -> str:
    """Müşteriyi Telegram ID ile eşleştir."""
    from app.models.master import Counterparty
    cp = db.query(Counterparty).filter(Counterparty.code == kod).first()
    if not cp:
        return f"❌ `{kod}` kodlu müşteri bulunamadı."
    cp.telegram_id = telegram_id.lstrip("+")
    db.commit()
    return (
        f"✅ *Bağlandı!*\n\n"
        f"Müşteri: *{cp.name}*\n"
        f"Kod: `{cp.code}`\n"
        f"Telegram ID: `{telegram_id}`\n\n"
        f"Müşteri artık bot üzerinden hesabını görebilir."
    )


def _admin_bagla_goster(kod: str, db) -> str:
    """Mevcut bağlantıyı göster."""
    from app.models.master import Counterparty
    cp = db.query(Counterparty).filter(Counterparty.code == kod).first()
    if not cp:
        return f"❌ `{kod}` kodlu müşteri bulunamadı."
    if cp.telegram_id:
        return f"🔗 *{cp.name}* → Telegram ID: `{cp.telegram_id}`"
    return f"⚠️ *{cp.name}* henüz Telegram'a bağlı değil."


def _admin_coz(kod: str, db) -> str:
    """Müşteri-Telegram bağlantısını kaldır."""
    from app.models.master import Counterparty
    cp = db.query(Counterparty).filter(Counterparty.code == kod).first()
    if not cp:
        return f"❌ `{kod}` kodlu müşteri bulunamadı."
    cp.telegram_id = None
    db.commit()
    return f"✅ *{cp.name}* Telegram bağlantısı kaldırıldı."


def _admin_musteri_bakiye(kod: str, db) -> str:
    """Admin olarak belirli bir müşterinin bakiyesini göster."""
    from app.models.master import Counterparty
    cp = db.query(Counterparty).filter(Counterparty.code == kod).first()
    if not cp:
        return f"❌ `{kod}` kodlu müşteri bulunamadı."
    return _customer_bakiye(cp, db)


# ─────────────────────────────────────────────────────────────────────────────
# Müşteri komutları
# ─────────────────────────────────────────────────────────────────────────────

def _customer_handler(cmd: str, raw: str, cp, db) -> str:
    if cmd in ("?", "yardım", "yardim", "help"):
        return (
            f"👤 *{cp.name}* — Hesap Menüsü\n\n"
            "• `bakiye` → Net bakiyeniz\n"
            "• `işlemler` → Son 10 işleminiz\n"
            "• `kur` → Döviz kurları\n"
            "• `kur TRY` → Belirli kur"
        )

    if cmd in ("b", "bakiye", "hesap", "ekstre"):
        return _customer_bakiye(cp, db)

    if cmd in ("i", "işlemler", "islemler", "txn", "son"):
        return _customer_islemler(cp, db)

    if cmd in ("k", "kur", "kurlar", "döviz", "doviz"):
        from app.services.whatsapp_bot import _kurlar
        return _kurlar(db)
    if cmd.startswith("kur "):
        from app.services.whatsapp_bot import _tek_kur
        return _tek_kur(db, cmd.split()[1].upper())

    return (
        f"❓ Komut tanınmadı.\n"
        f"Yardım için `?` yazın."
    )


def _customer_bakiye(cp, db) -> str:
    """Müşterinin net bakiyesini hesapla (hesap ekstresi son satırı)."""
    from app.models.transaction import (
        Transaction, TransactionLeg, TransactionPnL,
        LegType, TxnType, TxnStatus
    )
    from sqlalchemy.orm import joinedload

    txns = (db.query(Transaction)
              .options(
                  joinedload(Transaction.legs).joinedload(TransactionLeg.currency),
                  joinedload(Transaction.pnl),
              )
              .filter(
                  Transaction.counterparty_id == cp.id,
                  Transaction.status == TxnStatus.completed,
              )
              .order_by(Transaction.txn_date, Transaction.created_at)
              .all())

    if not txns:
        return (
            f"📭 *{cp.name}*\n\n"
            "Henüz tamamlanmış işlem kaydı bulunmuyor."
        )

    FX_TYPES = {"remittance", "fx", "swift"}
    running_usd = ZERO

    for txn in txns:
        ttype = txn.txn_type.value
        pnl   = txn.pnl

        if ttype in FX_TYPES and pnl:
            usd = Decimal(str(pnl.usd_amount or 0))
            # Müşteri SOURCE'da ödedi → bize geldi → alacağımız kapandı → bakiye ↓
            # Müşteri DEST'te aldı → biz verdik → bakiye ↑
            out_leg = next((l for l in txn.legs if l.leg_type == LegType.outgoing), None)
            if out_leg:
                running_usd -= usd   # Bize kaynak verdi → alacak azaldı
            else:
                running_usd += usd
        elif ttype == "deposit":
            # Müşteri para yatırdı → alacağımız azaldı
            out_leg = next((l for l in txn.legs if l.leg_type == LegType.outgoing), None)
            if out_leg and out_leg.currency:
                from app.services.balance import get_usd_rate
                rate = get_usd_rate(db, out_leg.currency.code)
                usd = Decimal(str(out_leg.amount)) / rate if rate else ZERO
                running_usd -= usd
        elif ttype == "withdrawal":
            # Biz müşteriye verdik → alacak arttı
            in_leg = next((l for l in txn.legs if l.leg_type == LegType.incoming), None)
            if in_leg and in_leg.currency:
                from app.services.balance import get_usd_rate
                rate = get_usd_rate(db, in_leg.currency.code)
                usd = Decimal(str(in_leg.amount)) / rate if rate else ZERO
                running_usd += usd

    # Bakiye yönü
    if running_usd > ZERO:
        yon  = "🔴 Alacağımız var"
        sign = "+"
    elif running_usd < ZERO:
        yon  = "🟢 Borçluyuz"
        sign = ""
    else:
        yon  = "✅ Hesap sıfır"
        sign = ""

    return (
        f"💼 *{cp.name}* — Net Bakiye\n"
        f"📅 {date.today():%d.%m.%Y}\n\n"
        f"*{sign}{running_usd:,.2f} USD*\n"
        f"{yon}\n\n"
        f"_Toplam {len(txns)} tamamlanmış işlem_"
    )


def _customer_islemler(cp, db, limit: int = 10) -> str:
    """Müşterinin son işlemlerini listele."""
    from app.models.transaction import Transaction, TransactionPnL, TxnStatus
    from sqlalchemy.orm import joinedload

    txns = (db.query(Transaction)
              .options(joinedload(Transaction.pnl))
              .filter(Transaction.counterparty_id == cp.id)
              .order_by(Transaction.created_at.desc())
              .limit(limit)
              .all())

    if not txns:
        return f"📭 *{cp.name}*\n\nHenüz işlem kaydı bulunmuyor."

    STATUS_ICON = {
        "completed": "✅", "pending": "⏳", "cancelled": "❌",
    }
    TYPE_TR = {
        "remittance": "Havale", "fx": "Döviz", "swift": "SWIFT",
        "deposit": "Yatırma", "withdrawal": "Çekme",
        "internal_transfer": "Transfer",
    }

    lines = [f"📋 *{cp.name}* — Son {limit} İşlem", ""]
    for t in txns:
        pnl  = t.pnl
        usd  = f"${Decimal(str(pnl.usd_amount)):,.2f}" if pnl and pnl.usd_amount else "—"
        icon = STATUS_ICON.get(t.status.value, "•")
        typ  = TYPE_TR.get(t.txn_type.value, t.txn_type.value)
        dt   = t.created_at.strftime("%d.%m.%Y %H:%M") if t.created_at else "—"
        lines.append(f"{icon} *{t.txn_number}*")
        lines.append(f"   {dt} | {typ} | {usd}")
        lines.append("")

    return "\n".join(lines).rstrip()


# ─────────────────────────────────────────────────────────────────────────────
# Bilinmeyen kullanıcı — sadece bağlanma
# ─────────────────────────────────────────────────────────────────────────────

def _unknown_user_handler(cmd: str, raw: str, uid: int, db) -> str:
    if cmd.startswith("bağla ") or cmd.startswith("bagla "):
        parts = raw.split()
        if len(parts) >= 2:
            return _musteri_kendini_bagla(parts[1].upper(), uid, db)

    return (
        "🔒 Hesabınıza erişmek için müşteri kodunuzu girin:\n\n"
        "`bağla MUSTERI_KODUNUZ`\n\n"
        "_Müşteri kodunuzu operatörünüzden öğrenebilirsiniz._"
    )


def _musteri_kendini_bagla(kod: str, uid: int, db) -> str:
    """Müşteri kendi kodunu yazarak bağlanır."""
    from app.models.master import Counterparty
    cp = db.query(Counterparty).filter(
        Counterparty.code == kod,
        Counterparty.is_active == True,
    ).first()
    if not cp:
        return f"❌ `{kod}` kodu bulunamadı. Lütfen operatörünüzle iletişime geçin."
    if cp.telegram_id and cp.telegram_id != str(uid):
        return "⚠️ Bu müşteri kodu zaten başka bir hesaba bağlı. Operatörünüzle iletişime geçin."
    cp.telegram_id = str(uid)
    db.commit()
    return (
        f"✅ *Bağlantı kuruldu!*\n\n"
        f"Hoş geldiniz, *{cp.name}*!\n\n"
        f"Artık hesabınıza erişebilirsiniz:\n"
        f"• `bakiye` → Net bakiyeniz\n"
        f"• `işlemler` → Son işlemleriniz\n"
        f"• `kur` → Döviz kurları"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Bildirim gönderici
# ─────────────────────────────────────────────────────────────────────────────

async def send_notification(chat_id: int | str, text: str) -> bool:
    if _app_instance is None:
        logger.error("Telegram botu henüz başlamadı")
        return False
    try:
        await _app_instance.bot.send_message(
            chat_id=chat_id, text=text, parse_mode="Markdown",
        )
        return True
    except Exception as exc:
        logger.error(f"Telegram bildirim hatası: {exc}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Bot başlatıcı
# ─────────────────────────────────────────────────────────────────────────────

def start_bot(token: str):
    global _bot_thread

    if _bot_thread and _bot_thread.is_alive():
        logger.info("Telegram bot zaten çalışıyor")
        return

    def _run():
        global _app_instance

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def _async_main():
            global _app_instance
            import httpx

            app = Application.builder().token(token).updater(None).build()
            app.add_handler(CommandHandler("start", _start))
            app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _handle_text))

            await app.initialize()
            await app.start()
            _app_instance = app

            logger.info("✅ Telegram bot başladı (polling)")
            print("✅ Telegram bot başladı")

            offset = None
            while True:
                try:
                    params = {"timeout": 30, "allowed_updates": ["message"]}
                    if offset is not None:
                        params["offset"] = offset

                    async with httpx.AsyncClient(timeout=35) as client:
                        resp = await client.get(
                            f"https://api.telegram.org/bot{token}/getUpdates",
                            params=params,
                        )
                        data = resp.json()

                    if not data.get("ok"):
                        logger.error(f"getUpdates hata: {data}")
                        await asyncio.sleep(5)
                        continue

                    from telegram import Update as TGUpdate
                    for upd_data in data.get("result", []):
                        offset = upd_data["update_id"] + 1
                        upd = TGUpdate.de_json(upd_data, app.bot)
                        await app.process_update(upd)

                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    logger.error(f"Polling hata: {exc}")
                    await asyncio.sleep(5)

            await app.stop()
            await app.shutdown()

        loop.run_until_complete(_async_main())

    _bot_thread = threading.Thread(target=_run, daemon=True, name="telegram-bot")
    _bot_thread.start()
    logger.info(f"Telegram bot thread başlatıldı")
