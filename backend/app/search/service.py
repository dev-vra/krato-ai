"""Serviço de busca do catálogo: semântica + filtros combinados."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from ..catalog import (
    Access,
    Branch,
    DataCategory,
    SourceDefinition,
    Sphere,
    get_registry,
)
from .embeddings import get_embedder
from .index import VectorIndex


@dataclass
class SearchHit:
    source: SourceDefinition
    score: float


class CatalogSearchService:
    """Indexa o catálogo e responde buscas combinando semântica e filtros."""

    def __init__(self) -> None:
        self._registry = get_registry()
        self._embedder = get_embedder()
        self._index = VectorIndex(dim=self._embedder.dim)
        self._build()

    def _build(self) -> None:
        sources = self._registry.all()
        ids = [s.id for s in sources]
        vectors = self._embedder.encode([s.search_text() for s in sources])
        self._index.build(ids, vectors)

    @property
    def embedder_name(self) -> str:
        return self._embedder.name

    def search(
        self,
        query: str | None = None,
        *,
        sphere: Sphere | None = None,
        branch: Branch | None = None,
        access: Access | None = None,
        category: DataCategory | None = None,
        uf: str | None = None,
        requires_auth: bool | None = None,
        has_connector: bool | None = None,
        top_k: int = 20,
    ) -> list[SearchHit]:
        # 1. universo permitido pelos filtros estruturados
        allowed = {
            s.id: s
            for s in self._registry.filter(
                sphere=sphere, branch=branch, access=access, category=category,
                uf=uf, requires_auth=requires_auth, has_connector=has_connector,
            )
        }

        # 2. sem query textual → ordena por presença de conector e nome
        if not query or not query.strip():
            ordered = sorted(
                allowed.values(),
                key=lambda s: (not s.has_connector, s.name.lower()),
            )
            return [SearchHit(source=s, score=1.0) for s in ordered[:top_k]]

        # 3. com query → similaridade semântica, restrita ao universo permitido
        qvec = self._embedder.encode([query])[0]
        ranked = self._index.query(qvec, top_k=max(top_k * 3, 30))
        hits: list[SearchHit] = []
        for source_id, score in ranked:
            src = allowed.get(source_id)
            if src is not None:
                hits.append(SearchHit(source=src, score=score))
            if len(hits) >= top_k:
                break
        return hits


@lru_cache(maxsize=1)
def get_search_service() -> CatalogSearchService:
    return CatalogSearchService()
