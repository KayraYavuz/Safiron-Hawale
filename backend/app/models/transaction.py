import uuid
import enum
from sqlalchemy import Column, String, Enum, ForeignKey, DateTime, Numeric, Date, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID


class TxnType(str, enum.Enum):
    remittance = "remittance"
    fx = "fx"
    swift = "swift"
    deposit = "deposit"
    withdrawal = "withdrawal"
    internal_transfer = "internal_transfer"


class TxnStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"


class LegType(str, enum.Enum):
    incoming = "in"
    outgoing = "out"


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_status",         "status"),
        Index("ix_transactions_txn_date",       "txn_date"),
        Index("ix_transactions_counterparty_id","counterparty_id"),
        Index("ix_transactions_type_status",    "txn_type", "status"),
        Index("ix_transactions_date_status",    "txn_date", "status"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    txn_number = Column(String(20), unique=True, nullable=False, index=True)
    txn_date = Column(Date, nullable=False)
    value_date = Column(Date, nullable=False)
    txn_type = Column(Enum(TxnType), nullable=False)
    status = Column(Enum(TxnStatus), default=TxnStatus.pending)
    counterparty_id = Column(GUID(), ForeignKey("counterparties.id"), nullable=True)
    counterparty_role = Column(String(20), nullable=True)
    notes = Column(Text)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    approved_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    counterparty = relationship("Counterparty", back_populates="transactions")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    legs = relationship("TransactionLeg", back_populates="transaction", cascade="all, delete-orphan")
    pnl  = relationship("TransactionPnL", back_populates="transaction", uselist=False, cascade="all, delete-orphan")
    supplier_settlement = relationship("SupplierSettlement", back_populates="transaction", uselist=False, cascade="all, delete-orphan")


class TransactionLeg(Base):
    __tablename__ = "transaction_legs"
    __table_args__ = (
        Index("ix_legs_account_id",      "account_id"),
        Index("ix_legs_transaction_id",  "transaction_id"),
        Index("ix_legs_account_legtype", "account_id", "leg_type"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(GUID(), ForeignKey("transactions.id"), nullable=False)
    leg_type = Column(Enum(LegType), nullable=False)
    account_id = Column(GUID(), ForeignKey("accounts.id"), nullable=False)
    currency_id = Column(GUID(), ForeignKey("currencies.id"), nullable=False)
    amount = Column(Numeric(18, 4), nullable=False)
    rate_usd = Column(Numeric(18, 8), default=1)
    amount_usd = Column(Numeric(18, 4), default=0)
    reference = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("Transaction", back_populates="legs")
    account = relationship("Account", back_populates="legs")
    currency = relationship("Currency")


class TransactionPnL(Base):
    """
    İşlem kâr/zarar kaydı.

    Terminoloji (business rule):
      source_currency  = müşterinin VERDİĞİ para (A lokasyonu)
      dest_currency    = müşterinin ALDIĞI para (B lokasyonu)
      customer_rate    = 1 USD = X currency (operatörün müşteriye uyguladığı)
      supplier_rate    = 1 USD = X currency (operatörün piyasadan aldığı)
      usd_amount       = işlemin USD bazında referans miktarı

    Kâr:
      Case A (dest=USD): profit = customer_pays - supplier_cost       [sourceCur]
      Case B (src=USD):  profit = supplier_settlement - customer_gets [destCur]
    """
    __tablename__ = "transaction_pnl"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(GUID(), ForeignKey("transactions.id"), unique=True, nullable=False)

    # Kur ve yön bilgisi
    source_currency = Column(String(5), nullable=True)   # müşteri veriyor
    dest_currency   = Column(String(5), nullable=True)   # müşteri alıyor
    usd_amount      = Column(Numeric(18, 4), nullable=True)
    customer_rate   = Column(Numeric(18, 8), nullable=True)  # 1 USD = X
    supplier_rate   = Column(Numeric(18, 8), nullable=True)  # 1 USD = X

    # Müşteri
    customer_pays          = Column(Numeric(18, 4), nullable=True)
    customer_pays_currency = Column(String(5), nullable=True)
    customer_receives          = Column(Numeric(18, 4), nullable=True)
    customer_receives_currency = Column(String(5), nullable=True)

    # Tedarikçi
    supplier_settlement          = Column(Numeric(18, 4), nullable=True)
    supplier_settlement_currency = Column(String(5), nullable=True)

    # Kâr
    profit          = Column(Numeric(18, 4), default=0)
    profit_currency = Column(String(5), nullable=True)
    profit_usd      = Column(Numeric(18, 4), default=0)

    # Komisyon ve net
    commission_usd = Column(Numeric(18, 4), default=0)
    net_pnl_usd    = Column(Numeric(18, 4), default=0)

    # Geriye dönük uyumluluk alanları (raporlar için)
    gross_profit_quote          = Column(Numeric(18, 4), default=0)
    gross_profit_quote_currency = Column(String(5), default="USD")
    gross_profit_usd            = Column(Numeric(18, 4), default=0)

    transaction = relationship("Transaction", back_populates="pnl")


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"
    __table_args__ = (
        Index("ix_exchange_rates_currency_date", "currency_code", "date"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, index=True)
    currency_code = Column(String(5), nullable=False, index=True)
    rate_per_usd = Column(Numeric(18, 8), nullable=False)  # 1 USD = ? currency
    source = Column(String, default="manual")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SupplierSettlementType(str, enum.Enum):
    registered   = "registered"    # kayıtlı tedarikçi
    external     = "external"      # kayıtsız / harici
    internal     = "internal"      # tedarikçisiz, iç kasa hareketi


class SupplierSettlement(Base):
    """
    Tedarikçi Uzlaşma Kaydı — müşteri işleminden TAMAMEN BAĞIMSIZ.

    Bu kayıt:
      - Müşteri kurunu ASLA içermez, kullanmaz, görüntülemez.
      - Yalnızca tedarikçi tarafi ilgilendiren verileri tutar.
      - İşlemle ilişkisi sadece transaction_id üzerinden kurulur.

    Mantık:
      source_location → dest_location yönünde bir işlem için:
        Tedarikçi source tarafında alacaklı olur  (receivable)
        Tedarikçi dest   tarafında borçlu  olur  (payable)

      supplier_rate: 1 USD = X {non_usd_currency}   (daima bu format)
      settlement_amount_usd: referans USD miktarı

      Case A (dest=USD): 
        supplier_receivable = settlement_amount_usd × supplier_rate  [sourceCur]
        supplier_payable    = settlement_amount_usd                  [USD]

      Case B (src=USD):
        supplier_receivable = settlement_amount_usd                  [USD]
        supplier_payable    = settlement_amount_usd × supplier_rate  [destCur]
    """
    __tablename__ = "supplier_settlements"

    id             = Column(GUID(), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(GUID(), ForeignKey("transactions.id"), nullable=False)

    # Uzlaşma türü
    settlement_type = Column(Enum(SupplierSettlementType), nullable=False)

    # Tedarikçi — ya kayıtlı (counterparty_id) ya harici (external_name)
    counterparty_id = Column(GUID(), ForeignKey("counterparties.id"), nullable=True)
    external_name   = Column(String, nullable=True)  # harici tedarikçi adı

    # Yön (işlemden kopyalanır, müşteri verisi içermez)
    source_currency = Column(String(5), nullable=True)
    dest_currency   = Column(String(5), nullable=True)

    # Tedarikçi kuru — 1 USD = X {currency}  (müşteri kuruyla KARISTIRILMAZ)
    supplier_rate = Column(Numeric(18, 8), nullable=True)

    # Referans USD miktarı
    settlement_amount_usd = Column(Numeric(18, 4), nullable=True)

    # Hesaplanan uzlaşma tutarları
    receivable_amount          = Column(Numeric(18, 4), nullable=True)  # tedarikçi bize borçlu
    receivable_currency        = Column(String(5),      nullable=True)
    payable_amount             = Column(Numeric(18, 4), nullable=True)  # biz tedarikçiye borçluyuz
    payable_currency           = Column(String(5),      nullable=True)

    # Lokasyon etkileri
    receivable_location_id = Column(GUID(), ForeignKey("locations.id"), nullable=True)
    payable_location_id    = Column(GUID(), ForeignKey("locations.id"), nullable=True)

    notes      = Column(Text, nullable=True)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction          = relationship("Transaction", back_populates="supplier_settlement")
    counterparty         = relationship("Counterparty")
    receivable_location  = relationship("Location", foreign_keys=[receivable_location_id])
    payable_location     = relationship("Location", foreign_keys=[payable_location_id])
    created_by_user      = relationship("User", foreign_keys=[created_by])


class AuditLog(Base):
    """
    Denetim kaydı — kim, ne zaman, ne yaptı.
    Her kritik işlemde otomatik oluşur.
    """
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_created_at", "created_at"),
        Index("ix_audit_user_action", "user_id", "action"),
    )
    id         = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id    = Column(GUID(), ForeignKey("users.id"), nullable=True)
    action     = Column(String(50), nullable=False)   # CREATE, UPDATE, DELETE, LOGIN, LOGOUT
    entity     = Column(String(50), nullable=True)    # Transaction, Counterparty, User...
    entity_id  = Column(String(100), nullable=True)
    detail     = Column(Text, nullable=True)           # JSON string
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
