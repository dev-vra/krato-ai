"""Conector Querido Diário — diários oficiais municipais.

API pública (Open Knowledge Brasil), busca por palavra-chave com filtro por
território (código IBGE) e período.
Docs: https://docs.queridodiario.ok.org.br/pt-br/latest/utilizando/api-publica.html
"""

from __future__ import annotations

from datetime import date, datetime

from ..models import NormalizedRecord, RecordKind
from .base import Connector, QueryParam

BASE = "https://queridodiario.ok.org.br/api"


class QueridoDiarioConnector(Connector):
    source_id = "querido_diario"
    label = "Querido Diário — Diários oficiais"
    params = [
        QueryParam("querystring", "Palavra-chave", "text", help="Termo de busca no diário."),
        QueryParam("ibge", "Código IBGE", "ibge", help="Território (município) por código IBGE."),
        QueryParam("published_since", "Publicado desde", "date", help="YYYY-MM-DD."),
        QueryParam("published_until", "Publicado até", "date", help="YYYY-MM-DD."),
    ]

    async def fetch(self, **query) -> list[NormalizedRecord]:
        params: dict = {"size": int(query.get("size", 25))}
        if query.get("querystring"):
            params["querystring"] = query["querystring"]
        if query.get("ibge"):
            params["territory_ids"] = query["ibge"]
        if query.get("published_since"):
            params["published_since"] = query["published_since"]
        if query.get("published_until"):
            params["published_until"] = query["published_until"]

        client = self._http()
        try:
            resp = await client.get(f"{BASE}/gazettes", params=params)
            resp.raise_for_status()
            payload = resp.json()
        finally:
            if self._client is None:
                await client.aclose()

        return [self._normalize(g) for g in payload.get("gazettes", [])]

    def _normalize(self, g: dict) -> NormalizedRecord:
        territory = g.get("territory_name") or ""
        uf = g.get("state_code")
        excerpts = g.get("excerpts") or []
        native_id = f"{g.get('territory_id','')}:{g.get('date','')}"
        return NormalizedRecord(
            id=f"querido_diario:{native_id}",
            source_id=self.source_id,
            kind=RecordKind.DIARIO,
            title=f"Diário Oficial — {territory} ({uf})" if territory else "Diário Oficial",
            description=(excerpts[0] if excerpts else None),
            entity_name=f"Município de {territory}" if territory else None,
            occurred_on=_parse_date(g.get("date")),
            uf=uf,
            municipality=territory,
            ibge_code=str(g.get("territory_id")) if g.get("territory_id") else None,
            source_url=g.get("url") or g.get("txt_url"),
            raw=g,
        )


def _parse_date(value) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except ValueError:
        return None
