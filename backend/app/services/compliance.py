"""AML screening service.

Three rules — amount threshold, watchlist name match (fuzzy), and structuring
(sub-threshold transactions that aggregate over the threshold). Raises
ComplianceFlag rows; idempotent per (transaction_id, rule). No external deps.
"""
import unicodedata
from decimal import Decimal
from datetime import timedelta
from difflib import SequenceMatcher
from sqlalchemy.orm import Session

from app.models.master import Company, Counterparty
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL
from app.models.compliance import Watchlist, ComplianceFlag, ComplianceRule, ComplianceStatus

ZERO = Decimal("0")
_MATCH_RATIO = 0.85


def _q(v) -> Decimal:
    return Decimal(str(v or 0))


def _normalize(s: str) -> str:
    """Lowercase, strip accents and surrounding whitespace for name comparison."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.lower().split())


def _similar(a: str, b: str) -> float:
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0
    if na in nb or nb in na:
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


def _txn_usd(db: Session, txn: Transaction) -> Decimal:
    """USD value of a transaction: pnl.usd_amount when set, else the largest
    leg amount_usd."""
    pnl = db.query(TransactionPnL).filter(TransactionPnL.transaction_id == txn.id).first()
    if pnl and _q(pnl.usd_amount) > ZERO:
        return _q(pnl.usd_amount)
    legs = db.query(TransactionLeg).filter(TransactionLeg.transaction_id == txn.id).all()
    return max((_q(l.amount_usd) for l in legs), default=ZERO)


def screen_transaction(db: Session, company: Company, txn: Transaction) -> list[dict]:
    """Return a list of {rule, detail} flags this transaction triggers."""
    flags: list[dict] = []
    threshold = _q(getattr(company, "aml_threshold_usd", 0))
    usd = _txn_usd(db, txn)

    # 1) Amount threshold
    if threshold > ZERO and usd >= threshold:
        flags.append({"rule": ComplianceRule.amount,
                      "detail": f"İşlem tutarı ${usd} ≥ eşik ${threshold}"})

    # 2) Watchlist name match
    if txn.counterparty_id:
        cp = db.query(Counterparty).filter(Counterparty.id == txn.counterparty_id).first()
        if cp:
            entries = (db.query(Watchlist)
                         .filter(Watchlist.company_id == company.id,
                                 Watchlist.is_active == True)
                         .all())
            for w in entries:
                best = max(_similar(cp.name, w.name),
                           _similar(cp.name_ar or "", w.name_ar or "") if w.name_ar else 0.0)
                if best >= _MATCH_RATIO:
                    flags.append({"rule": ComplianceRule.watchlist,
                                  "detail": f"Karşı taraf '{cp.name}' watchlist '{w.name}' ile eşleşti"})
                    break

    # 3) Structuring — sub-threshold transactions for the same counterparty that
    #    aggregate over the threshold within the window.
    if threshold > ZERO and txn.counterparty_id and usd < threshold:
        window = int(getattr(company, "aml_structuring_window_days", 1) or 1)
        since = txn.txn_date - timedelta(days=window)
        peers = (db.query(Transaction)
                   .filter(Transaction.company_id == company.id,
                           Transaction.counterparty_id == txn.counterparty_id,
                           Transaction.txn_date >= since,
                           Transaction.txn_date <= txn.txn_date)
                   .all())
        total = ZERO
        count = 0
        for p in peers:
            pu = _txn_usd(db, p)
            if pu < threshold:           # only sub-threshold pieces count
                total += pu
                count += 1
        if count > 1 and total >= threshold:
            flags.append({"rule": ComplianceRule.structuring,
                          "detail": f"{count} eşik-altı işlem toplamı ${total} ≥ eşik ${threshold}"})

    return flags


def evaluate_and_store(db: Session, txn: Transaction) -> list[ComplianceFlag]:
    """Screen a transaction and persist any new flags (idempotent per rule).
    Returns the transaction's open flags. Caller commits."""
    company = db.query(Company).filter(Company.id == txn.company_id).first()
    if not company:
        return []
    found = screen_transaction(db, company, txn)
    existing = {f.rule for f in db.query(ComplianceFlag)
                .filter(ComplianceFlag.transaction_id == txn.id).all()}
    for f in found:
        if f["rule"] in existing:
            continue
        db.add(ComplianceFlag(company_id=txn.company_id, transaction_id=txn.id,
                              rule=f["rule"], detail=f["detail"],
                              status=ComplianceStatus.open))
    db.flush()
    return (db.query(ComplianceFlag)
              .filter(ComplianceFlag.transaction_id == txn.id,
                      ComplianceFlag.status == ComplianceStatus.open)
              .all())


def has_open_flags(db: Session, txn_id) -> bool:
    return (db.query(ComplianceFlag.id)
              .filter(ComplianceFlag.transaction_id == txn_id,
                      ComplianceFlag.status == ComplianceStatus.open)
              .first()) is not None
