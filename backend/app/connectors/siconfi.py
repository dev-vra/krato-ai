"""Conector SICONFI — Tesouro Nacional.

Dados fiscais padronizados e comparáveis entre entes (RREO/RGF).
API: https://apidatalake.tesouro.gov.br/ords/siconfi/tt
"""

from __future__ import annotations

from ..models import NormalizedRecord, RecordKind
from .base import Connector, QueryParam

BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt"


class SiconfiConnector(Connector):
    source_id = "siconfi"
    label = "SICONFI — RREO"
    params = [
        QueryParam("an_exercicio", "Exercício (ano)", "number", required=True, help="Ex.: 2024."),
        QueryParam("nr_periodo", "Período", "number", required=True, help="Bimestre 1-6."),
        QueryParam("id_ente", "Código do ente (IBGE)", "text", required=True,
                   help="Código do ente federativo (União=1, ou código IBGE)."),
    ]

    async def fetch(self, **query) -> list[NormalizedRecord]:
        for req in ("an_exercicio", "nr_periodo", "id_ente"):
            if not query.get(req):
                raise ValueError(f"SICONFI exige '{req}'.")
        params = {
            "an_exercicio": int(query["an_exercicio"]),
            "nr_periodo": int(query["nr_periodo"]),
            "co_tipo_demonstrativo": query.get("co_tipo_demonstrativo", "RREO"),
            "id_ente": str(query["id_ente"]),
        }
        client = self._http()
        try:
            resp = await client.get(f"{BASE}/rreo", params=params)
            resp.raise_for_status()
            payload = resp.json()
        finally:
            if self._client is None:
                await client.aclose()

        return [self._normalize(query, it) for it in payload.get("items", [])]

    def _normalize(self, query: dict, it: dict) -> NormalizedRecord:
        ente = it.get("ente") or str(query.get("id_ente"))
        conta = it.get("conta") or "Conta RREO"
        native = f"{query['an_exercicio']}-{query['nr_periodo']}-{it.get('cod_conta','')}-{it.get('coluna','')}"
        return NormalizedRecord(
            id=f"siconfi:{native}",
            source_id=self.source_id,
            kind=RecordKind.FISCAL,
            title=f"{conta} — {it.get('coluna','')}",
            description=f"RREO {query['an_exercicio']} / {query['nr_periodo']}º período · {ente}",
            entity_name=ente,
            amount=_as_float(it.get("valor")),
            uf=it.get("uf"),
            raw=it,
        )


def _as_float(value) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None
