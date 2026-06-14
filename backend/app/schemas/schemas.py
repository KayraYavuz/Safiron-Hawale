from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from app.models.user import UserRole
from app.models.master import AccountType, CounterpartyType
from app.models.transaction import TxnType, TxnStatus, LegType

# ── Auth ──────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    device_token: Optional[str] = None   # "Cihaza güven" seçilirse dolu gelir

# ── Company ───────────────────────────────────────────────────────────────────
class CompanyCreate(BaseModel):
    name: str
    code: str
    admin_name: str
    admin_email: EmailStr
    admin_password: str
    accounting_scheme: str = "thp"   # "thp" | "intl" — auto-initialised on create

class CompanyOut(BaseModel):
    id: UUID
    name: str
    code: str
    is_active: bool = True
    telegram_bot_token: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# ── User ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.viewer
    company_id: Optional[UUID] = None

class UserOut(BaseModel):
    id: UUID
    name: str
    email: str
    role: UserRole
    is_active: bool
    is_approved: bool = True
    created_at: datetime
    company_id: Optional[UUID] = None
    bot_pin: Optional[str] = None       # Telegram bağlama kodu
    telegram_id: Optional[str] = None  # Bağlı Telegram hesabı
    class Config:
        from_attributes = True

# ── Location ──────────────────────────────────────────────────────────────────
class LocationCreate(BaseModel):
    code: str
    name_tr: str
    name_ar: str = ""
    name_en: str = ""
    country: Optional[str] = None

class LocationUpdate(BaseModel):
    name_tr: Optional[str] = None
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    country: Optional[str] = None

class LocationOut(BaseModel):
    id: UUID
    code: str
    name_tr: str
    name_ar: str
    name_en: str
    country: Optional[str]
    is_active: bool
    class Config:
        from_attributes = True

# ── Currency ──────────────────────────────────────────────────────────────────
class CurrencyOut(BaseModel):
    id: UUID
    code: str
    name_tr: str
    name_ar: str
    name_en: str
    symbol: Optional[str]
    decimal_places: int
    is_active: bool
    class Config:
        from_attributes = True

# ── Account ───────────────────────────────────────────────────────────────────
class AccountCreate(BaseModel):
    location_id: UUID
    currency_id: UUID
    account_type: AccountType
    name: str
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    swift_code: Optional[str] = None
    wallet_address: Optional[str] = None
    opening_balance: Decimal = Decimal("0")

class AccountOut(BaseModel):
    id: UUID
    location_id: UUID
    currency_id: UUID
    account_type: AccountType
    name: str
    bank_name: Optional[str]
    account_number: Optional[str]
    swift_code: Optional[str]
    wallet_address: Optional[str]
    opening_balance: Decimal
    is_active: bool
    location: Optional[LocationOut] = None
    currency: Optional[CurrencyOut] = None
    class Config:
        from_attributes = True

# ── Counterparty ──────────────────────────────────────────────────────────────
class CounterpartyCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    type: CounterpartyType
    country: Optional[str] = None
    phone: Optional[str] = None
    credit_limit_usd: Decimal = Decimal("0")

class CounterpartyOut(BaseModel):
    id: UUID
    code: str
    name: str
    name_ar: Optional[str]
    type: CounterpartyType
    country: Optional[str]
    phone: Optional[str]
    credit_limit_usd: Decimal
    is_active: bool
    bot_pin: Optional[str] = None          # Telegram bot erişim kodu
    telegram_id: Optional[str] = None      # Bağlı Telegram kullanıcısı
    class Config:
        from_attributes = True

# ── Exchange Rate ─────────────────────────────────────────────────────────────
class ExchangeRateCreate(BaseModel):
    date: date
    currency_code: str
    rate_per_usd: Decimal  # 1 USD = ? currency (daima bu format)

class ExchangeRateOut(BaseModel):
    id: UUID
    date: date
    currency_code: str
    rate_per_usd: Decimal
    source: str
    class Config:
        from_attributes = True

# ── Transaction ───────────────────────────────────────────────────────────────
class LegCreate(BaseModel):
    leg_type: LegType
    account_id: UUID
    currency_id: UUID
    amount: Decimal
    reference: Optional[str] = None

class LegOut(BaseModel):
    id: UUID
    leg_type: LegType
    account_id: UUID
    currency_id: UUID
    amount: Decimal
    amount_usd: Decimal
    reference: Optional[str]
    account: Optional[AccountOut] = None
    currency: Optional[CurrencyOut] = None
    class Config:
        from_attributes = True

class PnLOut(BaseModel):
    """
    Kâr/zarar çıktısı — iş kuralı terminolojisiyle.

    Kur formatı: 1 USD = X {currency}  (daima)
    Direction: source → dest (müşteri source'da verir, dest'te alır)
    """
    # Yön
    source_currency: Optional[str]
    dest_currency:   Optional[str]
    usd_amount:      Optional[Decimal]

    # Kurlar (1 USD = X)
    customer_rate: Optional[Decimal]  # operatörün müşteriye uyguladığı
    supplier_rate: Optional[Decimal]  # operatörün piyasadan aldığı

    # Müşteri
    customer_pays:             Optional[Decimal]
    customer_pays_currency:    Optional[str]
    customer_receives:         Optional[Decimal]
    customer_receives_currency: Optional[str]

    # Tedarikçi
    supplier_settlement:          Optional[Decimal]
    supplier_settlement_currency: Optional[str]

    # Kâr
    profit:          Optional[Decimal]
    profit_currency: Optional[str]
    profit_usd:      Optional[Decimal]

    # Net
    commission_usd: Decimal
    net_pnl_usd:    Decimal

    # Geriye dönük uyumluluk
    gross_profit_quote:          Decimal
    gross_profit_quote_currency: str
    gross_profit_usd:            Decimal

    class Config:
        from_attributes = True

class TransactionCreate(BaseModel):
    txn_date:   date
    value_date: date
    txn_type:   TxnType
    counterparty_id:   Optional[UUID] = None
    counterparty_role: Optional[str]  = None
    notes: Optional[str] = None
    legs:  List[LegCreate]

    # FX/Remittance/SWIFT için kur bilgileri
    # Kur formatı: 1 USD = X {currency}  (daima)
    # source_currency = müşterinin VERDİĞİ para (outgoing leg'in currency'si)
    # dest_currency   = müşterinin ALDIĞI para  (incoming leg'in currency'si)
    usd_amount:    Optional[Decimal] = None  # işlemin USD bazında referans miktarı
    customer_rate: Optional[Decimal] = None  # 1 USD = X — operatör müşteriye bu kuru uygular
    supplier_rate: Optional[Decimal] = None  # 1 USD = X — operatör piyasadan bu kurla alır
    commission_usd: Optional[Decimal] = None

class TransactionOut(BaseModel):
    id: UUID
    txn_number: str
    txn_date:   date
    value_date: date
    txn_type:   TxnType
    status:     TxnStatus
    counterparty_id:   Optional[UUID]
    counterparty_role: Optional[str]
    notes:      Optional[str]
    created_at: datetime
    counterparty: Optional[CounterpartyOut] = None
    legs: List[LegOut] = []
    pnl:  Optional[PnLOut] = None
    supplier_settlement: Optional['SupplierSettlementOut'] = None
    class Config:
        from_attributes = True

# Forward reference çözümü: SupplierSettlementOut tanımlandıktan sonra rebuild
# (Bu dosyanın sonunda model_rebuild() çağrılır)

# ── Supplier Settlement ───────────────────────────────────────────────────────
from app.models.transaction import SupplierSettlementType

class SupplierSettlementCreate(BaseModel):
    """
    Tedarikçi uzlaşma oluşturma.

    KURAL: customer_rate bu şemada YOK ve OLAMAZ.
    Yalnızca tedarikçi tarafı bilgileri içerir.
    """
    settlement_type:       SupplierSettlementType
    counterparty_id:       Optional[UUID]   = None   # kayıtlı tedarikçi
    external_name:         Optional[str]    = None   # harici tedarikçi adı
    supplier_rate:         Optional[Decimal] = None  # 1 USD = X {currency}
    settlement_amount_usd: Optional[Decimal] = None  # referans USD miktarı
    notes:                 Optional[str]    = None

class SupplierSettlementOut(BaseModel):
    id:             UUID
    transaction_id: UUID
    settlement_type: SupplierSettlementType
    counterparty_id:  Optional[UUID]
    external_name:    Optional[str]
    source_currency:  Optional[str]
    dest_currency:    Optional[str]
    supplier_rate:    Optional[Decimal]
    settlement_amount_usd: Optional[Decimal]
    receivable_amount:   Optional[Decimal]
    receivable_currency: Optional[str]
    payable_amount:      Optional[Decimal]
    payable_currency:    Optional[str]
    receivable_location_id: Optional[UUID]
    payable_location_id:    Optional[UUID]
    notes:      Optional[str]
    created_at: datetime
    counterparty: Optional[CounterpartyOut] = None
    receivable_location: Optional[LocationOut] = None
    payable_location:    Optional[LocationOut] = None
    class Config:
        from_attributes = True

# Forward reference çözümü
TransactionOut.model_rebuild()

# ── AI Reports ────────────────────────────────────────────────────────────────
class SavedReportCreate(BaseModel):
    title: str
    content: str
    is_favorite: bool = False

class SavedReportOut(BaseModel):
    id: UUID
    title: str
    content: str
    created_at: datetime
    is_favorite: bool
    class Config:
        from_attributes = True

# ── Chart of Accounts ─────────────────────────────────────────────────────────
class InitializeChart(BaseModel):
    scheme: str  # "thp" | "intl"


class CoaAccountCreate(BaseModel):
    code: str
    name_tr: str
    name_ar: str = ""
    name_en: str = ""
    account_type: str            # asset|liability|equity|revenue|expense
    thp_class: Optional[int] = None
    parent_id: Optional[UUID] = None
    is_postable: bool = True
    currency_id: Optional[UUID] = None


class CoaAccountUpdate(BaseModel):
    name_tr: Optional[str] = None
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    is_postable: Optional[bool] = None
    is_active: Optional[bool] = None
    parent_id: Optional[UUID] = None


class CoaAccountOut(BaseModel):
    id: UUID
    code: str
    name_tr: str
    name_ar: str
    name_en: str
    account_type: str
    thp_class: Optional[int] = None
    parent_id: Optional[UUID] = None
    is_postable: bool
    currency_id: Optional[UUID] = None
    scheme: str
    is_active: bool
    class Config:
        from_attributes = True


class MappingUpdate(BaseModel):
    role: str
    coa_account_id: UUID


class MappingOut(BaseModel):
    role: str
    coa_account_id: Optional[UUID] = None
    class Config:
        from_attributes = True

# ── Journal ───────────────────────────────────────────────────────────────────
class JournalLineIn(BaseModel):
    coa_account_id: UUID
    debit_usd: Decimal = Decimal("0")
    credit_usd: Decimal = Decimal("0")
    counterparty_id: Optional[UUID] = None


class ManualJournalCreate(BaseModel):
    entry_date: date
    memo: Optional[str] = None
    lines: List[JournalLineIn]


class JournalLineOut(BaseModel):
    id: UUID
    coa_account_id: UUID
    debit: Decimal
    credit: Decimal
    debit_usd: Decimal
    credit_usd: Decimal
    counterparty_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    class Config:
        from_attributes = True


class JournalEntryOut(BaseModel):
    id: UUID
    entry_number: str
    journal_code: Optional[str] = None
    entry_date: date
    source_type: str
    status: str
    memo: Optional[str] = None
    lines: List[JournalLineOut] = []
    class Config:
        from_attributes = True
