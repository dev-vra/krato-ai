"""Rotas REST do Kratos."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Query

from ..catalog import Access, Branch, DataCategory, Sphere, get_registry
from ..connectors import get_connector_registry
from ..search import get_search_service
from .schemas import (
    ConnectorInfo,
    FetchResponse,
    SearchResponse,
    SourceHit,
    StatsResponse,
)

router = APIRouter(prefix="/api")


@router.get("/health")
async def health() -> dict:
    svc = get_search_service()
    return {
        "status": "ok",
        "sources": len(get_registry()),
        "connectors": len(get_connector_registry().source_ids()),
        "embedder": svc.embedder_name,
    }


@router.get("/catalog/stats", response_model=StatsResponse)
async def catalog_stats() -> StatsResponse:
    return StatsResponse(**get_registry().stats())


@router.get("/sources")
async def list_sources(
    sphere: Sphere | None = None,
    branch: Branch | None = None,
    access: Access | None = None,
    category: DataCategory | None = None,
    uf: str | None = None,
    requires_auth: bool | None = None,
    has_connector: bool | None = None,
    text: str | None = None,
):
    return get_registry().filter(
        sphere=sphere, branch=branch, access=access, category=category,
        uf=uf, requires_auth=requires_auth, has_connector=has_connector, text=text,
    )


@router.get("/sources/{source_id}")
async def get_source(source_id: str):
    src = get_registry().get(source_id)
    if src is None:
        raise HTTPException(status_code=404, detail=f"fonte '{source_id}' não encontrada")
    return src


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str | None = Query(None, description="Consulta em linguagem natural"),
    sphere: Sphere | None = None,
    branch: Branch | None = None,
    access: Access | None = None,
    category: DataCategory | None = None,
    uf: str | None = None,
    requires_auth: bool | None = None,
    has_connector: bool | None = None,
    top_k: int = Query(20, ge=1, le=100),
) -> SearchResponse:
    svc = get_search_service()
    hits = svc.search(
        q, sphere=sphere, branch=branch, access=access, category=category,
        uf=uf, requires_auth=requires_auth, has_connector=has_connector, top_k=top_k,
    )
    return SearchResponse(
        query=q,
        embedder=svc.embedder_name,
        total=len(hits),
        hits=[SourceHit(score=round(h.score, 4), source=h.source) for h in hits],
    )


@router.get("/connectors", response_model=list[ConnectorInfo])
async def list_connectors() -> list[ConnectorInfo]:
    return [ConnectorInfo(**c) for c in get_connector_registry().describe()]


@router.post("/connectors/{source_id}/fetch", response_model=FetchResponse)
async def run_connector(source_id: str, params: dict | None = None) -> FetchResponse:
    reg = get_connector_registry()
    if not reg.has(source_id):
        raise HTTPException(status_code=404, detail=f"sem conector para '{source_id}'")
    connector = reg.get(source_id)
    try:
        records = await connector.fetch(**(params or {}))
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502,
                            detail=f"falha ao consultar a fonte: {exc}") from exc
    return FetchResponse(source_id=source_id, count=len(records), records=records)
