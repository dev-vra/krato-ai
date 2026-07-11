"""Interface base para conectores de fontes.

Um conector encapsula o acesso a uma fonte (API, bulk, scraping) e normaliza o
resultado para ``NormalizedRecord``. Todo conector declara a qual fonte do catálogo
pertence (``source_id``) e quais parâmetros de consulta aceita.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass

import httpx

from ..config import get_settings
from ..models import NormalizedRecord


@dataclass
class QueryParam:
    """Descreve um parâmetro de consulta aceito pelo conector (para a UI)."""

    name: str
    label: str
    kind: str = "text"  # text | number | date | uf | ibge | select
    required: bool = False
    help: str | None = None
    options: list[str] | None = None


class Connector(abc.ABC):
    """Contrato comum de todos os conectores."""

    #: id da fonte correspondente no catálogo
    source_id: str
    #: rótulo amigável
    label: str
    #: parâmetros de consulta aceitos (dirigem os filtros na UI)
    params: list[QueryParam] = []

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    def _http(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        timeout = get_settings().http_timeout
        return httpx.AsyncClient(
            timeout=timeout,
            headers={"User-Agent": "Kratos/0.1 (+dados abertos)"},
            follow_redirects=True,
        )

    @abc.abstractmethod
    async def fetch(self, **query) -> list[NormalizedRecord]:
        """Busca registros na fonte e devolve normalizados."""
        raise NotImplementedError

    async def health(self) -> bool:
        """Verificação leve de disponibilidade (best-effort)."""
        return True
