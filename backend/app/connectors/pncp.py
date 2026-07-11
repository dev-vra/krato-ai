"""Conector PNCP — Portal Nacional de Contratações Públicas.

API REST pública (Lei 14.133/2021), sem autenticação para consulta.
Docs: https://pncp.gov.br/api/consulta/swagger-ui/index.html
"""

from __future__ import annotations

from datetime import date, datetime

from ..models import NormalizedRecord, RecordKind
from .base import Connector, QueryParam

BASE = "https://pncp.gov.br/api/consulta/v1"


def _to_yyyymmdd(value: str) -> str:
    """Aceita 'YYYY-MM-DD' ou 'YYYYMMDD' e devolve 'YYYYMMDD'."""
    v = value.replace("-", "")
    if len(v) != 8 or not v.isdigit():
        raise ValueError(f"data inválida: {value!r} (use YYYY-MM-DD)")
    return v


def _parse_date(value) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "")).date()
    except ValueError:
        try:
            return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
        except ValueError:
            return None


class PNCPConnector(Connector):
    source_id = "pncp"
    label = "PNCP — Contratos"
    params = [
        QueryParam("data_inicial", "Data inicial", "date", required=True,
                   help="Início do período de assinatura (YYYY-MM-DD)."),
        QueryParam("data_final", "Data final", "date", required=True,
                   help="Fim do período de assinatura (YYYY-MM-DD)."),
        QueryParam("pagina", "Página", "number", help="Paginação (padrão 1)."),
    ]

    async def fetch(self, **query) -> list[NormalizedRecord]:
        data_inicial = query.get("data_inicial")
        data_final = query.get("data_final")
        if not data_inicial or not data_final:
            raise ValueError("PNCP exige 'data_inicial' e 'data_final'.")
        params = {
            "dataInicial": _to_yyyymmdd(data_inicial),
            "dataFinal": _to_yyyymmdd(data_final),
            "pagina": int(query.get("pagina", 1)),
        }
        client = self._http()
        try:
            resp = await client.get(f"{BASE}/contratos", params=params)
            resp.raise_for_status()
            payload = resp.json()
        finally:
            if self._client is None:
                await client.aclose()

        items = payload.get("data", []) if isinstance(payload, dict) else []
        return [self._normalize(it) for it in items]

    def _normalize(self, it: dict) -> NormalizedRecord:
        orgao = (it.get("orgaoEntidade") or {})
        unidade = (it.get("unidadeOrgao") or {})
        native_id = str(it.get("numeroControlePNCP") or it.get("id") or it.get("sequencialContrato") or "")
        return NormalizedRecord(
            id=f"pncp:{native_id}",
            source_id=self.source_id,
            kind=RecordKind.CONTRATO,
            title=it.get("objetoContrato") or "Contrato PNCP",
            description=it.get("informacaoComplementar"),
            entity_name=orgao.get("razaoSocial") or unidade.get("nomeUnidade"),
            counterparty_name=it.get("nomeRazaoSocialFornecedor"),
            counterparty_doc=it.get("niFornecedor"),
            amount=_as_float(it.get("valorGlobal") or it.get("valorInicial")),
            occurred_on=_parse_date(it.get("dataAssinatura") or it.get("dataVigenciaInicio")),
            uf=unidade.get("ufSigla"),
            municipality=unidade.get("municipioNome"),
            source_url=f"https://pncp.gov.br/app/contratos/{native_id}" if native_id else None,
            raw=it,
        )


def _as_float(value) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
