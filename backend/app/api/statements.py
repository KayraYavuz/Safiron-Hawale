"""GL-backed financial statement endpoints (read-only). JSON by default, CSV via ?format=csv."""
import csv
import io
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.accounting import ChartOfAccount, JournalEntry, JournalLine, JournalStatus
from app.models.master import Counterparty
from app.services import statements, partner_reports

router = APIRouter(prefix="/api/accounting", tags=["statements"])


@router.get("/gl-summary")
def gl_summary(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    """Compact dashboard widget data: is the ledger initialised, balanced, and the headline totals."""
    initialised = db.query(ChartOfAccount).filter(ChartOfAccount.company_id == cu.company_id).first() is not None
    if not initialised:
        return {"initialised": False, "balanced": True, "entry_count": 0,
                "total_debit": 0, "total_credit": 0, "total_assets": 0,
                "total_liabilities": 0, "total_equity": 0, "net_income": 0}
    tb = statements.trial_balance(db, cu.company_id)
    bs = statements.balance_sheet(db, cu.company_id)
    entry_count = (db.query(JournalEntry)
                     .filter(JournalEntry.company_id == cu.company_id,
                             JournalEntry.status == JournalStatus.posted)
                     .count())
    return {
        "initialised": True,
        "balanced": tb["total_debit"] == tb["total_credit"],
        "entry_count": entry_count,
        "total_debit": tb["total_debit"], "total_credit": tb["total_credit"],
        "total_assets": bs["total_assets"], "total_liabilities": bs["total_liabilities"],
        "total_equity": bs["total_equity"], "net_income": bs["net_income"],
    }


def _csv(rows, header, filename):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    for r in rows:
        w.writerow(r)
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/trial-balance")
def trial_balance(as_of: Optional[date] = None, format: str = "json",
                  db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    data = statements.trial_balance(db, cu.company_id, as_of=as_of)
    if format == "csv":
        rows = [[r["code"], r["name_tr"], r["account_type"], r["debit_usd"], r["credit_usd"], r["balance_usd"]]
                for r in data["rows"]]
        rows.append(["", "TOPLAM", "", data["total_debit"], data["total_credit"], ""])
        return _csv(rows, ["code", "name", "type", "debit_usd", "credit_usd", "balance_usd"], "mizan.csv")
    return data


@router.get("/balance-sheet")
def balance_sheet(as_of: Optional[date] = None, format: str = "json",
                  db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    data = statements.balance_sheet(db, cu.company_id, as_of=as_of)
    if format == "csv":
        rows = []
        for section, key in (("ASSET", "assets"), ("LIABILITY", "liabilities"), ("EQUITY", "equity")):
            for r in data[key]:
                rows.append([section, r["code"], r["name_tr"], r["balance_usd"]])
        rows.append(["", "", "TOTAL ASSETS", data["total_assets"]])
        rows.append(["", "", "TOTAL LIABILITIES", data["total_liabilities"]])
        rows.append(["", "", "TOTAL EQUITY", data["total_equity"]])
        rows.append(["", "", "NET INCOME", data["net_income"]])
        return _csv(rows, ["section", "code", "name", "balance_usd"], "bilanco.csv")
    return data


@router.get("/income-statement-gl")
def income_statement_gl(start: date, end: date, format: str = "json",
                        db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    data = statements.income_statement(db, cu.company_id, start, end)
    if format == "csv":
        rows = []
        for r in data["revenue"]:
            rows.append(["REVENUE", r["code"], r["name_tr"], r["amount_usd"]])
        for r in data["expense"]:
            rows.append(["EXPENSE", r["code"], r["name_tr"], r["amount_usd"]])
        rows.append(["", "", "TOTAL REVENUE", data["total_revenue"]])
        rows.append(["", "", "TOTAL EXPENSE", data["total_expense"]])
        rows.append(["", "", "NET", data["net"]])
        return _csv(rows, ["section", "code", "name", "amount_usd"], "gelir_tablosu.csv")
    return data


@router.get("/partners")
def partners_with_activity(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    """Counterparties that have GL activity (for the partner-ledger picker)."""
    ids = [r[0] for r in (db.query(JournalLine.counterparty_id)
                            .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
                            .filter(JournalEntry.company_id == cu.company_id,
                                    JournalLine.counterparty_id.isnot(None))
                            .distinct().all())]
    if not ids:
        return []
    cps = db.query(Counterparty).filter(Counterparty.id.in_(ids)).order_by(Counterparty.name).all()
    return [{"id": str(c.id), "name": c.name, "code": c.code} for c in cps]


@router.get("/partner-ledger/{counterparty_id}")
def partner_ledger(counterparty_id: UUID, start: Optional[date] = None, end: Optional[date] = None,
                   format: str = "json", db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    data = partner_reports.partner_ledger(db, cu.company_id, counterparty_id, start, end)
    if format == "csv":
        rows = [[l["entry_date"], l["entry_number"], l["account_code"], l["memo"], l["debit_usd"], l["credit_usd"], l["running_usd"]]
                for l in data["lines"]]
        return _csv(rows, ["date", "entry", "account", "memo", "debit_usd", "credit_usd", "running_usd"], "cari_ekstre.csv")
    return data


@router.get("/aged-balance")
def aged_balance(as_of: Optional[date] = None, format: str = "json",
                 db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    data = partner_reports.aged_balance(db, cu.company_id, as_of or date.today())
    if format == "csv":
        rows = [[r["name"], r["current"], r["d31_60"], r["d61_90"], r["d90_plus"], r["total"]] for r in data["rows"]]
        rows.append(["TOPLAM", data["current"], data["d31_60"], data["d61_90"], data["d90_plus"], data["total"]])
        return _csv(rows, ["partner", "current", "31_60", "61_90", "90_plus", "total"], "yaslandirma.csv")
    return data


@router.get("/general-ledger/{account_id}")
def general_ledger(account_id: UUID, start: Optional[date] = None, end: Optional[date] = None,
                   format: str = "json", db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    data = statements.general_ledger(db, cu.company_id, account_id, start, end)
    if format == "csv":
        rows = [[l["entry_number"], l["entry_date"], l["memo"], l["debit_usd"], l["credit_usd"], l["running_usd"]]
                for l in data["lines"]]
        return _csv(rows, ["entry_number", "date", "memo", "debit_usd", "credit_usd", "running_usd"], "defter_kebir.csv")
    return data
