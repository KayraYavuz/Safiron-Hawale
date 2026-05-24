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

from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, CallbackQueryHandler, filters

logger = logging.getLogger(__name__)

# company_id → Thread
_running_bots: Dict[str, threading.Thread] = {}

ZERO = Decimal("0")

# ─────────────────────────────────────────────────────────────────────────────
# Konuşma durumu (in-memory, company_id:uid bazlı)
# ─────────────────────────────────────────────────────────────────────────────
_conversations: Dict[str, dict] = {}

def _ckey(company_id, uid: int) -> str:
    return f"{company_id}:{uid}"

def _cget(company_id, uid: int) -> Optional[dict]:
    return _conversations.get(_ckey(company_id, uid))

def _cset(company_id, uid: int, state: str, data: dict = None):
    _conversations[_ckey(company_id, uid)] = {"state": state, "data": data or {}}

def _cupd(company_id, uid: int, **kwargs):
    k = _ckey(company_id, uid)
    if k in _conversations:
        _conversations[k]["data"].update(kwargs)

def _cclr(company_id, uid: int):
    _conversations.pop(_ckey(company_id, uid), None)

# Durum sabitleri
S_TXN_TYPE    = "txn_type"
S_TXN_CP      = "txn_cp"
S_TXN_FROM    = "txn_from"
S_TXN_TO      = "txn_to"
S_TXN_RATE    = "txn_rate"
S_TXN_SRATE   = "txn_srate"
S_TXN_AMT     = "txn_amt"
S_CP_NAME     = "cp_name"
S_CP_NAME_AR  = "cp_name_ar"
S_CP_TYPE     = "cp_type"
S_CP_COUNTRY  = "cp_country"
S_CP_PHONE    = "cp_phone"

TXN_LABELS = {
    "remittance":        "💸 Havale",
    "fx":                "💱 Döviz",
    "swift":             "🏦 SWIFT",
    "deposit":           "📥 Yatırma",
    "withdrawal":        "📤 Çekme",
    "internal_transfer": "🔄 İç Transfer",
}

# ── Inline klavye yardımcıları ────────────────────────────────────────────────

def _kb(rows):
    """rows: [[('Metin', 'callback_data'), ...], ...]"""
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(t, callback_data=d) for t, d in row] for row in rows]
    )

def _cancel_kb():
    return _kb([[("❌ İptal", "cancel")]])

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
        _cclr(company_id, uid)  # Açık konuşmayı sıfırla
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            admin = _find_admin(uid, company_id, db)
            if admin:
                await update.message.reply_text(
                    f"👋 *{company_name} — Yönetici Paneli*\n\n"
                    f"Hoş geldiniz, *{admin.name}*!\n\n"
                    "📊 `bakiye` · `rapor` · `kur` · `işlemler`\n"
                    "➕ `yeni işlem` · `müşteri ekle`\n"
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
            # İptal komutu her zaman çalışır
            if cmd in ("iptal", "/iptal", "cancel", "/cancel"):
                _cclr(company_id, uid)
                await update.message.reply_text("❌ İşlem iptal edildi.", parse_mode="Markdown")
                return

            admin = _find_admin(uid, company_id, db)

            if not admin:
                # Bağlanmamış kullanıcı
                if cmd.startswith("bağla ") or cmd.startswith("bagla "):
                    parts = text.split()
                    reply = _admin_pin_bagla(parts[1].upper(), uid, company_id, db) if len(parts) >= 2 else "❓ Kullanım: `bağla PİNİNİZ`"
                else:
                    reply = (
                        "🔐 *Hesabınız henüz bağlı değil.*\n\n"
                        "`bağla PİNİNİZ` yazın.\n"
                        "_Örnek: `bağla SAF-7K2M`_"
                    )
                await update.message.reply_text(reply, parse_mode="Markdown")
                return

            # Aktif konuşma varsa → konuşma handler'ına yönlendir
            conv = _cget(company_id, uid)
            if conv:
                result = await _conv_handle_text(conv, text, uid, company_id, db)
                if result:
                    msg, kb = result
                    await update.message.reply_text(msg, parse_mode="Markdown", reply_markup=kb)
                return

            # Normal admin komutu
            reply = _admin_cmd(cmd, text, company_id, db)
            if isinstance(reply, tuple):
                msg, kb = reply
                # Sentinel: konuşma başlat
                if msg == "__start_txn__":
                    _cset(company_id, uid, S_TXN_TYPE, {})
                    msg, kb = _start_txn_type()
                elif msg == "__start_cp__":
                    _cset(company_id, uid, S_CP_NAME, {})
                    msg, kb = _start_cp_create()
                await update.message.reply_text(msg, parse_mode="Markdown", reply_markup=kb)
            else:
                for chunk in [reply[i:i+4096] for i in range(0, len(reply), 4096)]:
                    await update.message.reply_text(chunk, parse_mode="Markdown")

        except Exception as exc:
            logger.exception(f"[{company_name}] Hata: {exc}")
            await update.message.reply_text("❌ Sunucu hatası. Lütfen tekrar deneyin.")
        finally:
            db.close()

    async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        uid  = query.from_user.id
        data = query.data

        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            admin = _find_admin(uid, company_id, db)
            if not admin:
                await query.edit_message_text("🚫 Yetki yok.", parse_mode="Markdown")
                return

            if data == "cancel":
                _cclr(company_id, uid)
                await query.edit_message_text("❌ İptal edildi.", parse_mode="Markdown")
                return

            conv = _cget(company_id, uid)
            if not conv:
                await query.edit_message_text("⚠️ Oturum zaman aşımına uğradı. Tekrar başlatın.", parse_mode="Markdown")
                return

            result = await _conv_handle_cb(conv, data, uid, company_id, db)
            if result:
                msg, kb = result
                if kb is not None:
                    await query.edit_message_text(msg, parse_mode="Markdown", reply_markup=kb)
                else:
                    await query.edit_message_text(msg, parse_mode="Markdown")

        except Exception as exc:
            logger.exception(f"[{company_name}] CB Hata: {exc}")
            await query.edit_message_text("❌ Sunucu hatası.")
        finally:
            db.close()

    return on_start, on_message, on_callback


# ─────────────────────────────────────────────────────────────────────────────
# Admin komutları
# ─────────────────────────────────────────────────────────────────────────────

def _admin_cmd(cmd: str, raw: str, company_id, db):
    if cmd in ("?", "yardım", "yardim"):
        return (
            "🔧 *Yönetici Komutları*\n\n"
            "• `bakiye` → Tüm kasa bakiyeleri\n"
            "• `rapor` → Günlük özet\n"
            "• `kur` → Tüm döviz kurları\n"
            "• `kur TRY` → Belirli kur\n"
            "• `işlemler` → Son 10 işlem\n"
            "• `müşteri KOD` → Müşteri bakiyesi\n"
            "• `müşteriler` → Müşteri listesi\n"
            "➕ `yeni işlem` → İşlem oluştur\n"
            "➕ `müşteri ekle` → Yeni müşteri"
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
        # "müşteri ekle" → yeni müşteri akışı başlat
        rest = raw[raw.index(" ")+1:].strip().lower()
        if rest == "ekle":
            return _start_cp_create()
        kod = raw.split()[1].upper()
        return _q_musteri_bakiye(kod, company_id, db)

    if cmd in ("yeni işlem", "yeni islem", "işlem ekle", "islem ekle", "yeni", "+"):
        return ("__start_txn__", None)   # Sentinel — on_message uid'i biliyor

    if cmd in ("müşteri ekle", "musteri ekle"):
        return ("__start_cp__", None)    # Sentinel

    return "❓ Komut tanınmadı. Yardım: `?`"


# ─────────────────────────────────────────────────────────────────────────────
# Konuşma akışı başlatıcılar
# ─────────────────────────────────────────────────────────────────────────────

def _start_txn_type():
    """İşlem türü seç ekranı."""
    kb = _kb([
        [("💸 Havale",  "t:remittance"), ("💱 Döviz",   "t:fx")],
        [("🏦 SWIFT",   "t:swift"),      ("📥 Yatırma", "t:deposit")],
        [("📤 Çekme",   "t:withdrawal"), ("🔄 İç Transfer", "t:internal_transfer")],
        [("❌ İptal",   "cancel")],
    ])
    return ("➕ *Yeni İşlem*\n\nİşlem türünü seçin:", kb)


def _start_cp_create():
    """Yeni müşteri oluşturma akışını başlat — sadece state döner, UID yok."""
    return ("➕ *Yeni Müşteri*\n\nMüşterinin adını yazın (İngilizce/Latin):\n\n_İptal: `iptal`_", _cancel_kb())


# ─────────────────────────────────────────────────────────────────────────────
# Konuşma metin handler'ı
# ─────────────────────────────────────────────────────────────────────────────

async def _conv_handle_text(conv: dict, text: str, uid: int, company_id, db):
    """Aktif konuşmada metin mesajı işle. (msg, kb) tuple döner."""
    state = conv["state"]
    data  = conv["data"]

    # ── İşlem akışı ──────────────────────────────────────────────────────────
    if state == S_TXN_RATE:
        try:
            rate = float(text.replace(",", "."))
            if rate <= 0: raise ValueError
        except ValueError:
            return ("❌ Geçersiz kur. Sayısal bir değer girin:\n_Örnek: 38.50_", _cancel_kb())
        _cupd(company_id, uid, customer_rate=rate)
        # Tedarikçi kuruna geç (opsiyonel)
        from_cur = data.get("from_cur", "")
        to_cur   = data.get("to_cur", "")
        kb = _kb([[("⏭ Atla", "skip_srate"), ("❌ İptal", "cancel")]])
        return (
            f"📉 *Tedarikçi Kuru* (opsiyonel)\n\n"
            f"1 USD = ? {data.get('non_usd_cur','')}\n"
            f"_(Tedarikçiden aldığınız kur — kâr hesabı için)_\n\n"
            f"Değer girin veya *Atla*:",
            kb
        )

    if state == S_TXN_SRATE:
        try:
            rate = float(text.replace(",", "."))
            if rate <= 0: raise ValueError
        except ValueError:
            return ("❌ Geçersiz kur. Sayısal bir değer girin:", _cancel_kb())
        _cupd(company_id, uid, supplier_rate=rate)
        _cupd(company_id, uid, **{"state_next": S_TXN_AMT})
        _cset(company_id, uid, S_TXN_AMT, {**data, "supplier_rate": rate})
        return _ask_amount(data)

    if state == S_TXN_AMT:
        try:
            amt = float(text.replace(",", "").replace(".", "").replace(",", "."))
            # Virgüllü/noktalı sayı için yeniden parse
            amt = float(text.replace(",", ".")) if "," in text else float(text.replace(",", ""))
            if amt <= 0: raise ValueError
        except ValueError:
            return ("❌ Geçersiz miktar. Sayısal bir değer girin:\n_Örnek: 1000 veya 1500.50_", _cancel_kb())
        _cset(company_id, uid, "txn_confirm", {**data, "amount": amt})
        return _txn_summary(company_id, uid, {**data, "amount": amt}, db)

    # ── Müşteri ekleme akışı ──────────────────────────────────────────────────
    if state == S_CP_NAME:
        name = text.strip()
        if len(name) < 2:
            return ("❌ İsim en az 2 karakter olmalı:", _cancel_kb())
        _cset(company_id, uid, S_CP_NAME_AR, {**data, "name": name})
        kb = _kb([[("⏭ Atla", "skip_name_ar"), ("❌ İptal", "cancel")]])
        return (f"👤 *{name}*\n\nArapça adı (opsiyonel):\n\n_Atla tuşuna basın veya yazın:_", kb)

    if state == S_CP_NAME_AR:
        name_ar = text.strip()
        _cset(company_id, uid, S_CP_TYPE, {**data, "name_ar": name_ar})
        return _ask_cp_type(data.get("name", ""))

    if state == S_CP_COUNTRY:
        country = text.strip().upper()[:3]
        _cset(company_id, uid, S_CP_PHONE, {**data, "country": country})
        kb = _kb([[("⏭ Atla", "skip_phone"), ("❌ İptal", "cancel")]])
        return (f"📞 Telefon numarası (opsiyonel):\n\n_Örnek: +20 123 456 7890_", kb)

    if state == S_CP_PHONE:
        phone = text.strip()
        _cset(company_id, uid, "cp_confirm", {**data, "phone": phone})
        return _cp_summary({**data, "phone": phone})

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Konuşma callback handler'ı
# ─────────────────────────────────────────────────────────────────────────────

async def _conv_handle_cb(conv: dict, data_cb: str, uid: int, company_id, db):
    """Callback query işle. (msg, kb) tuple döner."""
    state = conv["state"]
    data  = conv["data"]

    # ── İşlem türü seç ───────────────────────────────────────────────────────
    if data_cb.startswith("t:") and state == S_TXN_TYPE:
        txn_type = data_cb[2:]
        _cset(company_id, uid, S_TXN_CP, {"txn_type": txn_type})
        return _ask_cp(txn_type, company_id, db)

    # ── Müşteri seç ──────────────────────────────────────────────────────────
    if data_cb.startswith("cp:") and state == S_TXN_CP:
        cp_id = data_cb[3:]
        from app.models.master import Counterparty
        cp = db.query(Counterparty).filter(Counterparty.id == cp_id).first()
        cp_name = cp.name if cp else "—"
        txn_type = data["txn_type"]
        _cset(company_id, uid, S_TXN_FROM, {**data, "cp_id": cp_id, "cp_name": cp_name})
        return _ask_from_acc(txn_type, company_id, db)

    if data_cb == "cp_skip" and state == S_TXN_CP:
        txn_type = data["txn_type"]
        _cset(company_id, uid, S_TXN_FROM, {**data, "cp_id": None, "cp_name": None})
        return _ask_from_acc(txn_type, company_id, db)

    # ── Kaynak kasa seç ───────────────────────────────────────────────────────
    if data_cb.startswith("from:") and state == S_TXN_FROM:
        acc_id = data_cb[5:]
        from app.models.master import Account
        from sqlalchemy.orm import joinedload
        acc = db.query(Account).options(joinedload(Account.currency), joinedload(Account.location)).filter(Account.id == acc_id).first()
        txn_type = data["txn_type"]
        is_simple = txn_type in ("deposit", "withdrawal")

        if is_simple:
            # Direkt miktara geç
            cur = acc.currency.code if acc and acc.currency else "?"
            loc = acc.location.name_tr if acc and acc.location else "?"
            _cset(company_id, uid, S_TXN_AMT, {
                **data, "from_acc_id": acc_id, "from_acc_name": f"{loc} · {acc.name if acc else '?'}",
                "from_cur": cur, "to_cur": cur, "non_usd_cur": cur if cur != "USD" else "",
            })
            return (
                f"💰 *Miktar*\n\n"
                f"Kasa: {loc} · {acc.name if acc else '?'} ({cur})\n\n"
                f"Miktarı girin ({cur}):",
                _cancel_kb()
            )
        else:
            from_cur = acc.currency.code if acc and acc.currency else "?"
            from_loc = acc.location.name_tr if acc and acc.location else "?"
            _cset(company_id, uid, S_TXN_TO, {
                **data, "from_acc_id": acc_id,
                "from_acc_name": f"{from_loc} · {acc.name if acc else '?'}",
                "from_cur": from_cur,
            })
            return _ask_to_acc(company_id, db, exclude_id=acc_id)

    # ── Hedef kasa seç ────────────────────────────────────────────────────────
    if data_cb.startswith("to:") and state == S_TXN_TO:
        acc_id = data_cb[3:]
        from app.models.master import Account
        from sqlalchemy.orm import joinedload
        acc = db.query(Account).options(joinedload(Account.currency), joinedload(Account.location)).filter(Account.id == acc_id).first()
        to_cur = acc.currency.code if acc and acc.currency else "?"
        to_loc = acc.location.name_tr if acc and acc.location else "?"
        from_cur = data.get("from_cur", "")
        non_usd_cur = to_cur if to_cur != "USD" else from_cur if from_cur != "USD" else ""
        same_cur = (from_cur == to_cur)

        _cset(company_id, uid, S_TXN_RATE if (not same_cur and non_usd_cur) else S_TXN_AMT, {
            **data, "to_acc_id": acc_id,
            "to_acc_name": f"{to_loc} · {acc.name if acc else '?'}",
            "to_cur": to_cur, "non_usd_cur": non_usd_cur, "same_cur": same_cur,
        })

        if same_cur or not non_usd_cur:
            return _ask_amount({**data, "to_cur": to_cur, "from_cur": from_cur})
        else:
            return (
                f"📈 *Müşteri Kuru*\n\n"
                f"Yön: {from_cur} → {to_cur}\n"
                f"Format: 1 USD = ? {non_usd_cur}\n\n"
                f"Müşteriye uyguladığınız kuru girin:",
                _cancel_kb()
            )

    # ── Tedarikçi kurunu atla ─────────────────────────────────────────────────
    if data_cb == "skip_srate":
        _cset(company_id, uid, S_TXN_AMT, data)
        return _ask_amount(data)

    # ── Onay ─────────────────────────────────────────────────────────────────
    if data_cb == "confirm_txn" and state == "txn_confirm":
        return await _do_create_txn(data, uid, company_id, db)

    # ── Müşteri ekleme callback'leri ──────────────────────────────────────────
    if data_cb == "skip_name_ar" and state == S_CP_NAME_AR:
        _cset(company_id, uid, S_CP_TYPE, {**data, "name_ar": None})
        return _ask_cp_type(data.get("name", ""))

    if data_cb.startswith("cpt:") and state == S_CP_TYPE:
        cp_type = data_cb[4:]
        _cset(company_id, uid, S_CP_COUNTRY, {**data, "type": cp_type})
        kb = _kb([[("⏭ Atla", "skip_country"), ("❌ İptal", "cancel")]])
        return ("🌍 Ülke kodu (3 harf, opsiyonel):\n\n_Örnek: TUR, EGY, SAU_", kb)

    if data_cb == "skip_country" and state == S_CP_COUNTRY:
        _cset(company_id, uid, S_CP_PHONE, {**data, "country": None})
        kb = _kb([[("⏭ Atla", "skip_phone"), ("❌ İptal", "cancel")]])
        return ("📞 Telefon numarası (opsiyonel):", kb)

    if data_cb == "skip_phone" and state in (S_CP_PHONE, S_CP_COUNTRY):
        _cset(company_id, uid, "cp_confirm", {**data, "phone": None})
        return _cp_summary({**data, "phone": None})

    if data_cb == "confirm_cp" and state == "cp_confirm":
        return _do_create_cp(data, company_id, db)

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Konuşma yardımcı fonksiyonları
# ─────────────────────────────────────────────────────────────────────────────

def _ask_cp(txn_type: str, company_id, db):
    """Müşteri seçim ekranı."""
    from app.models.master import Counterparty
    cps = (db.query(Counterparty)
             .filter(Counterparty.company_id == company_id, Counterparty.is_active == True)
             .order_by(Counterparty.name).limit(20).all())

    rows = []
    row  = []
    for cp in cps:
        row.append((cp.name[:22], f"cp:{cp.id}"))
        if len(row) == 2:
            rows.append(row); row = []
    if row: rows.append(row)
    is_simple = txn_type in ("deposit", "withdrawal")
    rows.append([("⏭ Müşterisiz devam", "cp_skip")])
    rows.append([("❌ İptal", "cancel")])
    kb = _kb(rows)
    return (f"👥 *Müşteri Seç*\n\nİşlem türü: {TXN_LABELS.get(txn_type, txn_type)}", kb)


def _ask_from_acc(txn_type: str, company_id, db):
    """Kaynak (çıkış) kasası seçim ekranı."""
    from app.models.master import Account
    from sqlalchemy.orm import joinedload
    label = "📤 *Kaynak Kasa*" if txn_type != "deposit" else "📥 *Hedef Kasa*"
    hint  = "_(Müşterinin para VERDİĞİ kasa)_" if txn_type not in ("deposit","withdrawal") else "_(İşlemin yapılacağı kasa)_"
    accs  = (db.query(Account)
               .options(joinedload(Account.location), joinedload(Account.currency))
               .filter(Account.is_active == True, Account.company_id == company_id)
               .all())
    rows = [[( f"{a.location.name_tr if a.location else '?'} · {a.name} ({a.currency.code if a.currency else '?'})"[:40], f"from:{a.id}")] for a in accs]
    rows.append([("❌ İptal", "cancel")])
    return (f"{label}\n{hint}", _kb(rows))


def _ask_to_acc(company_id, db, exclude_id=None):
    """Hedef (giriş) kasası seçim ekranı."""
    from app.models.master import Account
    from sqlalchemy.orm import joinedload
    accs = (db.query(Account)
              .options(joinedload(Account.location), joinedload(Account.currency))
              .filter(Account.is_active == True, Account.company_id == company_id)
              .all())
    rows = [[( f"{a.location.name_tr if a.location else '?'} · {a.name} ({a.currency.code if a.currency else '?'})"[:40], f"to:{a.id}")] for a in accs if str(a.id) != str(exclude_id)]
    rows.append([("❌ İptal", "cancel")])
    return ("📥 *Hedef Kasa*\n_(Müşterinin para ALDIĞI kasa)_", _kb(rows))


def _ask_amount(data: dict):
    """Miktar giriş ekranı."""
    from_cur = data.get("from_cur", "")
    to_cur   = data.get("to_cur", "")
    same_cur = data.get("same_cur", False)
    cr       = data.get("customer_rate")
    non_usd  = data.get("non_usd_cur", "")

    if same_cur or not non_usd:
        return (
            f"💰 *Miktar*\n\n"
            f"Miktarı {from_cur or 'USD'} cinsinden girin:",
            _cancel_kb()
        )
    return (
        f"💰 *Miktar*\n\n"
        f"USD miktarını girin:\n"
        f"_(Kur: 1 USD = {cr or '?'} {non_usd})_",
        _cancel_kb()
    )


def _ask_cp_type(name: str):
    """Müşteri türü seçim ekranı."""
    kb = _kb([
        [("👤 Müşteri", "cpt:customer"), ("🏭 Tedarikçi", "cpt:supplier")],
        [("🔄 Her İkisi", "cpt:both"),   ("👑 Kurucu",    "cpt:founder")],
        [("❌ İptal", "cancel")],
    ])
    return (f"👤 *{name}*\n\nMüşteri türünü seçin:", kb)


def _txn_summary(company_id, uid, data: dict, db):
    """İşlem özeti ve onay."""
    txn_type = data.get("txn_type", "")
    cp_name  = data.get("cp_name") or "—"
    from_acc = data.get("from_acc_name", "—")
    to_acc   = data.get("to_acc_name", "—")
    from_cur = data.get("from_cur", "")
    to_cur   = data.get("to_cur", "")
    cr       = data.get("customer_rate")
    sr       = data.get("supplier_rate")
    amount   = data.get("amount", 0)
    non_usd  = data.get("non_usd_cur", "")
    is_simple = txn_type in ("deposit", "withdrawal")

    lines = [
        f"📋 *İşlem Özeti*\n",
        f"• Tür: *{TXN_LABELS.get(txn_type, txn_type)}*",
        f"• Müşteri: *{cp_name}*",
    ]
    if is_simple:
        lines.append(f"• Kasa: *{from_acc}*")
        lines.append(f"• Miktar: *{amount:,.2f} {from_cur}*")
    else:
        lines += [
            f"• Kaynak: *{from_acc}*",
            f"• Hedef:  *{to_acc}*",
        ]
        if cr:
            lines.append(f"• Müşteri kuru: *1 USD = {cr} {non_usd}*")
            local_amt = amount * cr
            lines.append(f"• USD: *{amount:,.2f}*  →  {non_usd}: *{local_amt:,.2f}*")
            if sr:
                profit_per_usd = abs(cr - sr)
                total_profit   = profit_per_usd * amount
                lines.append(f"• Tedarikçi kuru: *1 USD = {sr} {non_usd}*")
                lines.append(f"• Kâr: *{total_profit:,.2f} {non_usd}*")
        else:
            lines.append(f"• Miktar: *{amount:,.2f}*")

    lines.append(f"\nOnaylıyor musunuz?")
    kb = _kb([[("✅ Onayla", "confirm_txn"), ("❌ İptal", "cancel")]])
    _cset(company_id, uid, "txn_confirm", data)
    return ("\n".join(lines), kb)


def _cp_summary(data: dict):
    """Müşteri oluşturma özeti ve onay."""
    lines = [
        "📋 *Müşteri Özeti*\n",
        f"• Ad: *{data.get('name','—')}*",
    ]
    if data.get("name_ar"):
        lines.append(f"• Arapça: *{data['name_ar']}*")
    lines.append(f"• Tür: *{data.get('type','—')}*")
    if data.get("country"):
        lines.append(f"• Ülke: *{data['country']}*")
    if data.get("phone"):
        lines.append(f"• Tel: *{data['phone']}*")
    lines.append("\nOnaylıyor musunuz?")
    kb = _kb([[("✅ Oluştur", "confirm_cp"), ("❌ İptal", "cancel")]])
    return ("\n".join(lines), kb)


async def _do_create_txn(data: dict, uid: int, company_id, db):
    """İşlemi DB'ye kaydet."""
    from datetime import date as dt_date
    from app.models.master import Account
    from app.models.transaction import Transaction, TransactionLeg, TxnType, TxnStatus, LegType
    import uuid

    txn_type = data.get("txn_type")
    today    = dt_date.today()
    is_simple = txn_type in ("deposit", "withdrawal")

    # Txn numarası
    from sqlalchemy import func
    count = db.query(func.count(Transaction.id)).scalar() or 0
    txn_number = f"TXN-{today.year}-{str(count+1).zfill(5)}"

    from_acc_id = data.get("from_acc_id")
    to_acc_id   = data.get("to_acc_id")
    amount      = float(data.get("amount", 0))
    cp_id       = data.get("cp_id")
    cr          = data.get("customer_rate")
    sr          = data.get("supplier_rate")
    from_cur    = data.get("from_cur", "USD")
    to_cur      = data.get("to_cur", "USD")
    non_usd     = data.get("non_usd_cur", "")

    # Kasaları bul
    from_acc = db.query(Account).filter(Account.id == from_acc_id).first() if from_acc_id else None
    to_acc   = db.query(Account).filter(Account.id == to_acc_id).first()   if to_acc_id  else None

    try:
        txn_type_enum = TxnType(txn_type)
    except ValueError:
        return ("❌ Geçersiz işlem türü.", _cancel_kb())

    txn = Transaction(
        txn_number=txn_number, txn_date=today, value_date=today,
        txn_type=txn_type_enum, status=TxnStatus.pending,
        counterparty_id=cp_id or None,
        counterparty_role="customer" if cp_id else None,
        company_id=company_id,
    )
    db.add(txn)
    db.flush()

    # Leg'ler
    if is_simple:
        leg_type = LegType.incoming if txn_type == "deposit" else LegType.outgoing
        if from_acc:
            leg = TransactionLeg(
                transaction_id=txn.id,
                leg_type=leg_type,
                account_id=from_acc.id,
                currency_id=from_acc.currency_id,
                amount=Decimal(str(amount)),
                amount_usd=Decimal(str(amount)),  # basit yaklaşım
            )
            db.add(leg)
    else:
        # USD pivot hesabı
        if cr and non_usd:
            if to_cur == "USD":
                out_amt = Decimal(str(amount)) * Decimal(str(cr))
                in_amt  = Decimal(str(amount))
            elif from_cur == "USD":
                out_amt = Decimal(str(amount))
                in_amt  = Decimal(str(amount)) * Decimal(str(cr))
            else:
                out_amt = in_amt = Decimal(str(amount))
        else:
            out_amt = in_amt = Decimal(str(amount))

        if from_acc:
            db.add(TransactionLeg(
                transaction_id=txn.id, leg_type=LegType.outgoing,
                account_id=from_acc.id, currency_id=from_acc.currency_id,
                amount=out_amt, amount_usd=Decimal(str(amount)),
            ))
        if to_acc:
            db.add(TransactionLeg(
                transaction_id=txn.id, leg_type=LegType.incoming,
                account_id=to_acc.id, currency_id=to_acc.currency_id,
                amount=in_amt, amount_usd=Decimal(str(amount)),
            ))

    # PnL kaydı
    if cr and not is_simple:
        from app.models.transaction import TransactionPnL
        pnl_profit = ZERO
        if sr:
            diff = abs(Decimal(str(cr)) - Decimal(str(sr)))
            pnl_profit = diff * Decimal(str(amount))
        pnl = TransactionPnL(
            transaction_id=txn.id,
            source_currency=from_cur,
            dest_currency=to_cur,
            usd_amount=Decimal(str(amount)),
            customer_rate=Decimal(str(cr)),
            supplier_rate=Decimal(str(sr)) if sr else None,
            gross_profit_quote=pnl_profit,
            gross_profit_quote_currency=non_usd or "USD",
            gross_profit_usd=pnl_profit / Decimal(str(cr)) if cr else ZERO,
            commission_usd=ZERO,
            net_pnl_usd=pnl_profit / Decimal(str(cr)) if cr else ZERO,
        )
        db.add(pnl)

    db.commit()
    _cclr(company_id, uid)

    return (
        f"✅ *İşlem oluşturuldu!*\n\n"
        f"• No: `{txn_number}`\n"
        f"• Durum: ⏳ Onay Bekliyor\n\n"
        f"_Uygulamadan onaylayabilirsiniz._",
        None
    )


def _do_create_cp(data: dict, company_id, db):
    """Müşteriyi DB'ye kaydet."""
    from app.models.master import Counterparty, CounterpartyType
    from app.api.master import _generate_bot_pin
    from datetime import datetime

    count = db.query(Counterparty).count()
    code  = f"CP-{datetime.now().year}-{str(count+1).zfill(5)}"
    pin   = _generate_bot_pin(db)

    try:
        cp_type = CounterpartyType(data.get("type", "customer"))
    except ValueError:
        cp_type = CounterpartyType.customer

    cp = Counterparty(
        name=data["name"],
        name_ar=data.get("name_ar"),
        type=cp_type,
        country=data.get("country"),
        phone=data.get("phone"),
        credit_limit_usd=ZERO,
        code=code,
        company_id=company_id,
        bot_pin=pin,
    )
    db.add(cp)
    db.commit()
    db.refresh(cp)

    return (
        f"✅ *Müşteri oluşturuldu!*\n\n"
        f"• Ad: *{cp.name}*\n"
        f"• Kod: `{cp.code}`\n"
        f"• Bot PIN: `{cp.bot_pin}`\n\n"
        f"_Uygulamada Müşteriler sayfasında görünür._",
        None
    )


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

    on_start, on_message, on_callback = make_handlers(company_id, company_name)

    def _run():
        import httpx
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def _poll():
            app = Application.builder().token(token).updater(None).build()
            app.add_handler(CommandHandler("start", on_start))
            app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
            app.add_handler(CallbackQueryHandler(on_callback))
            await app.initialize()
            await app.start()

            logger.info(f"✅ Bot başladı: {company_name}")
            print(f"✅ Telegram bot: {company_name}")

            offset = None
            while True:
                try:
                    params = {"timeout": 30, "allowed_updates": ["message", "callback_query"]}
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
