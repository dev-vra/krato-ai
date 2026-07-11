"""Conector Câmara dos Deputados — despesas CEAP.

API pública sem autenticação.
Docs: https://dadosabertos.camara.leg.br/swagger/api.html
"""

from __future__ import annotations

from datetime import date, datetime

from ..models import NormalizedRecord, RecordKind
from .base import Connector, QueryParam

BASE = "https://dadosabertos.camara.leg.br/api/v2"


class CamaraCeapConnector(Connector):
    source_id = "camara"
    label = "Câmara — Despesas CEAP"
    params = [
        QueryParam("deputado_id", "ID do deputado", "number", required=True,
                   help="Identificador do deputado na API da Câmara."),
        QueryParam("ano", "Ano", "number", help="Ano das despesas (ex.: 2024)."),
        QueryParam("mes", "Mês", "number", help="Mês (1-12), opcional."),
    ]

    async def search_deputados(self, nome: str) -> list[dict]:
        """Auxiliar: resolve nome → id de deputado."""
        client = self._http()
        try:
            resp = await client.get(f"{BASE}/deputados", params={"nome": nome, "ordem": "ASC",
                                                                 "ordenarPor": "nome"})
            resp.raise_for_status()
            return resp.json().get("dados", [])
        finally:
            if self._client is None:
                await client.aclose()

    async def fetch(self, **query) -> list[NormalizedRecord]:
        deputado_id = query.get("deputado_id")
        if not deputado_id:
            raise ValueError("Câmara exige 'deputado_id'. Use search_deputados(nome) para resolver.")
        params: dict = {"itens": 100, "ordem": "DESC", "ordenarPor": "dataDocumento"}
        if query.get("ano"):
            params["ano"] = int(query["ano"])
        if query.get("mes"):
            params["mes"] = int(query["mes"])

        client = self._http()
        try:
            resp = await client.get(f"{BASE}/deputados/{int(deputado_id)}/despesas", params=params)
            resp.raise_for_status()
            payload = resp.json()
        finally:
            if self._client is None:
                await client.aclose()

        return [self._normalize(int(deputado_id), it) for it in payload.get("dados", [])]

    def _normalize(self, deputado_id: int, it: dict) -> NormalizedRecord:
        doc_num = it.get("codDocumento") or it.get("numDocumento") or ""
        return NormalizedRecord(
            id=f"camara:{deputado_id}:{doc_num}",
            source_id=self.source_id,
            kind=RecordKind.REEMBOLSO,
            title=it.get("tipoDespesa") or "Despesa CEAP",
            description=it.get("nomeFornecedor"),
            entity_name="Câmara dos Deputados",
            counterparty_name=it.get("nomeFornecedor"),
            counterparty_doc=it.get("cnpjCpfFornecedor"),
            amount=_as_float(it.get("valorLiquido") or it.get("valorDocumento")),
            occurred_on=_parse_date(it.get("dataDocumento")),
            source_url=it.get("urlDocumento"),
            raw=it,
        )


def _as_float(value) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _parse_date(value) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except ValueError:
        return None
