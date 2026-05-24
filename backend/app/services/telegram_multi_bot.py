"""
Çok Şirketli Telegram Bot Yöneticisi
======================================
- Her şirketin kendi bot token'ı vardır (companies.telegram_bot_token)
- Her şirket için ayrı polling thread başlatılır
- Tüm sorgular company_id ile izole edilir

Kullanıcı tipleri:
  ADMİN   → users.telegram_id eşleşmesi  → şirketinin tüm verisi
  MÜŞTERİ → counterparties.telegram_id   → sadece kendi ekstresi

Bağlanma akışı (KOD bazlı — güvenli):
  Admin   : uygulamadan kendi Telegram ID'sini girer
  Müşteri : bota "bağla MÜŞTERİ_KODU" yazar
            (kodu admin iletir, sadece kod sahibi bağlanır)
"""
import asyncio
import logging
import threading
from decimal import Decimal
from datetime import date, datetime, timedelta
from typing import Dict, Optional

from telegram import Update, ReplyKeyboardMarkup, KeyboardButton
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

logger = logging.getLogger(__name__)

# company_id → Thread
_running_bots: Dict[str, threading.Thread] = {}

ZERO = Decimal("0")

# Telefon doğrulama bekleyen kullanıcılar: {telegram_id: bekleme_durumu}
# Bu özellik kaldırıldı (güvenlik), sadece kod bazlı bağlanma

# ─────────────────────────────────────────────────────────────────────────────
# Kullanıcı tespiti
# ─────────────────────────────────────────────────────────────────────────────

def _find_admin(telegram_id: int, company_id, db):
    """Telegram ID ile şirket yöneticisini bul."""
    from app.models.user import User, UserRole
    return (db.query(User)
              .filter(
                  User.telegram_id == str(telegram_id),
                  User.company_id == company_id,
                  User.is_active == True,
              )
              .first())


def _find_customer(telegram_id: int, company_id, db):
    """Müşteri erişimi devre dışı — sadece adminler kullanabilir."""
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Handler fabrikası — her şirket için ayrı closure
# ─────────────────────────────────────────────────────────────────────────────

def make_handlers(company_id, company_name: str):
    """Her şirkete özel handler fonksiyonları üretir."""

    async def on_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        uid = update.effective_user.id
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            admin = _find_admin(uid, company_id, db)
            if admin:
                await update.message.reply_text(
                    f"👋 *{company_name} — Yönetici Paneli*\n\n"
                    f"Hoş geldiniz, *{admin.name}*!\n\n"
                    "📊 `bakiye` · `rapor` · `kur` · `işlemler`\n"
                    "ℹ️ `?` → Tüm komutlar",
                    parse_mode="Markdown",
                )
            else:
                await update.message.reply_text(
                    "🔐 *Safiron Hawale — Yönetici Botu*\n\n"
                    "Hesabınız henüz bu bota bağlı değil.\n\n"
                    "Bağlanmak için:\n"
                    "1. Uygulamada *Kullanıcılar* sayfasını açın\n"
                    "2. Kendi satırınızdaki pini kopyalayın\n"
                    "3. Aşağıdaki komutu gönderin:\n\n"
                    "`bağla PİNİNİZ`\n\n"
                    "_Örnek: `bağla SAF-7K2M`_",
                    parse_mode="Markdown",
                )
        finally:
            db.close()

    async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        uid      = update.effective_user.id
        username = update.effective_user.username or str(uid)
        text     = (update.message.text or "").strip()
        cmd      = text.lower()

        logger.info(f"[{company_name}] @{username}: {text[:60]!r}")

        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            admin = _find_admin(uid, company_id, db)
            if admin:
                reply = _admin_cmd(cmd, text, company_id, db)
            elif cmd.startswith("bağla ") or cmd.startswith("bagla "):
                # Bağlanmamış yönetici pin ile bağlanmaya çalışıyor
                parts = text.split()
                if len(parts) >= 2:
                    reply = _admin_pin_bagla(parts[1].upper(), uid, company_id, db)
                else:
                    reply = "❓ Kullanım: `bağla PİNİNİZ`\n\nPininizi uygulamanızdan kopyalayın."
            else:
                reply = (
                    "🔐 *Hesabınız henüz bağlı değil.*\n\n"
                    "Telegram hesabınızı bağlamak için:\n"
                    "1. Uygulamada *Kullanıcılar* sayfasını açın\n"
                    "2. Kendi satırınızdaki kodu kopyalayın\n"
                    "3. Buraya yazın:\n\n"
                    "`bağla PİNİNİZ`\n\n"
                    "_Örnek: `bağla SAF-7K2M`_"
                )
        except Exception as exc:
            logger.exception(f"[{company_name}] Hata: {exc}")
            reply = "❌ Sunucu hatası. Lütfen tekrar deneyin."
        finally:
            db.close()

        for chunk in [reply[i:i+4096] for i in range(0, len(reply), 4096)]:
            await update.message.reply_text(chunk, parse_mode="Markdown")

    return on_start, on_message


# ─────────────────────────────────────────────────────────────────────────────
# Admin komutları
# ─────────────────────────────────────────────────────────────────────────────

def _admin_cmd(cmd: str, raw: str, company_id, db) -> str:
    if cmd in ("?", "yardım", "yardim"):
        return (
            "🔧 *Yönetici Komutları*\n\n"
            "• `bakiye` → Tüm kasa bakiyeleri\n"
            "• `rapor` → Günlük özet\n"
            "• `kur` → Tüm döviz kurları\n"
            "• `kur TRY` → Belirli kur\n"
            "• `işlemler` → Son 10 işlem\n"
            "• `müşteri KOD` → Müşteri bakiyesi\n"
            "• `müşteriler` → Müşteri listesi"
        )

    if cmd in ("b", "bakiye"):
        return _q_bakiye(company_id, db)
    if cmd in ("r", "rapor"):
        return _q_rapor(company_id, db)
    if cmd in ("k", "kur"):
        return _q_kurlar(db)
    if cmd.startswith("kur "):
        return _q_tek_kur(db, cmd.split()[1].upper())
    if cmd in ("i", "işlemler", "islemler"):
        return _q_son_islemler(company_id, db)

    if cmd in ("müşteriler", "musteriler"):
        return _q_musteri_listesi(company_id, db)

    if cmd.startswith("müşteri ") or cmd.startswith("musteri "):
        kod = raw.split()[1].upper()
        return _q_musteri_bakiye(kod, company_id, db)

    if cmd.startswith("havale") or cmd.startswith("fx "):
        from app.services.whatsapp_bot import _islem_kaydet
        return _islem_kaydet(db, raw)

    return "❓ Komut tanınmadı. Yardım: `?`"


# ─────────────────────────────────────────────────────────────────────────────
# Müşteri komutları
# ─────────────────────────────────────────────────────────────────────────────

def _customer_cmd(cmd: str, company_id, cp, db) -> str:
    if cmd in ("?", "yardım", "yardim"):
        return (
            f"👤 *{cp.name}* — Menü\n\n"
            "• `bakiye` → Net bakiyeniz\n"
            "• `işlemler` → Son 10 işleminiz\n"
            "• `kur` → Döviz kurları"
        )
    if cmd in ("b", "bakiye", "hesap"):
        return _q_cp_bakiye(cp, db)
    if cmd in ("i", "işlemler", "islemler"):
        return _q_cp_islemler(cp, db)
    if cmd in ("k", "kur"):
        return _q_kurlar(db)
    if cmd.startswith("kur "):
        return _q_tek_kur(db, cmd.split()[1].upper())

    return "❓ Komut tanınmadı. Yardım: `?`"


# ─────────────────────────────────────────────────────────────────────────────
# Misafir (bağlanmamış) — sadece "bağla KOD" kabul edilir
# ─────────────────────────────────────────────────────────────────────────────

def _guest_cmd(cmd: str, raw: str, uid: int, company_id, db) -> str:
    if cmd.startswith("bağla ") or cmd.startswith("bagla "):
        parts = raw.split()
        if len(parts) >= 2:
            return _musteri_baglan(parts[1].upper(), uid, company_id, db)

    return (
        "🔒 Hesabınıza erişmek için müşteri kodunuzu yazın:\n\n"
        "`bağla MÜŞTERİ_KODUNUZ`\n\n"
        "_Kodu operatörünüzden alın._"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Bağlama / çözme işlemleri
# ─────────────────────────────────────────────────────────────────────────────

def _musteri_baglan(pin: str, uid: int, company_id, db) -> str:
    """Müşteri bot PIN'i ile kendi hesabına bağlanır."""
    from app.models.master import Counterparty
    # PIN büyük/küçük harf duyarsız, tire opsiyonel
    pin_normalized = pin.upper().replace(" ", "")

    cp = db.query(Counterparty).filter(
        Counterparty.bot_pin == pin_normalized,
        Counterparty.company_id == company_id,
        Counterparty.is_active == True,
    ).first()

    if not cp:
        return (
            "❌ Geçersiz kod.\n\n"
            "_Operatörünüzden size iletilen kodu kontrol edin._\n"
            "_Örnek: `bağla SAF-7K2M`_"
        )
    if cp.telegram_id and cp.telegram_id != str(uid):
        return "⚠️ Bu kod zaten kullanımda. Operatörünüzle iletişime geçin."

    cp.telegram_id = str(uid)
    db.commit()
    return (
        f"✅ *Hesabınıza bağlandınız!*\n\n"
        f"Hoş geldiniz, *{cp.name}*!\n\n"
        "• `bakiye` → Net bakiyeniz\n"
        "• `işlemler` → Son işlemleriniz\n"
        "• `kur` → Döviz kurları\n\n"
        "_Yardım için `?` yazın._"
    )


def _admin_pin_bagla(pin: str, uid: int, company_id, db) -> str:
    """Yönetici bot_pin ile kendi Telegram hesabını bağlar."""
    from app.models.user import User
    pin_normalized = pin.upper().strip()

    user = db.query(User).filter(
        User.bot_pin == pin_normalized,
        User.company_id == company_id,
        User.is_active == True,
    ).first()

    if not user:
        return (
            "❌ Geçersiz pin.\n\n"
            "_Uygulamadaki Kullanıcılar sayfasından size ait pini kopyalayın._\n"
            "_Örnek: `bağla SAF-7K2M`_"
        )

    # Başka Telegram hesabı bağlıysa uyar
    if user.telegram_id and user.telegram_id != str(uid):
        return (
            "⚠️ Bu pin zaten başka bir Telegram hesabına bağlı.\n"
            "_Yöneticinizle iletişime geçin._"
        )

    user.telegram_id = str(uid)
    db.commit()
    return (
        f"✅ *Hesabınıza bağlandınız!*\n\n"
        f"Hoş geldiniz, *{user.name}*! 👋\n\n"
        "📊 `bakiye` · `rapor` · `kur` · `işlemler`\n"
        "ℹ️ Tüm komutlar için `?` yazın."
    )


def _admin_bagla(kod: str, tg_id: str, company_id, db) -> str:
    """Admin bir müşteriyi belirli Telegram ID ile bağlar."""
    from app.models.master import Counterparty
    cp = db.query(Counterparty).filter(
        Counterparty.code == kod,
        Counterparty.company_id == company_id,
    ).first()
    if not cp:
        return f"❌ `{kod}` kodu bulunamadı."
    cp.telegram_id = tg_id.lstrip("+")
    db.commit()
    return f"✅ *{cp.name}* → Telegram `{tg_id}` bağlandı."


def _admin_bagla_goster(kod: str, company_id, db) -> str:
    from app.models.master import Counterparty
    cp = db.query(Counterparty).filter(
        Counterparty.code == kod,
        Counterparty.company_id == company_id,
    ).first()
    if not cp:
        return f"❌ `{kod}` bulunamadı."
    return (f"🔗 *{cp.name}*: `{cp.telegram_id}`"
            if cp.telegram_id else f"⚠️ *{cp.name}* henüz bağlı değil.")


def _admin_coz(kod: str, company_id, db) -> str:
    from app.models.master import Counterparty
    cp = db.query(Counterparty).filter(
        Counterparty.code == kod,
        Counterparty.company_id == company_id,
    ).first()
    if not cp:
        return f"❌ `{kod}` bulunamadı."
    cp.telegram_id = None
    db.commit()
    return f"✅ *{cp.name}* bağlantısı kaldırıldı."


# ─────────────────────────────────────────────────────────────────────────────
# Veri sorguları — company_id filtreli
# ─────────────────────────────────────────────────────────────────────────────

def _q_bakiye(company_id, db) -> str:
    from app.models.master import Account
    from app.services.balance import get_all_balances, get_all_usd_rates
    from sqlalchemy.orm import joinedload

    accounts = (db.query(Account)
                  .options(joinedload(Account.location), joinedload(Account.currency))
                  .filter(Account.is_active == True, Account.company_id == company_id)
                  .all())
    if not accounts:
        return "📭 Aktif hesap bulunamadı."

    balances  = get_all_balances(db)
    usd_rates = get_all_usd_rates(db)

    lines = [f"💰 *Kasa Bakiyeleri*", f"📅 {date.today():%d.%m.%Y}", ""]
    total_usd = ZERO
    cur_loc   = None

    for acc in sorted(accounts, key=lambda a: (
        a.location.name_tr if a.location else "",
        a.currency.code    if a.currency  else ""
    )):
        loc     = acc.location.name_tr if acc.location else "—"
        cur     = acc.currency.code    if acc.currency  else "USD"
        balance = balances.get(str(acc.id), ZERO)
        rate    = usd_rates.get(cur, Decimal("1"))
        usd     = (balance / rate).quantize(Decimal("0.01")) if rate else ZERO
        total_usd += usd

        if loc != cur_loc:
            cur_loc = loc
            lines.append(f"\n📍 *{loc}*")
        sign = "+" if balance >= 0 else ""
        lines.append(f"  {cur}: {sign}{balance:,.2f}  ≈ ${usd:,.2f}")

    lines += ["", f"💵 *Toplam: ${total_usd:,.2f}*"]
    return "\n".join(lines)


def _q_rapor(company_id, db) -> str:
    from app.models.transaction import Transaction, TransactionPnL, TxnStatus
    today = date.today()
    txns = (db.query(Transaction)
              .filter(
                  Transaction.company_id == company_id,
                  Transaction.status == TxnStatus.completed,
                  Transaction.created_at >= datetime(today.year, today.month, today.day),
              ).all())

    total_usd = ZERO
    total_pnl = ZERO
    if txns:
        ids  = [t.id for t in txns]
        pnls = db.query(TransactionPnL).filter(TransactionPnL.transaction_id.in_(ids)).all()
        for p in pnls:
            total_usd += Decimal(str(p.usd_amount   or 0))
            total_pnl += Decimal(str(p.net_pnl_usd  or 0))

    from sqlalchemy import func
    pending = (db.query(func.count(Transaction.id))
                 .filter(Transaction.company_id == company_id,
                         Transaction.status == TxnStatus.pending)
                 .scalar() or 0)

    lines = [
        f"📊 *Günlük Rapor — {today:%d.%m.%Y}*", "",
        f"📦 Tamamlanan: *{len(txns)}*",
        f"💵 Hacim:      *${total_usd:,.2f}*",
        f"📈 Kâr (PnL):  *${total_pnl:,.4f}*",
    ]
    if pending:
        lines.append(f"⏳ Bekleyen:   *{pending}*")
    return "\n".join(lines)


def _q_kurlar(db) -> str:
    from sqlalchemy import text
    rows = db.execute(text("""
        SELECT e1.currency_code, e1.rate_per_usd
        FROM exchange_rates e1
        INNER JOIN (
            SELECT currency_code, MAX(date) as max_date
            FROM exchange_rates GROUP BY currency_code
        ) e2 ON e1.currency_code=e2.currency_code AND e1.date=e2.max_date
        ORDER BY e1.currency_code
    """)).fetchall()
    if not rows:
        return "📭 Kur kaydı bulunamadı."
    lines = ["💱 *Döviz Kurları* (1 USD = ?)"]
    for r in rows:
        lines.append(f"  {r.currency_code}: {Decimal(str(r.rate_per_usd)):,.4f}")
    return "\n".join(lines)


def _q_tek_kur(db, currency: str) -> str:
    from app.services.balance import get_usd_rate
    rate = get_usd_rate(db, currency)
    if rate == Decimal("1") and currency != "USD":
        return f"❓ {currency} kuru bulunamadı."
    return f"💱 1 USD = *{rate:,.4f} {currency}*"


def _q_son_islemler(company_id, db, limit: int = 10) -> str:
    from app.models.transaction import Transaction, TransactionPnL, TxnStatus
    from sqlalchemy.orm import joinedload
    txns = (db.query(Transaction)
              .options(joinedload(Transaction.counterparty))
              .filter(Transaction.company_id == company_id)
              .order_by(Transaction.created_at.desc())
              .limit(limit).all())
    if not txns:
        return "📭 İşlem bulunamadı."

    ids     = [t.id for t in txns]
    pnl_map = {p.transaction_id: p
               for p in db.query(TransactionPnL)
                          .filter(TransactionPnL.transaction_id.in_(ids)).all()}

    STATUS = {"completed": "✅", "pending": "⏳", "cancelled": "❌"}
    lines  = [f"📋 *Son {limit} İşlem*", ""]
    for t in txns:
        p   = pnl_map.get(t.id)
        usd = f"${Decimal(str(p.usd_amount)):,.2f}" if p and p.usd_amount else "—"
        cp  = t.counterparty.name if t.counterparty else "—"
        dt  = t.created_at.strftime("%d.%m %H:%M") if t.created_at else "—"
        lines.append(f"{STATUS.get(t.status.value,'•')} *{t.txn_number}* | {dt}")
        lines.append(f"   {t.txn_type.value} · {usd} · {cp}")
        lines.append("")
    return "\n".join(lines).rstrip()


def _q_musteri_listesi(company_id, db) -> str:
    from app.models.master import Counterparty, CounterpartyType
    cps = (db.query(Counterparty)
             .filter(
                 Counterparty.company_id == company_id,
                 Counterparty.is_active == True,
                 Counterparty.type.in_([CounterpartyType.customer, CounterpartyType.both]),
             )
             .order_by(Counterparty.name)
             .all())
    if not cps:
        return "📭 Kayıtlı müşteri yok."
    lines = [f"👥 *Müşteriler* ({len(cps)})", ""]
    for cp in cps:
        lines.append(f"• `{cp.code}` — {cp.name}")
    return "\n".join(lines)


def _q_musteri_bakiye(kod: str, company_id, db) -> str:
    from app.models.master import Counterparty
    cp = db.query(Counterparty).filter(
        Counterparty.code == kod,
        Counterparty.company_id == company_id,
    ).first()
    if not cp:
        return f"❌ `{kod}` bulunamadı."
    return _q_cp_bakiye(cp, db)


def _q_cp_bakiye(cp, db) -> str:
    from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, LegType, TxnStatus
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
        return f"📭 *{cp.name}*\n\nTamamlanmış işlem bulunamadı."

    FX = {"remittance", "fx", "swift"}
    running = ZERO

    for txn in txns:
        ttype = txn.txn_type.value
        pnl   = txn.pnl
        if ttype in FX and pnl:
            usd     = Decimal(str(pnl.usd_amount or 0))
            out_leg = next((l for l in txn.legs if l.leg_type == LegType.outgoing), None)
            running = running - usd if out_leg else running + usd
        elif ttype == "deposit":
            out_leg = next((l for l in txn.legs if l.leg_type == LegType.outgoing), None)
            if out_leg and out_leg.currency:
                from app.services.balance import get_usd_rate
                r = get_usd_rate(db, out_leg.currency.code)
                running -= Decimal(str(out_leg.amount)) / r if r else ZERO
        elif ttype == "withdrawal":
            in_leg = next((l for l in txn.legs if l.leg_type == LegType.incoming), None)
            if in_leg and in_leg.currency:
                from app.services.balance import get_usd_rate
                r = get_usd_rate(db, in_leg.currency.code)
                running += Decimal(str(in_leg.amount)) / r if r else ZERO

    if running > ZERO:
        durum = "🔴 Bizden alacaklı"
    elif running < ZERO:
        durum = "🟢 Bize borçlu"
    else:
        durum = "✅ Hesap sıfır"

    sign = "+" if running > 0 else ""
    return (
        f"💼 *{cp.name}*\n"
        f"📅 {date.today():%d.%m.%Y}\n\n"
        f"*{sign}{running:,.2f} USD*\n"
        f"{durum}\n\n"
        f"_{len(txns)} tamamlanmış işlem_"
    )


def _q_cp_islemler(cp, db, limit: int = 10) -> str:
    from app.models.transaction import Transaction, TransactionPnL
    from sqlalchemy.orm import joinedload
    txns = (db.query(Transaction)
              .options(joinedload(Transaction.pnl))
              .filter(Transaction.counterparty_id == cp.id)
              .order_by(Transaction.created_at.desc())
              .limit(limit).all())
    if not txns:
        return f"📭 *{cp.name}*\n\nHenüz işlem kaydı yok."

    STATUS = {"completed": "✅", "pending": "⏳", "cancelled": "❌"}
    TYPE_TR = {"remittance": "Havale", "fx": "Döviz", "deposit": "Yatırma",
               "withdrawal": "Çekme", "swift": "SWIFT", "internal_transfer": "Transfer"}
    lines = [f"📋 *{cp.name}* — Son {limit} İşlem", ""]
    for t in txns:
        p    = t.pnl
        usd  = f"${Decimal(str(p.usd_amount)):,.2f}" if p and p.usd_amount else "—"
        icon = STATUS.get(t.status.value, "•")
        typ  = TYPE_TR.get(t.txn_type.value, t.txn_type.value)
        dt   = t.created_at.strftime("%d.%m.%Y %H:%M") if t.created_at else "—"
        lines.append(f"{icon} *{t.txn_number}*")
        lines.append(f"   {dt} | {typ} | {usd}")
        lines.append("")
    return "\n".join(lines).rstrip()


# ─────────────────────────────────────────────────────────────────────────────
# Bot thread başlatıcı
# ─────────────────────────────────────────────────────────────────────────────

def start_company_bot(company_id: str, company_name: str, token: str):
    """Belirli bir şirket için Telegram bot thread'i başlat."""
    if company_id in _running_bots and _running_bots[company_id].is_alive():
        logger.info(f"Bot zaten çalışıyor: {company_name}")
        return

    on_start, on_message = make_handlers(company_id, company_name)

    def _run():
        import httpx
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def _poll():
            app = Application.builder().token(token).updater(None).build()
            app.add_handler(CommandHandler("start", on_start))
            app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
            await app.initialize()
            await app.start()

            logger.info(f"✅ Bot başladı: {company_name}")
            print(f"✅ Telegram bot: {company_name}")

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
                    if data.get("ok"):
                        from telegram import Update as TGUpdate
                        for upd_data in data.get("result", []):
                            offset = upd_data["update_id"] + 1
                            upd = TGUpdate.de_json(upd_data, app.bot)
                            await app.process_update(upd)
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    logger.error(f"[{company_name}] Polling hata: {exc}")
                    await asyncio.sleep(5)

            await app.stop()
            await app.shutdown()

        loop.run_until_complete(_poll())

    t = threading.Thread(target=_run, daemon=True, name=f"tg-{company_name}")
    t.start()
    _running_bots[str(company_id)] = t
    logger.info(f"Bot thread başlatıldı: {company_name}")


def start_all_bots():
    """Startup'ta tüm şirketlerin botlarını başlat."""
    from app.core.database import SessionLocal
    from app.models.master import Company

    db = SessionLocal()
    try:
        companies = db.query(Company).filter(
            Company.is_active == True,
            Company.telegram_bot_token.isnot(None),
        ).all()

        if not companies:
            print("ℹ️  Telegram bot token'ı tanımlı şirket yok")
            return

        for co in companies:
            if co.telegram_bot_token and co.telegram_bot_token.strip():
                start_company_bot(str(co.id), co.name, co.telegram_bot_token.strip())
    finally:
        db.close()
