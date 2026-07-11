"""Schemas de resposta da API."""

from __future__ import annotations

from pydantic import BaseModel

from ..catalog import SourceDefinition
from ..models import NormalizedRecord


class SourceHit(BaseModel):
    score: float
    source: SourceDefinition


class SearchResponse(BaseModel):
    query: str | None
    embedder: str
    total: int
    hits: list[SourceHit]


class StatsResponse(BaseModel):
    total_sources: int
    with_connector: int
    with_api: int
    requires_auth: int
    by_sphere: dict[str, int]
    by_branch: dict[str, int]
    by_category: dict[str, int]


class ConnectorInfo(BaseModel):
    source_id: str
    label: str
    params: list[dict]


class FetchResponse(BaseModel):
    source_id: str
    count: int
    records: list[NormalizedRecord]
