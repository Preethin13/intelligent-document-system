from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    invoice = "invoice"
    receipt = "receipt"
    contract = "contract"
    id_document = "id_document"
    generic = "generic"


class LineItem(BaseModel):
    description: str | None = None
    quantity: float | None = None
    unit_price: float | None = None
    amount: float | None = None


class InvoiceData(BaseModel):
    vendor_name: str | None = None
    invoice_number: str | None = None
    invoice_date: str | None = None
    due_date: str | None = None
    currency: str | None = None
    line_items: list[LineItem] = Field(default_factory=list)
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None
    bill_to: str | None = None
    field_confidence: dict[str, float] = Field(default_factory=dict)


class ReceiptItem(BaseModel):
    description: str | None = None
    quantity: float | None = None
    amount: float | None = None


class ReceiptData(BaseModel):
    merchant: str | None = None
    datetime: str | None = None
    currency: str | None = None
    items: list[ReceiptItem] = Field(default_factory=list)
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None
    payment_method: str | None = None
    field_confidence: dict[str, float] = Field(default_factory=dict)


class ContractParty(BaseModel):
    name: str | None = None
    role: str | None = None


class ContractClause(BaseModel):
    name: str | None = None
    excerpt: str | None = None


class ContractData(BaseModel):
    title: str | None = None
    parties: list[ContractParty] = Field(default_factory=list)
    effective_date: str | None = None
    expiration_date: str | None = None
    governing_law: str | None = None
    key_clauses: list[ContractClause] = Field(default_factory=list)
    signatures_present: bool | None = None
    field_confidence: dict[str, float] = Field(default_factory=dict)


class IdDocumentData(BaseModel):
    id_type: Literal["passport", "license", "other"] | None = None
    full_name: str | None = None
    date_of_birth: str | None = None
    document_number: str | None = None
    issue_date: str | None = None
    expiry_date: str | None = None
    country: str | None = None
    address: str | None = None
    field_confidence: dict[str, float] = Field(default_factory=dict)


class GenericKV(BaseModel):
    key: str
    value: str | None = None


class GenericData(BaseModel):
    summary: str | None = None
    fields: list[GenericKV] = Field(default_factory=list)
    field_confidence: dict[str, float] = Field(default_factory=dict)


TYPE_MODELS: dict[DocumentType, type[BaseModel]] = {
    DocumentType.invoice: InvoiceData,
    DocumentType.receipt: ReceiptData,
    DocumentType.contract: ContractData,
    DocumentType.id_document: IdDocumentData,
    DocumentType.generic: GenericData,
}


def model_for(doc_type: str) -> type[BaseModel]:
    return TYPE_MODELS[DocumentType(doc_type)]


def json_schema_for(doc_type: str) -> dict[str, Any]:
    return model_for(doc_type).model_json_schema()
