"""Registro central do catálogo de fontes.

Reúne fontes federais/nacionais e subnacionais e oferece consulta com filtros.
É a base sobre a qual a busca semântica (``search/``) indexa.
"""

from __future__ import annotations

from functools import lru_cache

from .sources import FEDERAL_SOURCES
from .subnational import SUBNATIONAL_SOURCES
from .types import Access, Branch, DataCategory, SourceDefinition, Sphere


class CatalogRegistry:
    """Índice em memória de todas as fontes do catálogo."""

    def __init__(self, sources: list[SourceDefinition]) -> None:
        self._by_id: dict[str, SourceDefinition] = {}
        for s in sources:
            if s.id in self._by_id:
                raise ValueError(f"id de fonte duplicado no catálogo: {s.id}")
            self._by_id[s.id] = s

    # ── acesso ────────────────────────────────────────────────────────
    def all(self) -> list[SourceDefinition]:
        return list(self._by_id.values())

    def get(self, source_id: str) -> SourceDefinition | None:
        return self._by_id.get(source_id)

    def __len__(self) -> int:
        return len(self._by_id)

    # ── filtros estruturados ──────────────────────────────────────────
    def filter(
        self,
        *,
        sphere: Sphere | None = None,
        branch: Branch | None = None,
        access: Access | None = None,
        category: DataCategory | None = None,
        uf: str | None = None,
        requires_auth: bool | None = None,
        has_connector: bool | None = None,
        text: str | None = None,
    ) -> list[SourceDefinition]:
        results = self.all()
        if sphere is not None:
            results = [s for s in results if s.sphere == sphere]
        if branch is not None:
            results = [s for s in results if s.branch == branch]
        if access is not None:
            results = [s for s in results if access in s.access]
        if category is not None:
            results = [s for s in results if category in s.categories]
        if uf is not None:
            results = [s for s in results if s.uf == uf.upper()]
        if requires_auth is not None:
            results = [s for s in results if s.requires_auth == requires_auth]
        if has_connector is not None:
            results = [s for s in results if s.has_connector == has_connector]
        if text:
            needle = text.lower()
            results = [s for s in results if needle in s.search_text().lower()]
        return results

    # ── estatísticas para KPIs ────────────────────────────────────────
    def stats(self) -> dict:
        srcs = self.all()

        def count_by(key) -> dict[str, int]:
            out: dict[str, int] = {}
            for s in srcs:
                out[key(s)] = out.get(key(s), 0) + 1
            return out

        cats: dict[str, int] = {}
        for s in srcs:
            for c in s.categories:
                cats[c.value] = cats.get(c.value, 0) + 1

        return {
            "total_sources": len(srcs),
            "with_connector": sum(1 for s in srcs if s.has_connector),
            "with_api": sum(1 for s in srcs if Access.API in s.access),
            "requires_auth": sum(1 for s in srcs if s.requires_auth),
            "by_sphere": count_by(lambda s: s.sphere.value),
            "by_branch": count_by(lambda s: s.branch.value),
            "by_category": cats,
        }


@lru_cache(maxsize=1)
def get_registry() -> CatalogRegistry:
    return CatalogRegistry(FEDERAL_SOURCES + SUBNATIONAL_SOURCES)
