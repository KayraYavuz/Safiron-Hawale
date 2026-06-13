"""
One-time, idempotent GL backfill.

For each company (or one given), ensure a chart is initialised, then post every
COMPLETED transaction into the ledger. Re-runnable: post_transaction is idempotent
per source, so already-posted transactions are skipped.

Posts transactions only — the transaction posting already books the counterparty
side, so settlements are not posted separately (would double-count).
"""
from sqlalchemy.orm import Session

from app.models.master import Company
from app.models.transaction import Transaction, TxnStatus
from app.models.accounting import ChartOfAccount
from app.services.accounting_seed import initialize_chart
from app.services.posting import post_transaction, existing_entry_for_source, PostingError


def _ensure_chart(db: Session, company_id, default_scheme: str):
    has_chart = db.query(ChartOfAccount).filter(ChartOfAccount.company_id == company_id).first()
    if not has_chart:
        co = db.query(Company).filter(Company.id == company_id).first()
        scheme = (co.accounting_scheme if co and co.accounting_scheme else default_scheme)
        initialize_chart(db, company_id, scheme)


def backfill_gl(db: Session, company_id=None, default_scheme: str = "thp") -> dict:
    """Post all completed transactions for the given company (or all companies).
    Returns {company_id: {"posted": n, "skipped": m, "errors": k}}."""
    company_ids = ([company_id] if company_id else
                   [c.id for c in db.query(Company.id).all()])
    summary = {}
    for cid in company_ids:
        _ensure_chart(db, cid, default_scheme)
        posted = skipped = errors = 0
        txns = (db.query(Transaction)
                  .filter(Transaction.company_id == cid, Transaction.status == TxnStatus.completed)
                  .order_by(Transaction.txn_date, Transaction.created_at)
                  .all())
        for txn in txns:
            if existing_entry_for_source(db, txn.id):
                skipped += 1
                continue
            try:
                post_transaction(db, txn)
                posted += 1
            except PostingError:
                errors += 1
        db.commit()
        summary[str(cid)] = {"posted": posted, "skipped": skipped, "errors": errors}
    return summary
