"""Framework e registro de conectores de fontes."""

from .base import Connector, QueryParam
from .registry import ConnectorRegistry, get_connector_registry

__all__ = ["Connector", "QueryParam", "ConnectorRegistry", "get_connector_registry"]
