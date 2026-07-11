"""Conector Portal da Transparência (CGU).

API oficial que exige token gratuito (header ``chave-api-dados``). Configure em
``PORTAL_TRANSPARENCIA_TOKEN``. Implementa a consulta de contratos do Poder
Executivo Federal.
Docs: https://api.portaldatransparencia.gov.br/swagger-ui/index.html
"""

from __future__ import annotations

from datetime import date, datetime

from ..config import get_settings
from ..models import NormalizedRecord, RecordKind
from .base import Connector, QueryParam

BASE = "https://api.portaldatransparencia.gov.br/api-de-dados"


class PortalTransparenciaConnector(Connector):
    source_id = "portal_transparencia"
    label = "Portal da Transparência — Contratos"
    params = [
        QueryParam("data_inicial", "Data inicial", "date", required=True, help="DD/MM/AAAA ou YYYY-MM-DD."),
        QueryParam("data_final", "Data final", "date", required=True, help="DD/MM/AAAA ou YYYY-MM-DD."),
        QueryParam("orgao", "Código do órgão (SIAFI)", "text", help="Opcional."),
        QueryParam("pagina", "Página", "number"),
    ]

    def _token(self) -> str:
        token = get_settings().portal_transparencia_token
        if not token:
            raise RuntimeError(
                "Portal da Transparência requer token. Defina PORTAL_TRANSPARENCIA_TOKEN "
                "(cadastro gratuito em api.portaldatransparencia.gov.br)."
            )
        return token

    async def fetch(self, **query) -> list[NormalizedRecord]:
        if not query.get("data_inicial") or not query.get("data_final"):
            raise ValueError("Exige 'data_inicial' e 'data_final'.")
        params = {
            "dataInicial": _to_ddmmyyyy(query["data_inicial"]),
            "dataFinal": _to_ddmmyyyy(query["data_final"]),
            "pagina": int(query.get("pagina", 1)),
        }
        if query.get("orgao"):
            params["codigoOrgao"] = query["orgao"]

        client = self._http()
        try:
            resp = await client.get(
                f"{BASE}/contratos",
                params=params,
                headers={"chave-api-dados": self._token()},
            )
            resp.raise_for_status()
            payload = resp.json()
        finally:
            if self._client is None:
                await client.aclose()

        items = payload if isinstance(payload, list) else payload.get("data", [])
        return [self._normalize(it) for it in items]

    def _normalize(self, it: dict) -> NormalizedRecord:
        fornecedor = (it.get("fornecedor") or {})
        orgao = (it.get("unidadeGestora") or {}).get("orgaoVinculado") or {}
        native = str(it.get("id") or it.get("numero") or "")
        return NormalizedRecord(
            id=f"portal_transparencia:{native}",
            source_id=self.source_id,
            kind=RecordKind.CONTRATO,
            title=it.get("objeto") or "Contrato federal",
            entity_name=orgao.get("nome"),
            counterparty_name=fornecedor.get("nome"),
            counterparty_doc=fornecedor.get("cnpjFormatado") or fornecedor.get("cpfFormatado"),
            amount=_as_float(it.get("valorInicialCompra") or it.get("valorFinalCompra")),
            occurred_on=_parse_date(it.get("dataInicioVigencia")),
            raw=it,
        )

    async def health(self) -> bool:
        return bool(get_settings().portal_transparencia_token)


def _to_ddmmyyyy(value: str) -> str:
    if "/" in value:
        return value
    d = datetime.strptime(value[:10], "%Y-%m-%d").date()
    return d.strftime("%d/%m/%Y")


def _as_float(value) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _parse_date(value) -> date | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(value)[:10], fmt).date()
        except ValueError:
            continue
    return None
