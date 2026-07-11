"""Conector dados.gov.br — catálogo CKAN de dados abertos.

Descoberta de datasets tratados antes de recorrer a scraping.
"""

from __future__ import annotations

from ..models import NormalizedRecord, RecordKind
from .base import Connector, QueryParam

BASE = "https://dados.gov.br/api/3/action"


class DadosGovConnector(Connector):
    source_id = "dados_gov_br"
    label = "dados.gov.br — Catálogo CKAN"
    params = [
        QueryParam("q", "Busca", "text", required=True, help="Termo (ex.: 'licitações')."),
        QueryParam("rows", "Resultados", "number", help="Quantidade (padrão 20)."),
    ]

    async def fetch(self, **query) -> list[NormalizedRecord]:
        q = query.get("q")
        if not q:
            raise ValueError("dados.gov.br exige o termo de busca 'q'.")
        params = {"q": q, "rows": int(query.get("rows", 20))}
        client = self._http()
        try:
            resp = await client.get(f"{BASE}/package_search", params=params)
            resp.raise_for_status()
            payload = resp.json()
        finally:
            if self._client is None:
                await client.aclose()

        results = (payload.get("result") or {}).get("results", [])
        return [self._normalize(r) for r in results]

    def _normalize(self, r: dict) -> NormalizedRecord:
        org = (r.get("organization") or {})
        name = r.get("name") or r.get("id") or ""
        return NormalizedRecord(
            id=f"dados_gov_br:{name}",
            source_id=self.source_id,
            kind=RecordKind.DATASET,
            title=r.get("title") or name,
            description=r.get("notes"),
            entity_name=org.get("title"),
            source_url=f"https://dados.gov.br/dados/conjuntos-dados/{name}" if name else None,
            raw={"num_resources": len(r.get("resources") or []), **r},
        )
