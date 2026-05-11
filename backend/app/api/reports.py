"""
Raporlar API

Hesap Ekstresi Mantığı:
  Her işlem TEK satır — bacak bazlı değil, işlem bazlı.
  USD tutarı: pnl.usd_amount (gerçek işlem tutarı, kur tablosundan değil)
  Bakiye: müşteri perspektifi
    - Müşteri bizden para aldı (outgoing bizden) → müşteri borçlu oldu → bakiye ↑ (alacağımız artar)
    - Müşteri bize para verdi (incoming bize)    → müşterinin borcu azaldı → bakiye ↓

Kasa / Lokasyon Hareketi:
  Her bacak ayrı — kasa bazlı bakiye takibi
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List
from uuid import UUID
from datetime import date
from decimal import Decimal
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.master import Account, Location, Currency, Counterparty
from app.models.transaction import (
    Transaction, TransactionLeg, TransactionPnL,
    LegType, TxnType, TxnStatus
)

router = APIRouter(prefix="/api/reports", tags=["reports"])

ZERO = Decimal("0")

def _safe(v) -> Decimal:
    if v is None:
        return ZERO
    return Decimal(str(v)) if not isinstance(v, Decimal) else v

def _fmt2(v) -> str:
    return str(_safe(v).quantize(Decimal("0.01")))


# ── Pozisyon ──────────────────────────────────────────────────────────────────
@router.get("/position")
def position(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Tüm kasaların anlık bakiyesi. Batch sorgularla N+1 önlendi."""
    from app.services.balance import get_all_balances, get_all_usd_rates

    accounts = (db.query(Account)
                .options(joinedload(Account.location), joinedload(Account.currency))
                .filter(Account.is_active == True).all())

    # N+1 yerine 2 toplu sorgu
    balances  = get_all_balances(db)
    usd_rates = get_all_usd_rates(db)

    result = []
    total_usd = ZERO
    for acc in accounts:
        acc_id      = str(acc.id)
        balance     = balances.get(acc_id, ZERO)
        cur_code    = acc.currency.code if acc.currency else "USD"
        rate        = usd_rates.get(cur_code, Decimal("1"))
        balance_usd = (balance / rate).quantize(Decimal("0.01")) if rate else ZERO
        total_usd  += balance_usd
        result.append({
            "account_id":       acc_id,
            "account_name":     acc.name,
            "account_type":     acc.account_type.value,
            "location_id":      str(acc.location_id),
            "location_name_tr": acc.location.name_tr if acc.location else "",
            "currency_code":    cur_code,
            "balance":          _fmt2(balance),
            "balance_usd":      _fmt2(balance_usd),
        })

    result.sort(key=lambda x: (x["location_name_tr"], x["currency_code"]))
    return {"accounts": result, "total_usd": _fmt2(total_usd)}


# ── Lokasyon / Kasa Hareketleri ───────────────────────────────────────────────
@router.get("/cash-movements")
def cash_movements(
    location_id: Optional[UUID] = None,
    account_id:  Optional[UUID] = None,
    from_date:   Optional[date] = None,
    to_date:     Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Kasa / Lokasyon bazlı tüm hareketler.
    Her bacak ayrı satır. Kasa bazlı running balance.
    """
    from app.services.balance import get_account_balance, balance_to_usd

    TYPE_LABEL = {
        "remittance": "Havale", "fx": "Döviz", "swift": "SWIFT",
        "deposit": "Para Yatırma", "withdrawal": "Para Çekme",
        "internal_transfer": "İç Transfer",
    }

    # Hesapları çek
    acc_q = db.query(Account).options(
        joinedload(Account.location), joinedload(Account.currency)
    ).filter(Account.is_active == True)

    if location_id:
        acc_q = acc_q.filter(Account.location_id == location_id)
    if account_id:
        acc_q = acc_q.filter(Account.id == account_id)

    accounts = acc_q.all()

    result = []
    for acc in accounts:
        # Bu hesabın tüm hareketleri
        leg_q = (db.query(TransactionLeg)
                 .options(
                     joinedload(TransactionLeg.transaction).joinedload(Transaction.counterparty),
                     joinedload(TransactionLeg.currency),
                 )
                 .join(Transaction)
                 .filter(TransactionLeg.account_id == acc.id)
                 .order_by(Transaction.txn_date, Transaction.created_at))

        if from_date:
            leg_q = leg_q.filter(Transaction.txn_date >= from_date)
        if to_date:
            leg_q = leg_q.filter(Transaction.txn_date <= to_date)

        legs = leg_q.all()

        running = acc.opening_balance
        movements = []
        for leg in legs:
            txn = leg.transaction
            if leg.leg_type == LegType.incoming:
                running += leg.amount
                sign = "+"
            else:
                running -= leg.amount
                sign = "-"

            movements.append({
                "txn_number":  txn.txn_number,
                "txn_date":    str(txn.txn_date),
                "type":        TYPE_LABEL.get(txn.txn_type.value, txn.txn_type.value),
                "counterparty": txn.counterparty.name if txn.counterparty else "—",
                "direction":   "Giriş" if leg.leg_type == LegType.incoming else "Çıkış",
                "amount":      f"{sign}{_fmt2(leg.amount)}",
                "currency":    acc.currency.code if acc.currency else "",
                "balance":     _fmt2(running),
                "status":      txn.status.value,
            })

        result.append({
            "account_id":       str(acc.id),
            "account_name":     acc.name,
            "location_name_tr": acc.location.name_tr if acc.location else "",
            "currency_code":    acc.currency.code if acc.currency else "",
            "opening_balance":  _fmt2(acc.opening_balance),
            "closing_balance":  _fmt2(running),
            "movements":        movements,
        })

    return result


# ── Lokasyon Kârı ─────────────────────────────────────────────────────────────
@router.get("/location-pnl")
def location_pnl(
    from_date: Optional[date] = None,
    to_date:   Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Her lokasyon için kâr/zarar — sadece tamamlanan FX/Havale/SWIFT. Batch sorgularla N+1 önlendi."""
    from sqlalchemy import distinct
    FX_TYPES = {TxnType.remittance, TxnType.fx, TxnType.swift}
    locations = db.query(Location).filter(Location.is_active == True).all()

    # Tüm lokasyonları tek sorguda çöz: txn → location join
    q_base = (db.query(
                  Account.location_id,
                  Transaction.id.label("txn_id"),
              )
              .join(TransactionLeg, TransactionLeg.account_id == Account.id)
              .join(Transaction,    Transaction.id == TransactionLeg.transaction_id)
              .filter(
                  Transaction.txn_type.in_(FX_TYPES),
                  Transaction.status == TxnStatus.completed,
              ))
    if from_date: q_base = q_base.filter(Transaction.txn_date >= from_date)
    if to_date:   q_base = q_base.filter(Transaction.txn_date <= to_date)

    # location_id → set of txn_ids
    loc_txn_map: dict = {}
    for row in q_base.distinct().all():
        loc_id = str(row.location_id)
        loc_txn_map.setdefault(loc_id, set()).add(row.txn_id)

    # Tüm ilgili txn_ids için PnL'i tek sorguda çek
    all_txn_ids = [tid for ids in loc_txn_map.values() for tid in ids]
    pnl_by_txn: dict = {}
    if all_txn_ids:
        for p in db.query(TransactionPnL).filter(TransactionPnL.transaction_id.in_(all_txn_ids)).all():
            pnl_by_txn[str(p.transaction_id)] = p

    result = []
    for loc in locations:
        loc_id  = str(loc.id)
        txn_ids = loc_txn_map.get(loc_id, set())
        pnl_rows = [pnl_by_txn[str(t)] for t in txn_ids if str(t) in pnl_by_txn]

        volume_usd = sum(_safe(p.usd_amount)        for p in pnl_rows)
        fx_gain    = sum(_safe(p.gross_profit_usd)  for p in pnl_rows)
        commission = sum(_safe(p.commission_usd)    for p in pnl_rows)
        net_pnl    = sum(_safe(p.net_pnl_usd)       for p in pnl_rows)

        result.append({
            "location_id":       loc_id,
            "location_name_tr":  loc.name_tr,
            "location_name_ar":  loc.name_ar,
            "transaction_count": len(txn_ids),
            "volume_usd":        _fmt2(volume_usd),
            "fx_gain_usd":       _fmt2(fx_gain),
            "commission_usd":    _fmt2(commission),
            "net_pnl_usd":       _fmt2(net_pnl),
        })

    return result


# ── Gelir Tablosu ─────────────────────────────────────────────────────────────
@router.get("/income-statement")
def income_statement(
    from_date: Optional[date] = None,
    to_date:   Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Gelir tablosu — sadece tamamlanan FX/Havale/SWIFT."""
    FX_TYPES = {TxnType.remittance, TxnType.fx, TxnType.swift}

    q = (db.query(TransactionPnL).join(Transaction)
         .filter(Transaction.txn_type.in_(FX_TYPES), Transaction.status == TxnStatus.completed))
    if from_date: q = q.filter(Transaction.txn_date >= from_date)
    if to_date:   q = q.filter(Transaction.txn_date <= to_date)
    rows = q.all()

    # COUNT için ayrı sorgu yerine len(rows) kullan — zaten hepsini çektik
    fx_gain    = sum(_safe(r.gross_profit_usd) for r in rows)
    commission = sum(_safe(r.commission_usd)   for r in rows)
    gross      = fx_gain + commission
    net        = sum(_safe(r.net_pnl_usd)      for r in rows)

    return {
        "fx_gain_usd":       _fmt2(fx_gain),
        "commission_usd":    _fmt2(commission),
        "gross_income_usd":  _fmt2(gross),
        "cost_usd":          "0.00",
        "net_pnl_usd":       _fmt2(net),
        "transaction_count": len(rows),
        "from_date":         str(from_date) if from_date else None,
        "to_date":           str(to_date)   if to_date   else None,
    }


# ── Karşı Taraf Hesap Ekstresi ────────────────────────────────────────────────
@router.get("/counterparty-statement/{cp_id}")
def counterparty_statement(
    cp_id:     UUID,
    from_date: Optional[date] = None,
    to_date:   Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Karşı taraf hesap ekstresi — işlem bazlı (bacak bazlı değil).

    Her işlem TEK satır.
    USD tutarı: pnl.usd_amount (gerçek USD, kur tablosundan hesaplanan değil)
    Eğer pnl yoksa (deposit/withdrawal): outgoing leg USD tutarı

    Bakiye mantığı (biz ne kadar alacağımız / borcumuz):
      Müşteriye hizmet verdik → müşteri bize borçlu → bakiye ↑ (alacak)
      Müşteriden ödeme aldık  → borç kapandı        → bakiye ↓

    Havale (USD→EGP):  müşteri 100k USD verdi → bize 100k USD alacak girdi → bakiye artar
    Deposit (müşteri para yatırdı): bize geldi → alacağımız kapandı → bakiye azalır
    Withdrawal (müşteriye para verdik): bakiye artar
    """
    cp = db.query(Counterparty).filter(Counterparty.id == cp_id).first()
    if not cp:
        raise HTTPException(404, "Karşı taraf bulunamadı")

    q = (db.query(Transaction)
         .options(
             joinedload(Transaction.legs).joinedload(TransactionLeg.account)
                 .joinedload(Account.location),
             joinedload(Transaction.legs).joinedload(TransactionLeg.currency),
             joinedload(Transaction.pnl),
         )
         .filter(Transaction.counterparty_id == cp_id))
    if from_date: q = q.filter(Transaction.txn_date >= from_date)
    if to_date:   q = q.filter(Transaction.txn_date <= to_date)

    transactions = q.order_by(Transaction.txn_date, Transaction.created_at).all()

    TYPE_LABEL = {
        "remittance": "Havale", "fx": "Döviz", "swift": "SWIFT",
        "deposit": "Para Yatırma", "withdrawal": "Para Çekme",
        "internal_transfer": "İç Transfer",
    }
    FX_TYPES = {"remittance", "fx", "swift"}

    rows = []
    running_balance = ZERO

    for txn in transactions:
        txn_type_val = txn.txn_type.value

        if txn_type_val in FX_TYPES:
            # FX/Havale: tek satır, pnl.usd_amount kullan
            usd_amount = _safe(txn.pnl.usd_amount) if txn.pnl else ZERO

            # Yön: source → dest
            out_leg = next((l for l in txn.legs if l.leg_type == LegType.outgoing), None)
            in_leg  = next((l for l in txn.legs if l.leg_type == LegType.incoming), None)

            out_cur  = out_leg.currency.code if out_leg and out_leg.currency else ""
            in_cur   = in_leg.currency.code  if in_leg  and in_leg.currency  else ""
            out_amt  = _fmt2(out_leg.amount)  if out_leg else "0"
            in_amt   = _fmt2(in_leg.amount)   if in_leg  else "0"

            # Müşteri bakış: müşteri SOURCE'da ödedi → bize geldi → alacak kapandı → bakiye ↓
            # Müşteri DEST'te aldı → biz verdik → bakiye ↑
            # Net USD etkisi: out_leg (source, müşteri verdi) = alacağımız azalır
            # Pratik kural: müşterinin verdiği = bizim alacağımız kapanır
            if out_cur == "USD":
                # Müşteri USD verdi (outgoing bizden = USD kasa çıktı)
                # Müşterinin hesabına: ödedi = borç kapandı = bakiye azalır
                running_balance -= usd_amount
                debit_col  = f"{out_amt} {out_cur}"
                credit_col = f"{in_amt} {in_cur}"
            else:
                # Müşteri non-USD verdi, USD aldı
                # Müşteri aldı = borçlandı = bakiye artar
                running_balance += usd_amount
                debit_col  = f"{in_amt} {in_cur}"
                credit_col = f"{out_amt} {out_cur}"

            rows.append({
                "txn_number":  txn.txn_number,
                "txn_date":    str(txn.txn_date),
                "value_date":  str(txn.value_date),
                "type":        TYPE_LABEL[txn_type_val],
                "description": f"{out_cur} → {in_cur}" if out_cur and in_cur else "",
                "debit":       debit_col,
                "credit":      credit_col,
                "amount_usd":  _fmt2(usd_amount),
                "balance_usd": _fmt2(running_balance),
                "status":      txn.status.value,
            })

        elif txn_type_val == "deposit":
            # Müşteri para yatırdı → bize geldi → alacağımız azaldı
            leg = next((l for l in txn.legs if l.leg_type == LegType.incoming), None)
            if not leg:
                continue
            usd_amount = _safe(leg.amount_usd)
            running_balance -= usd_amount
            cur = leg.currency.code if leg.currency else ""
            rows.append({
                "txn_number":  txn.txn_number,
                "txn_date":    str(txn.txn_date),
                "value_date":  str(txn.value_date),
                "type":        TYPE_LABEL[txn_type_val],
                "description": "Tahsilat",
                "debit":       "—",
                "credit":      f"{_fmt2(leg.amount)} {cur}",
                "amount_usd":  _fmt2(usd_amount),
                "balance_usd": _fmt2(running_balance),
                "status":      txn.status.value,
            })

        elif txn_type_val == "withdrawal":
            # Müşteriye para verildi → biz verdik → alacağımız arttı
            leg = next((l for l in txn.legs if l.leg_type == LegType.outgoing), None)
            if not leg:
                continue
            usd_amount = _safe(leg.amount_usd)
            running_balance += usd_amount
            cur = leg.currency.code if leg.currency else ""
            rows.append({
                "txn_number":  txn.txn_number,
                "txn_date":    str(txn.txn_date),
                "value_date":  str(txn.value_date),
                "type":        TYPE_LABEL[txn_type_val],
                "description": "Teslim",
                "debit":       f"{_fmt2(leg.amount)} {cur}",
                "credit":      "—",
                "amount_usd":  _fmt2(usd_amount),
                "balance_usd": _fmt2(running_balance),
                "status":      txn.status.value,
            })

        # internal_transfer: karşı taraf etkisi yok, atla

    return {
        "counterparty": {
            "id":      str(cp.id),
            "code":    cp.code,
            "name":    cp.name,
            "name_ar": cp.name_ar,
            "type":    cp.type.value,
        },
        "rows":                rows,
        "closing_balance_usd": _fmt2(running_balance),
        "from_date":           str(from_date) if from_date else None,
        "to_date":             str(to_date)   if to_date   else None,
    }

# ── AI Analizcisi ─────────────────────────────────────────────────────────────
from app.services.ai_analyst import get_ai_financial_analysis, get_ai_chat_response
from app.models.report import SavedReport
from app.schemas.schemas import SavedReportCreate, SavedReportOut

@router.get("/ai-analysis")
def ai_analysis(prompt: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """AI Finansal Analiz Raporu"""
    analysis = get_ai_financial_analysis(db, prompt)
    return {"analysis": analysis}

@router.post("/ai-chat")
def ai_chat(payload: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """AI Finansal Sohbet"""
    message = payload.get("message")
    history = payload.get("history", [])
    response = get_ai_chat_response(db, message, history)
    return {"response": response}

@router.get("/saved-reports", response_model=List[SavedReportOut])
def list_saved_reports(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(SavedReport).filter(SavedReport.user_id == user.id).order_by(SavedReport.created_at.desc()).all()

@router.post("/saved-reports", response_model=SavedReportOut)
def create_saved_report(report: SavedReportCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_report = SavedReport(**report.model_dump(), user_id=user.id)
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

@router.patch("/saved-reports/{report_id}/favorite", response_model=SavedReportOut)
def toggle_favorite_report(report_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_report = db.query(SavedReport).filter(SavedReport.id == report_id, SavedReport.user_id == user.id).first()
    if not db_report:
        raise HTTPException(404, "Rapor bulunamadı")
    db_report.is_favorite = not db_report.is_favorite
    db.commit()
    db.refresh(db_report)
    return db_report

@router.delete("/saved-reports/{report_id}")
def delete_saved_report(report_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_report = db.query(SavedReport).filter(SavedReport.id == report_id, SavedReport.user_id == user.id).first()
    if not db_report:
        raise HTTPException(404, "Rapor bulunamadı")
    db.delete(db_report)
    db.commit()
    return {"status": "ok"}
