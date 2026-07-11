"""Busca semântica + filtros sobre o catálogo."""

from .service import CatalogSearchService, SearchHit, get_search_service

__all__ = ["CatalogSearchService", "SearchHit", "get_search_service"]
