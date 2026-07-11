"""Modelo comum de registro normalizado.

Conectores heterogêneos (contratos, despesas, reembolsos, diários) convergem para
``NormalizedRecord``, o que torna possível buscar e comparar dados entre fontes.
"""

from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class RecordKind(str, Enum):
    CONTRATO = "contrato"
    LICITACAO = "licitacao"
    DESPESA = "despesa"
    REEMBOLSO = "reembolso"
    DIARIO = "diario_oficial"
    FISCAL = "fiscal"
    DATASET = "dataset"
    SANCAO = "sancao"
    EMPRESA = "empresa"


class NormalizedRecord(BaseModel):
    """Registro normalizado, agnóstico à fonte."""

    id: str = Field(..., description="ID estável: '{source_id}:{native_id}'")
    source_id: str
    kind: RecordKind
    title: str
    description: str | None = None
    # entidades
    entity_name: str | None = Field(None, description="Órgão / ente público")
    counterparty_name: str | None = Field(None, description="Fornecedor / favorecido")
    counterparty_doc: str | None = Field(None, description="CNPJ/CPF quando disponível")
    # valores e datas
    amount: float | None = None
    currency: str = "BRL"
    occurred_on: date | None = None
    # geografia
    uf: str | None = None
    municipality: str | None = None
    ibge_code: str | None = None
    # rastreabilidade
    source_url: str | None = None
    raw: dict = Field(default_factory=dict, description="Payload bruto para auditoria")

    def search_text(self) -> str:
        parts = [
            self.title,
            self.description or "",
            self.entity_name or "",
            self.counterparty_name or "",
            self.municipality or "",
            self.uf or "",
            self.kind.value,
        ]
        return " · ".join(p for p in parts if p)
