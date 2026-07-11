"""Registro de conectores disponíveis, indexado por ``source_id``."""

from __future__ import annotations

from functools import lru_cache

from .base import Connector
from .camara import CamaraCeapConnector
from .dados_gov import DadosGovConnector
from .pncp import PNCPConnector
from .portal_transparencia import PortalTransparenciaConnector
from .querido_diario import QueridoDiarioConnector
from .siconfi import SiconfiConnector

_CONNECTOR_CLASSES: list[type[Connector]] = [
    PNCPConnector,
    CamaraCeapConnector,
    QueridoDiarioConnector,
    SiconfiConnector,
    DadosGovConnector,
    PortalTransparenciaConnector,
]


class ConnectorRegistry:
    def __init__(self, classes: list[type[Connector]]) -> None:
        self._classes = {c.source_id: c for c in classes}

    def source_ids(self) -> list[str]:
        return list(self._classes.keys())

    def has(self, source_id: str) -> bool:
        return source_id in self._classes

    def get(self, source_id: str) -> Connector:
        cls = self._classes.get(source_id)
        if cls is None:
            raise KeyError(f"sem conector para a fonte '{source_id}'")
        return cls()

    def describe(self) -> list[dict]:
        """Metadados dos conectores para a UI (parâmetros aceitos)."""
        out = []
        for cls in self._classes.values():
            out.append({
                "source_id": cls.source_id,
                "label": cls.label,
                "params": [p.__dict__ for p in cls.params],
            })
        return out


@lru_cache(maxsize=1)
def get_connector_registry() -> ConnectorRegistry:
    return ConnectorRegistry(_CONNECTOR_CLASSES)
