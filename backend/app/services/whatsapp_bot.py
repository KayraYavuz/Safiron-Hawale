"""
WhatsApp Bot Komut Motoru
Kullanıcıdan gelen mesajı parse eder, veritabanından veri çeker,
formatlanmış yanıt döner.

Desteklenen komutlar (Türkçe):
  bakiye / b          → Tüm kasa bakiyeleri
  rapor / r           → Bugünkü özet rapor
  kur / k             → Tüm döviz kurları
  kur USD             → Belirli para birimi kuru
  işlemler / i        → Son 10 işlem
  yardım / ?          → Komut listesi

  İşlem kayıt (AI destekli):
  "1000 dolar ali'den mehmet'e havale" → Groq ile parse + kayıt
"""
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Tuple

logger = logging.getLogger(__name__)

YARDIM = """🤖 *Safiron Global Solutions*

📊 *Sorgulama:*
• `bakiye` → Kasa bakiyeleri
• `rapor` → Günlük özet
• `kur` → Tüm kurlar
• `kur USD` → Belirli kur
• `işlemler` → Son 10 işlem

✅ *İşlem Kayıt:*
• `havale 1000 USD alimirza karimov → mustafa demir`
• `fx 5000 TRY → USD`

ℹ️  Yardım için `?` yazın"""


def handle_message(sender: str, text: str, db, company_id=None) -> str:
    """
    Gelen mesajı işle, yanıt metnini döndür.
    sender: WhatsApp numarası (örn: "905551234567")
    db: SQLAlchemy Session
    company_id: mesajı alan WhatsApp numarasından çözülen şirket; None ise
                tek-tenant fallback (_company_id) kullanılır.
    """
    cmd = text.strip().lower()
    cid = company_id or _company_id(db)

    # ── Yardım ──────────────────────────────────────────────────────────────
    if cmd in ("?", "yardim", "yardım", "help", "/start"):
        return YARDIM

    # ── Bakiye ──────────────────────────────────────────────────────────────
    if cmd in ("b", "bakiye", "bakiyeler", "kasa"):
        return _bakiye(db, cid)

    # ── Günlük rapor ────────────────────────────────────────────────────────
    if cmd in ("r", "rapor", "özet", "ozet", "gunluk", "günlük"):
        return _rapor(db, cid)

    # ── Döviz kuru ──────────────────────────────────────────────────────────
    if cmd in ("k", "kur", "kurlar", "fx", "doviz", "döviz"):
        return _kurlar(db)

    if cmd.startswith("kur "):
        para_birimi = cmd.split()[1].upper()
        return _tek_kur(db, para_birimi)

    # ── Son işlemler ────────────────────────────────────────────────────────
    if cmd in ("i", "işlemler", "islemler", "txn", "son"):
        return _son_islemler(db, company_id=cid)

    # ── İşlem kayıt (AI destekli) ───────────────────────────────────────────
    if cmd.startswith("havale") or cmd.startswith("fx ") or cmd.startswith("transfer"):
        return _islem_kaydet(db, text.strip())

    # ── Tanınmayan komut ────────────────────────────────────────────────────
    return (
        "❓ Komut tanınmadı.\n\n"
        "Yardım için `?` yazın.\n"
        "Örnek: `bakiye`, `rapor`, `kur`, `işlemler`"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Komut İşleyiciler
# ─────────────────────────────────────────────────────────────────────────────

def _company_id(db):
    """WhatsApp serves a single business (one shared number), so resolve the
    company it belongs to — the SAFIRON default, falling back to the first
    company — and scope all data queries to it. Without this the bot would
    expose every tenant's balances/reports to any allowed number."""
    from app.models.master import Company
    co = db.query(Company).filter(Company.code == "SAFIRON").first() or db.query(Company).first()
    return co.id if co else None


def _bakiye(db, company_id=None) -> str:
    """Şirketin aktif kasa bakiyelerini getir."""
    try:
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

        lines = ["💰 *Kasa Bakiyeleri*", f"📅 {date.today():%d.%m.%Y}", ""]

        total_usd = Decimal("0")
        current_location = None

        for acc in sorted(accounts, key=lambda a: (
            a.location.name_tr if a.location else "",
            a.currency.code if a.currency else ""
        )):
            loc = acc.location.name_tr if acc.location else "—"
            cur = acc.currency.code if acc.currency else "USD"
            acc_id  = str(acc.id)
            balance = balances.get(acc_id, Decimal("0"))
            rate    = usd_rates.get(cur, Decimal("1"))
            bal_usd = (balance / rate).quantize(Decimal("0.01")) if rate else Decimal("0")
            total_usd += bal_usd

            if loc != current_location:
                current_location = loc
                lines.append(f"\n📍 *{loc}*")

            sign = "+" if balance >= 0 else ""
            lines.append(f"  {cur}: {sign}{balance:,.2f}  ≈ ${bal_usd:,.2f}")

        lines.append("")
        lines.append(f"💵 *Toplam USD: ${total_usd:,.2f}*")
        return "\n".join(lines)

    except Exception as exc:
        logger.exception("_bakiye hata")
        return f"❌ Bakiye alınamadı: {exc}"


def _rapor(db, company_id=None) -> str:
    """Bugünkü işlem özeti."""
    try:
        from app.models.transaction import Transaction, TransactionPnL, TxnStatus
        from sqlalchemy import func

        today = date.today()

        # Bugünkü işlem sayısı ve toplamları
        txns = (db.query(Transaction)
                .filter(
                    Transaction.created_at >= datetime(today.year, today.month, today.day),
                    Transaction.status == TxnStatus.completed,
                    Transaction.company_id == company_id,
                )
                .all())

        total_count = len(txns)
        total_usd   = Decimal("0")
        total_pnl   = Decimal("0")

        if txns:
            txn_ids = [t.id for t in txns]
            pnls = db.query(TransactionPnL).filter(TransactionPnL.transaction_id.in_(txn_ids)).all()
            for p in pnls:
                if p.usd_amount:
                    total_usd += Decimal(str(p.usd_amount))
                if p.net_pnl_usd:
                    total_pnl += Decimal(str(p.net_pnl_usd))

        lines = [
            f"📊 *Günlük Rapor — {today:%d.%m.%Y}*",
            "",
            f"📦 Tamamlanan işlem: *{total_count}*",
            f"💵 Toplam hacim:     *${total_usd:,.2f}*",
            f"📈 Toplam kâr (PnL): *${total_pnl:,.4f}*",
        ]

        # Bekleyen işlemler
        pending = (db.query(func.count(Transaction.id))
                   .filter(Transaction.status == TxnStatus.pending,
                           Transaction.company_id == company_id)
                   .scalar() or 0)
        if pending:
            lines.append(f"⏳ Bekleyen işlem:    *{pending}*")

        return "\n".join(lines)

    except Exception as exc:
        logger.exception("_rapor hata")
        return f"❌ Rapor alınamadı: {exc}"


def _kurlar(db) -> str:
    """Tüm döviz kurlarını listele."""
    try:
        from app.models.transaction import ExchangeRate
        from sqlalchemy import text

        rows = db.execute(text("""
            SELECT e1.currency_code, e1.rate_per_usd, e1.date
            FROM exchange_rates e1
            INNER JOIN (
                SELECT currency_code, MAX(date) as max_date
                FROM exchange_rates
                GROUP BY currency_code
            ) e2 ON e1.currency_code = e2.currency_code AND e1.date = e2.max_date
            ORDER BY e1.currency_code
        """)).fetchall()

        if not rows:
            return "📭 Kur kaydı bulunamadı."

        lines = ["💱 *Döviz Kurları* (1 USD = ?)"]
        for r in rows:
            rate = Decimal(str(r.rate_per_usd))
            lines.append(f"  {r.currency_code}: {rate:,.4f}")

        return "\n".join(lines)

    except Exception as exc:
        logger.exception("_kurlar hata")
        return f"❌ Kurlar alınamadı: {exc}"


def _tek_kur(db, currency: str) -> str:
    """Belirli bir para biriminin kurunu getir."""
    try:
        from app.services.balance import get_usd_rate
        rate = get_usd_rate(db, currency)
        if rate == Decimal("1") and currency != "USD":
            return f"❓ {currency} kuru bulunamadı."
        return f"💱 1 USD = *{rate:,.4f} {currency}*"
    except Exception as exc:
        return f"❌ Kur alınamadı: {exc}"


def _son_islemler(db, limit: int = 10, company_id=None) -> str:
    """Son N işlemi listele."""
    try:
        from app.models.transaction import Transaction, TransactionPnL, TxnStatus
        from sqlalchemy.orm import joinedload

        txns = (db.query(Transaction)
                .options(joinedload(Transaction.counterparty))
                .filter(Transaction.company_id == company_id)
                .order_by(Transaction.created_at.desc())
                .limit(limit)
                .all())

        if not txns:
            return "📭 İşlem kaydı bulunamadı."

        # PnL toplu yükle
        ids = [t.id for t in txns]
        pnl_map = {
            p.transaction_id: p
            for p in db.query(TransactionPnL).filter(TransactionPnL.transaction_id.in_(ids)).all()
        }

        STATUS_ICON = {
            TxnStatus.completed: "✅",
            TxnStatus.pending:   "⏳",
            TxnStatus.cancelled: "❌",
        }

        lines = [f"📋 *Son {limit} İşlem*", ""]
        for t in txns:
            pnl  = pnl_map.get(t.id)
            usd  = f"${Decimal(str(pnl.usd_amount)):,.2f}" if pnl and pnl.usd_amount else "—"  # type: ignore[union-attr]
            icon = STATUS_ICON.get(t.status, "•")
            cp   = t.counterparty.name if t.counterparty else "—"
            dt   = t.created_at.strftime("%d.%m %H:%M") if t.created_at else "—"
            lines.append(f"{icon} *{t.txn_number}* | {dt}")
            lines.append(f"   {t.txn_type.value} · {usd} · {cp}")
            lines.append("")

        return "\n".join(lines).rstrip()

    except Exception as exc:
        logger.exception("_son_islemler hata")
        return f"❌ İşlemler alınamadı: {exc}"


def _islem_kaydet(db, raw_text: str) -> str:
    """
    Doğal dil ya da yapılandırılmış formatta işlem kaydı.
    Groq API ile parse edilir. Sonuç onay mesajı gönderir.

    Desteklenen format:
      havale 1000 USD alimirza karimov → mustafa demir [not]
      fx 5000 TRY → USD
    """
    try:
        from app.core.config import settings
        from groq import Groq

        api_key = getattr(settings, "GROQ_API_KEY", None)
        if not api_key:
            return "❌ Groq API anahtarı tanımlı değil. İşlem kaydedilemedi."

        client = Groq(api_key=api_key)

        system_prompt = """Sen bir hawala/döviz muhasebe sisteminin WhatsApp botusun.
Kullanıcıdan işlem emri geldiğinde bunu JSON olarak parse et.

Çıktı formatı (sadece JSON, açıklama yok):
{
  "txn_type": "remittance" | "fx" | "deposit" | "withdrawal",
  "amount": 1000.00,
  "currency": "USD",
  "from_name": "Ali Karimov",
  "to_name": "Mustafa Demir",
  "note": "isteğe bağlı not"
}

Eğer parse edilemiyorsa: {"error": "Açıklama"}
"""

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": raw_text},
            ],
            temperature=0,
            max_tokens=300,
        )

        import json
        raw = response.choices[0].message.content.strip()
        # JSON bloğunu temizle
        if "```" in raw:
            raw = raw.split("```")[1].replace("json", "").strip()

        parsed = json.loads(raw)

        if "error" in parsed:
            return f"❓ İşlem anlaşılamadı: {parsed['error']}\n\nÖrnek:\n`havale 1000 USD ali → mehmet`"

        # Onay mesajı gönder (gerçek kayıt için WebApp'ı kullanın ya da bir sonraki adımda ekleyin)
        txn_type = parsed.get("txn_type", "—")
        amount   = parsed.get("amount", 0)
        currency = parsed.get("currency", "—")
        frm      = parsed.get("from_name", "—")
        to       = parsed.get("to_name", "—")
        note     = parsed.get("note", "")

        confirm = (
            f"✅ *İşlem Algılandı*\n\n"
            f"Tür:    {txn_type}\n"
            f"Tutar:  {amount:,.2f} {currency}\n"
            f"Gönderen: {frm}\n"
            f"Alan:   {to}\n"
        )
        if note:
            confirm += f"Not:    {note}\n"

        confirm += (
            "\n⚠️ *Bu mesaj sadece önizlemedir.*\n"
            "Gerçek kayıt için uygulamayı kullanın.\n"
            "Otomatik kayıt özelliği yakında eklenecek."
        )

        return confirm

    except Exception as exc:
        logger.exception("_islem_kaydet hata")
        return f"❌ İşlem parse edilemedi: {exc}"
